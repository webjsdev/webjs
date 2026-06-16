import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Read the dev/start task orchestration from an app's `package.json` `"webjs"`
 * block (#550). This is what lets `webjs dev` / `webjs start` behave identically
 * to `npm run dev` / `npm run start`: the orchestration (Tailwind's watcher, a
 * `db migrate` before prod boot) moves OUT of `concurrently` + `pre*` npm hooks
 * and INTO the framework primitive, so a bare `webjs dev` is not a degraded run.
 *
 * Shape:
 *   "webjs": {
 *     "dev":   { "parallel": ["tailwindcss -i ./public/input.css -o ./public/tailwind.css --watch"] },
 *     "start": { "before":   ["webjs db migrate"] }
 *   }
 *
 * `parallel` (dev) commands run as long-lived child processes ALONGSIDE the
 * server; `before` (start) commands run sequentially to completion BEFORE the
 * server boots. Returns normalized arrays (never undefined) so callers iterate
 * without guards, and a missing/empty config yields empty arrays so a plain app
 * with no Tailwind/DB runs `webjs dev`/`start` exactly as before.
 *
 * Pure (reads one file, never spawns / prints / exits) so it is unit-testable
 * without a process, matching `lib/port.js` and `lib/dev-supervisor.js`.
 *
 * @param {string} appDir
 * @param {(p: string) => string} [readFile] injectable reader for tests
 * @returns {{ dev: { parallel: string[] }, start: { before: string[] } }}
 */
export function readAppTasks(appDir, readFile) {
  const read = readFile || ((p) => readFileSync(p, 'utf8'));
  let pkg = {};
  try {
    pkg = JSON.parse(read(join(appDir, 'package.json')));
  } catch {
    // No package.json, or unparseable: a plain run with no orchestration.
    return emptyTasks();
  }
  const webjs = pkg && typeof pkg === 'object' ? pkg.webjs : null;
  if (!webjs || typeof webjs !== 'object') return emptyTasks();

  /** Keep only non-empty string entries; drop anything else defensively. */
  const cmds = (v) =>
    Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim().length > 0) : [];

  return {
    dev: { parallel: cmds(webjs.dev && webjs.dev.parallel) },
    start: { before: cmds(webjs.start && webjs.start.before) },
  };
}

/** @returns {{ dev: { parallel: string[] }, start: { before: string[] } }} */
function emptyTasks() {
  return { dev: { parallel: [] }, start: { before: [] } };
}
