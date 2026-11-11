/**
 * `webjs stop`: stop this app's running `webjs dev` / `webjs start` server.
 *
 * An agent that boots the dev server to try a route then has to stop it, and
 * across 24 eval builds that took 54 turns of `pkill`, `kill` and `pgrep`
 * (which an agent's tool guard often refuses). Both servers already record
 * their port and pid under `.webjs/` (see `recordServer` in `port.js`), so
 * this reads the record and signals the right process: the hot-reload
 * supervisor for a supervised dev server (the child alone would only be
 * restarted), else the server itself. The supervisor stops its child and the
 * `dev.parallel` tasks on SIGTERM, so the whole tree goes.
 *
 * A record whose process is gone (a server killed by a signal never removes
 * its own) is stale: it is removed and reported, and nothing is signalled. So
 * is one whose pid now belongs to an unrelated process, where `/proc` can say.
 *
 * @module
 */
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { SERVER_RECORD_FILES } from './port.js';

/**
 * Whether `pid` is still running. An exited process its parent has not reaped
 * yet (a zombie) still answers signal 0, so on Linux its state is read too.
 * @param {number} pid
 */
function alive(pid) {
  try { process.kill(pid, 0); } catch (e) { return /** @type {any} */ (e).code === 'EPERM'; }
  try { return !/^\d+ \(.*\) Z/.test(readFileSync(`/proc/${pid}/stat`, 'utf8')); } catch { return true; }
}

/**
 * Whether `pid` is a WebJs server rather than an unrelated process that reused
 * a recorded pid. Only Linux exposes the command line; elsewhere a live pid is
 * taken at its word.
 * @param {number} pid
 */
function looksLikeWebjs(pid) {
  let cmd;
  try { cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8'); } catch { return true; }
  return /webjs/.test(cmd);
}

/**
 * @param {{
 *   cwd: string,
 *   timeoutMs?: number,
 *   out?: (s: string) => void,
 *   err?: (s: string) => void,
 *   sleep?: (ms: number) => Promise<void>,
 * }} opts
 * @returns {Promise<number>} the exit code: 0 when nothing is left running, 1 when a server would not stop
 */
export async function stopServers(opts) {
  const {
    cwd, timeoutMs = 10_000,
    out = (s) => process.stdout.write(s + '\n'),
    err = (s) => process.stderr.write(s + '\n'),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = opts;
  const name = `webjs stop`;
  let found = 0;
  let code = 0;
  for (const [kind, rel] of Object.entries(SERVER_RECORD_FILES)) {
    const file = join(cwd, rel);
    /** @type {{ port?: number, pid?: number, stopPid?: number }} */
    let record;
    try { record = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
    found++;
    const pids = /** @type {number[]} */ ([record.stopPid, record.pid].filter((p) => Number.isInteger(p) && Number(p) > 0));
    const live = pids.filter((p) => alive(p) && looksLikeWebjs(p));
    if (!live.length) {
      rmSync(file, { force: true });
      out(`${name}: no ${kind} server running (removed the stale record ${rel} left by pid ${record.pid}).`);
      continue;
    }
    // The supervisor when there is one, else the server: signalling the
    // supervisor stops its child, and the child would only be restarted.
    const target = live[0];
    try { process.kill(target, 'SIGTERM'); } catch { /* exited in between */ }
    const deadline = Date.now() + timeoutMs;
    while (live.some(alive) && Date.now() < deadline) await sleep(100);
    if (live.some(alive)) {
      for (const p of live) { try { process.kill(p, 'SIGKILL'); } catch { /* gone */ } }
      await sleep(200);
    }
    if (live.some(alive)) {
      err(`${name}: the ${kind} server (pid ${live.join(', ')}) did not exit.`);
      code = 1;
      continue;
    }
    rmSync(file, { force: true });
    out(`${name}: stopped the ${kind} server on port ${record.port} (pid ${target}).`);
  }
  if (!found) out(`${name}: no server is running for this app (nothing recorded under .webjs/).`);
  return code;
}
