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
 * `/proc/<pid>/stat`, the third after the state); macOS and the BSDs give
 * `ps -o lstart=`. Windows has neither, and a record there is judged on
 * liveness alone.
 * @param {number} pid
 * @returns {string | null}
 */
export function processStartTime(pid) {
  const stat = procStat(pid);
  if (stat) return stat[19] || null;
  if (process.platform === 'win32') return null;
  try {
    const out = execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
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
 * The port a still-running `webjs dev` recorded for this app, or null.
 * @param {string} cwd
 * @returns {number | null}
 */
export function recordedDevPort(cwd) {
  const record = liveServerRecord(cwd, 'dev');
  return record && Number.isInteger(record.port) ? /** @type {number} */ (record.port) : null;
}
