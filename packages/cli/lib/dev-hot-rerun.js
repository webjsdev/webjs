/**
 * The fast path for a `bun --hot` re-run of the `webjs dev` server child
 * (#1575).
 *
 * `bun --hot` re-evaluates this CLI on every reload. The first run's server
 * owns the process (`dev/hot-host.js` in `@webjsdev/server`) and only needs to
 * hear that the module registry was reset, so a re-run calls the host directly
 * instead of importing the whole server again just to reach `startServer`,
 * which re-evaluated every framework module on every edit for nothing.
 *
 * The one thing a re-run must still notice is the framework itself changing
 * under it (an upgrade while `webjs dev` runs): the first run's code cannot
 * load the new copy in place, so the child exits and the supervisor starts a
 * fresh process.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOSTS = Symbol.for('webjs.dev.hotHosts');

/** The installed `@webjsdev/server` version, or '' when it cannot be read. */
function installedServerVersion() {
  try {
    const entry = fileURLToPath(import.meta.resolve('@webjsdev/server'));
    return JSON.parse(readFileSync(join(dirname(entry), 'package.json'), 'utf8')).version || '';
  } catch {
    return '';
  }
}

/**
 * Hand a re-run to the live dev server. Returns false when there is none (the
 * first run), so the caller starts the server as usual.
 *
 * @param {{ exit?: (code: number) => void, log?: (line: string) => void }} [io]
 * @returns {Promise<boolean>}
 */
export async function rerunHotDevServer(io = {}) {
  const exit = io.exit || ((code) => process.exit(code));
  const log = io.log || ((line) => console.log(line));
  const hosts = /** @type {any} */ (globalThis)[HOSTS];
  if (!(hosts instanceof Map) || hosts.size === 0) return false;
  const version = installedServerVersion();
  for (const host of hosts.values()) {
    if (version && host.version && host.version !== version) {
      log(`[webjs] @webjsdev/server changed (${host.version} -> ${version}), restarting the dev server`);
      exit(0);
      return true;
    }
  }
  for (const host of hosts.values()) await host.rerun();
  return true;
}
