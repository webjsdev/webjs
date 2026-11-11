/**
 * `webjs stop`: stop this app's running `webjs dev` / `webjs start` server.
 *
 * An agent that boots the dev server to try a route then has to stop it, and
 * across 24 eval builds that took 54 turns of `pkill`, `kill` and `pgrep`
 * (which an agent's tool guard often refuses). Both servers record their port
 * and pid under `.webjs/` (see `recordServer` in `server-record.js`), so this
 * reads the record and signals the process it names. For a supervised dev
 * server that is the hot-reload supervisor, which writes the record before its
 * `dev.before` steps and keeps it until it exits, so a stop during a slow
 * before-step or a crash-restart backoff still finds it; on SIGTERM it stops
 * its child and the `dev.parallel` tasks, so the whole tree goes. For
 * `webjs start` and `webjs dev --no-hot` it is the server, which records
 * itself once its port is bound.
 *
 * A record whose process is gone (a server killed by a signal never removes
 * its own) is stale: it is removed and reported, and nothing is signalled. So
 * is one whose pid now belongs to an unrelated process. The test is
 * `isLiveServer`, the same one `webjs status` reads the port through.
 *
 * Run from a subdirectory of the app, it finds the app root with
 * `findAppRoot` (the nearest directory holding both `app/` and
 * `package.json`, so a route folder named `app` is not taken for it); outside
 * any app it says so and exits 1.
 *
 * @module
 */
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { SERVER_RECORD_FILES, readServerRecord, isLiveServer, processAlive } from './server-record.js';
import { findAppRoot, notInsideAppMessage } from './check-target.js';

/**
 * @param {{
 *   cwd: string,
 *   timeoutMs?: number,
 *   out?: (s: string) => void,
 *   err?: (s: string) => void,
 *   sleep?: (ms: number) => Promise<void>,
 * }} opts
 * @returns {Promise<number>} the exit code: 0 when nothing is left running, 1 when a server would not stop or there is no app here
 */
export async function stopServers(opts) {
  const {
    timeoutMs = 10_000,
    out = (s) => process.stdout.write(s + '\n'),
    err = (s) => process.stderr.write(s + '\n'),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = opts;
  const name = `webjs stop`;
  const { root: cwd, workspaceApps } = await findAppRoot(opts.cwd);
  if (!cwd) {
    err(notInsideAppMessage('stop', workspaceApps));
    return 1;
  }
  let found = 0;
  let code = 0;
  for (const [kind, rel] of /** @type {[('dev' | 'start'), string][]} */ (Object.entries(SERVER_RECORD_FILES))) {
    const file = join(cwd, rel);
    const record = readServerRecord(cwd, kind);
    if (!record) continue;
    found++;
    if (!isLiveServer(record)) {
      rmSync(file, { force: true });
      out(`${name}: no ${kind} server running (removed the stale record ${rel} left by pid ${record.pid}).`);
      continue;
    }
    const target = /** @type {number} */ (record.pid);
    try { process.kill(target, 'SIGTERM'); } catch { /* exited in between */ }
    const deadline = Date.now() + timeoutMs;
    while (processAlive(target) && Date.now() < deadline) await sleep(100);
    if (processAlive(target)) {
      try { process.kill(target, 'SIGKILL'); } catch { /* gone */ }
      await sleep(200);
    }
    if (processAlive(target)) {
      err(`${name}: the ${kind} server (pid ${target}) did not exit.`);
      code = 1;
      continue;
    }
    rmSync(file, { force: true });
    out(`${name}: stopped the ${kind} server on port ${record.port} (pid ${target}).`);
  }
  if (!found) out(`${name}: no server is running for this app (nothing recorded under .webjs/).`);
  return code;
}
