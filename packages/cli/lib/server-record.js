/**
 * The record a running `webjs dev` / `webjs start` leaves under `.webjs/`
 * (#1686), and the one liveness test every reader of it shares.
 *
 * `webjs status` reads the dev record for the port to probe and `webjs stop`
 * reads both for the process to signal. They used to judge a record
 * separately (status took any live pid, stop also rejected a zombie and a pid
 * whose command line lacked the brand name), so the two could disagree about
 * the same file. Both now ask `liveServerRecord`.
 *
 * A record is `{ port, pid, startTime? }`. `pid` is the process to signal:
 * the hot-reload supervisor for a supervised dev server (it stops its child
 * and the `dev.parallel` tasks, and a child stopped alone would only be
 * restarted), else the server itself. `startTime` is that process's start
 * time as the OS reports it, so a pid the OS later hands to an unrelated
 * process is told apart from the server that wrote the record.
 *
 * @module
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where each server kind records itself. `webjs status` reads only the dev
 * one; `webjs stop` reads both.
 */
export const SERVER_RECORD_FILES = {
  dev: join('.webjs', 'dev-server.json'),
  start: join('.webjs', 'start-server.json'),
};

/**
 * @typedef {{ port?: number, pid?: number, startTime?: string }} ServerRecord
 */

/**
 * Whether `pid` is still running. An exited process its parent has not reaped
 * yet (a zombie) still answers signal 0, so on Linux its state is read too.
 * @param {number} pid
 */
export function processAlive(pid) {
  try { process.kill(pid, 0); } catch (e) { return /** @type {any} */ (e).code === 'EPERM'; }
  const stat = procStat(pid);
  return !stat || stat[0] !== 'Z';
}

/**
 * The fields of `/proc/<pid>/stat` after the command name, or null where there
 * is no `/proc`. The name sits in parentheses and may itself hold spaces and
 * parentheses, so the fields start after the LAST `)`.
 * @param {number} pid
 * @returns {string[] | null}
 */
function procStat(pid) {
  let raw;
  try { raw = readFileSync(`/proc/${pid}/stat`, 'utf8'); } catch { return null; }
  return raw.slice(raw.lastIndexOf(')') + 2).split(' ');
}

/**
 * When `pid` started, as an opaque string compared for equality, or null when
 * the OS will not say. Linux gives clock ticks since boot (field 22 of
 * `/proc/<pid>/stat`, the third after the state), which no time zone touches;
 * macOS and the BSDs give `ps -o lstart=`. Windows has neither, and a record
 * there is judged on liveness alone.
 *
 * `lstart` is printed in the local time zone and (on macOS) the `LC_TIME`
 * locale, both read from the environment `ps` inherits. The writer and the
 * reader of a record do not share one: the dev supervisor has loaded the
 * app's `.env` (which may set `TZ`) by the time it records, and `webjs stop`
 * never loads it. So `ps` runs with the zone and locale pinned, and the same
 * process reads the same string from either side. The string is kept as is
 * rather than parsed: it carries no zone, so a parse would read it in the
 * caller's zone and bring the mismatch back.
 * @param {number} pid
 * @param {{ ps?: boolean }} [opts] `ps: true` skips `/proc` (a test of the `ps` path on Linux)
 * @returns {string | null}
 */
export function processStartTime(pid, { ps = false } = {}) {
  const stat = ps ? null : procStat(pid);
  if (stat) return stat[19] || null;
  if (process.platform === 'win32') return null;
  try {
    const env = { ...process.env, TZ: 'UTC', LC_ALL: 'C', LANG: 'C' };
    const out = execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/**
 * Whether `pid` runs the CLI's `dev` or `start` command, read from its command
 * line: an argument naming the CLI entry (`bin/webjs.js`, the
 * `node_modules/.bin/webjs` link, or a global `bin/webjs`) followed by `dev`
 * or `start`. Null where the command line cannot be read (no `/proc`). Only
 * consulted for a record with no start time, since the start time is exact.
 * @param {number} pid
 * @returns {boolean | null}
 */
export function runsServerCommand(pid) {
  let raw;
  try { raw = readFileSync(`/proc/${pid}/cmdline`, 'utf8'); } catch { return null; }
  const argv = raw.split('\0').filter(Boolean);
  const entry = argv.findIndex((a) => /(^|[\\/])\.?bin[\\/]webjs(\.js)?$/.test(a));
  return entry >= 0 && argv.slice(entry + 1).some((a) => a === 'dev' || a === 'start');
}

/**
 * Whether a record names a server that is still running: its pid is alive
 * (a zombie is not), and it is the same process that wrote the record, not an
 * unrelated one the OS gave the pid to since. A recorded start time decides
 * that when the OS reports one; else the command line does; where neither can
 * be read, a live pid is taken at its word.
 * @param {ServerRecord | null | undefined} record
 * @returns {boolean}
 */
export function isLiveServer(record) {
  const pid = record?.pid;
  if (!Number.isInteger(pid) || /** @type {number} */ (pid) <= 0) return false;
  const p = /** @type {number} */ (pid);
  if (!processAlive(p)) return false;
  if (record?.startTime) {
    const now = processStartTime(p);
    if (now !== null) return now === record.startTime;
  }
  const cmd = runsServerCommand(p);
  return cmd === null ? true : cmd;
}

/**
 * Read one kind's record, or null when there is none or it does not parse.
 * @param {string} cwd the app root
 * @param {'dev' | 'start'} kind
 * @returns {ServerRecord | null}
 */
export function readServerRecord(cwd, kind) {
  try { return JSON.parse(readFileSync(join(cwd, SERVER_RECORD_FILES[kind]), 'utf8')); } catch { return null; }
}

/**
 * The record of a server of this kind that is still running, or null.
 * @param {string} cwd the app root
 * @param {'dev' | 'start'} kind
 * @returns {ServerRecord | null}
 */
export function liveServerRecord(cwd, kind) {
  const record = readServerRecord(cwd, kind);
  return isLiveServer(record) ? record : null;
}

/**
 * Record this process as the app's server on `port`, removed again when this
 * process exits. Best effort: a read-only app directory only loses the
 * convenience.
 *
 * A record naming another server that is still running is never overwritten,
 * so a second server that then fails to bind (the port is taken) cannot
 * replace the running one's record and then delete it on its way out. The
 * exit handler removes the record only while it still names this process.
 * A server that keeps running after being refused this way takes the record
 * over once the other one is gone (see `claimServerRecord`).
 *
 * A process killed by a signal skips its exit handler and leaves the record
 * behind; every reader ignores it once `isLiveServer` says it is gone, and
 * `webjs stop` removes it.
 * @param {string} cwd the app root
 * @param {number} port
 * @param {{ kind?: 'dev' | 'start' }} [opts]
 * @returns {ServerRecord | null} the record written, or the live one kept in its place
 */
export function recordServer(cwd, port, { kind = 'dev' } = {}) {
  const file = join(cwd, SERVER_RECORD_FILES[kind]);
  const existing = readServerRecord(cwd, kind);
  if (existing && existing.pid !== process.pid && isLiveServer(existing)) return existing;
  const startTime = processStartTime(process.pid);
  /** @type {ServerRecord} */
  const record = { port, pid: process.pid, ...(startTime ? { startTime } : {}) };
  try {
    mkdirSync(join(cwd, '.webjs'), { recursive: true });
    writeFileSync(file, JSON.stringify(record) + '\n');
  } catch {
    return null;
  }
  process.once('exit', () => {
    try {
      if (JSON.parse(readFileSync(file, 'utf8')).pid === process.pid) rmSync(file, { force: true });
    } catch { /* gone already */ }
  });
  return record;
}

/**
 * How often a server that found another live server's record checks whether
 * that one has gone, so it can take the record over.
 */
export const RECLAIM_INTERVAL_MS = 2000;

/**
 * Record this process as `recordServer` does, and when another live server
 * holds the record, keep checking on an unref'd timer and take it over once
 * that server is gone. Without this, two dev servers for one app on different
 * ports left the second unrecorded after the first exited, so `webjs stop`
 * and `webjs status` could no longer find a server that was still running.
 * The timer stops once the record is this process's, and never keeps the
 * process alive.
 * @param {string} cwd the app root
 * @param {() => number} getPort the port to record when the claim succeeds (a dev supervisor's moves with its child's bind)
 * @param {{ kind?: 'dev' | 'start', intervalMs?: number }} [opts]
 * @returns {ServerRecord | null} what `recordServer` returned on the first attempt
 */
export function claimServerRecord(cwd, getPort, { kind = 'dev', intervalMs = RECLAIM_INTERVAL_MS } = {}) {
  const first = recordServer(cwd, getPort(), { kind });
  if (!first || first.pid === process.pid) return first;
  const timer = setInterval(() => {
    const now = recordServer(cwd, getPort(), { kind });
    if (!now || now.pid === process.pid) clearInterval(timer);
  }, intervalMs);
  timer.unref?.();
  return first;
}

/**
 * The IPC message a supervised dev child sends once its listener is bound:
 * `{ webjs: DEV_LISTENING_MESSAGE, port }`. The supervisor writes the record
 * before the child exists, with the port from argv and env; the bound port
 * can differ (`--port 0`, or a `.env` `PORT` edit that restarted the child on
 * another port), so the supervisor rewrites the record's port on each report.
 */
export const DEV_LISTENING_MESSAGE = 'listening';

/**
 * Point this process's record at the port it is now serving on, keeping the
 * pid and start time. A record this process did not write (another live
 * server kept its own) is left alone.
 * @param {string} cwd the app root
 * @param {'dev' | 'start'} kind
 * @param {number} port
 * @returns {boolean} whether the record was rewritten
 */
export function updateRecordedPort(cwd, kind, port) {
  const record = readServerRecord(cwd, kind);
  if (!record || record.pid !== process.pid || !Number.isInteger(port) || port <= 0) return false;
  if (record.port === port) return true;
  try {
    writeFileSync(join(cwd, SERVER_RECORD_FILES[kind]), JSON.stringify({ ...record, port }) + '\n');
    return true;
  } catch {
    return false;
  }
}

/**
 * The port a started server actually bound, read from the handle
 * `startServer` resolves with (a `node:http` server's `address()`, or
 * `Bun.serve`'s `port`), else `fallback`. What `--port 0` makes differ.
 * @param {any} started
 * @param {number} fallback
 * @returns {number}
 */
export function boundPort(started, fallback) {
  const server = started?.server;
  if (typeof server?.port === 'number' && server.port > 0) return server.port;
  try {
    const addr = server?.address?.();
    if (addr && typeof addr === 'object' && addr.port > 0) return addr.port;
  } catch { /* not a node:http server */ }
  return fallback;
}

/**
 * The port a still-running `webjs dev` recorded for this app, or null.
 * @param {string} cwd
 * @returns {number | null}
 */
export function recordedDevPort(cwd) {
  const record = liveServerRecord(cwd, 'dev');
  // Port 0 is a `--port 0` supervisor whose child has not reported its bind yet.
  return record && Number.isInteger(record.port) && Number(record.port) > 0 ? /** @type {number} */ (record.port) : null;
}
