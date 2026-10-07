/**
 * A taken port fails the server fast, with the process that holds it (#1527).
 *
 * Two runtimes, two failure shapes for the same mistake (a second `webjs dev`
 * on a port another server already listens on):
 *
 * - **Bun** turns `SO_REUSEPORT` on by default for `Bun.serve({ development:
 *   false })`, which the Bun listener passes. The second server then binds
 *   SILENTLY and the kernel splits connections between the two processes, so a
 *   stale server keeps answering a share of the requests with old code. The
 *   listener now passes `reusePort` explicitly (`reusePortRequested()`), so the
 *   bind fails with `EADDRINUSE` like it does on Node.
 * - **Node** emitted `EADDRINUSE` as an unhandled `'error'` on the server,
 *   which crashed the process with a raw stack, and the dev supervisor then
 *   restarted it on its backoff forever.
 *
 * Both listeners now throw `portInUseError()`: an `EADDRINUSE` error whose
 * message names the holder. The CLI prints it and exits with
 * `PORT_IN_USE_EXIT_CODE`, which the dev supervisor treats as final.
 *
 * Sharing a port is still possible on purpose: `WEBJS_REUSE_PORT=1` sets
 * `SO_REUSEPORT` on both runtimes (several processes behind the kernel's
 * balancer).
 */
import { readFileSync, readdirSync, readlinkSync } from 'node:fs';

/**
 * Whether the operator asked for a shared port (`WEBJS_REUSE_PORT=1`).
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function reusePortRequested(env = process.env) {
  const v = String(env.WEBJS_REUSE_PORT || '').toLowerCase();
  return v === '1' || v === 'true';
}

/**
 * Whether an error is a bind failure on a taken port. Node sets `code`; Bun's
 * `Bun.serve` sets `code` too, and older Bun releases only said so in the
 * message.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function isAddrInUse(err) {
  if (!err || typeof err !== 'object') return false;
  const e = /** @type {any} */ (err);
  return e.code === 'EADDRINUSE' || /EADDRINUSE|address already in use|Is port \d+ in use/i.test(String(e.message || ''));
}

/**
 * The socket inodes LISTENing on `port`, from the text of `/proc/net/tcp` or
 * `/proc/net/tcp6`. Columns: `sl local_address rem_address st ... inode`; the
 * port is the hex after the colon of `local_address`, and state `0A` is LISTEN.
 *
 * @param {string} table
 * @param {number} port
 * @returns {string[]}
 */
export function listenInodes(table, port) {
  const out = [];
  for (const line of table.split('\n').slice(1)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 10) continue;
    const local = cols[1];
    const hexPort = local.slice(local.lastIndexOf(':') + 1);
    if (parseInt(hexPort, 16) !== port || cols[3] !== '0A') continue;
    if (cols[9] && cols[9] !== '0') out.push(cols[9]);
  }
  return out;
}

/**
 * Best effort: the process listening on `port`, found through `/proc` (Linux
 * only). Only processes this user may inspect are visible, so a server run by
 * another user yields null. Never throws.
 *
 * @param {number} port
 * @param {{ readFile?: (p: string) => string, readDir?: (p: string) => string[], readLink?: (p: string) => string, selfPid?: number }} [io]
 * @returns {{ pid: number, command: string } | null}
 */
export function findPortHolder(port, io = {}) {
  const readFile = io.readFile || ((p) => readFileSync(p, 'utf8'));
  const readDir = io.readDir || ((p) => readdirSync(p));
  const readLink = io.readLink || ((p) => readlinkSync(p));
  const selfPid = io.selfPid ?? process.pid;
  try {
    const inodes = new Set();
    for (const t of ['/proc/net/tcp', '/proc/net/tcp6']) {
      let text = '';
      try { text = readFile(t); } catch { continue; }
      for (const i of listenInodes(text, port)) inodes.add(`socket:[${i}]`);
    }
    if (inodes.size === 0) return null;
    for (const name of readDir('/proc')) {
      if (!/^\d+$/.test(name) || Number(name) === selfPid) continue;
      let fds = [];
      try { fds = readDir(`/proc/${name}/fd`); } catch { continue; }
      for (const fd of fds) {
        let target = '';
        try { target = readLink(`/proc/${name}/fd/${fd}`); } catch { continue; }
        if (!inodes.has(target)) continue;
        let command = '';
        try { command = readFile(`/proc/${name}/cmdline`).split('\0').filter(Boolean).join(' '); } catch {}
        return { pid: Number(name), command: command.length > 120 ? `${command.slice(0, 119)}…` : command };
      }
    }
  } catch {}
  return null;
}

/**
 * The message for a taken port.
 *
 * @param {number} port
 * @param {{ pid: number, command: string } | null} holder
 * @returns {string}
 */
export function portInUseMessage(port, holder) {
  const who = holder
    ? `by PID ${holder.pid}${holder.command ? ` (${holder.command})` : ''}`
    : 'by another process';
  return `port ${port} is already in use ${who}. Stop that server, or start this one on another port (PORT=<n> or --port <n>).`;
}

/**
 * The error both listeners throw on a taken port: code `EADDRINUSE`, a
 * message naming the holder, the original error as `cause`.
 *
 * @param {number} port
 * @param {unknown} cause
 * @returns {Error & { code: 'EADDRINUSE', port: number, holder: { pid: number, command: string } | null }}
 */
export function portInUseError(port, cause) {
  const holder = findPortHolder(port);
  const err = /** @type {any} */ (new Error(portInUseMessage(port, holder), { cause }));
  err.code = 'EADDRINUSE';
  err.port = port;
  err.holder = holder;
  return err;
}
