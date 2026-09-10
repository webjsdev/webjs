import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Read the dev/start task orchestration from an app's `package.json` `"webjs"`
 * block (#550). This is what lets `webjs dev` / `webjs start` behave identically
 * to `npm run dev` / `npm run start`: the orchestration (a Tailwind compile, a
 * `db migrate` before boot) moves OUT of `concurrently` + `pre*` npm hooks
 * and INTO the framework primitive, so a bare `webjs dev` is not a degraded run.
 *
 * Reads only `before` / `parallel` here (the CLI-run tasks). The dev-only
 * `regenerate` key (#967, on-request rebuilds of a stale served output like
 * `public/tailwind.css`) is read by the SERVER, not this reader, so the scaffold
 * keeps its static CSS fresh WITHOUT a `--watch` under `parallel`.
 *
 * Shape:
 *   "webjs": {
 *     "dev":   {
 *       "before":   ["webjs db migrate", "tailwindcss -i ./public/input.css -o ./public/tailwind.css --minify"]
 *       // dev.regenerate keeps the CSS fresh on request (server-read, see dev-regenerate.js)
 *     },
 *     "start": { "before": ["webjs db migrate"] }
 *   }
 *
 * `before` commands run sequentially to completion BEFORE the server boots (the
 * old `predev` / `prestart` hooks: a one-shot `webjs db migrate`).
 * `parallel` (dev only) commands run as long-lived child processes ALONGSIDE the
 * server (the old `concurrently` watchers), for a genuinely long-lived side
 * process. Returns normalized arrays (never undefined) so callers iterate
 * without guards, and a missing/empty config yields empty arrays so a plain app
 * runs `webjs dev`/`start` unchanged.
 *
 * Pure (reads one file, never spawns / prints / exits) so it is unit-testable
 * without a process, matching `lib/port.js` and `lib/dev-supervisor.js`.
 *
 * @param {string} appDir
 * @param {(p: string) => string} [readFile] injectable reader for tests
 * @returns {{ dev: { before: string[], parallel: string[] }, start: { before: string[] } }}
 */
export function readAppTasks(appDir, readFile) {
  const webjs = readWebjsBlock(appDir, readFile);
  // No package.json, unparseable, or no block: a plain run with no orchestration.
  if (!webjs) return emptyTasks();

  /** Keep only non-empty string entries; drop anything else defensively. */
  const cmds = (v) =>
    Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim().length > 0) : [];

  return {
    dev: {
      before: cmds(webjs.dev && webjs.dev.before),
      parallel: cmds(webjs.dev && webjs.dev.parallel),
    },
    start: { before: cmds(webjs.start && webjs.start.before) },
  };
}

/**
 * The app's `package.json` `"webjs"` block, or `null` when there is no
 * package.json, it does not parse, or the block is absent / not an object.
 * Shared by every CLI-side reader here so the file is read one way.
 *
 * @param {string} appDir
 * @param {(p: string) => string} [readFile] injectable reader for tests
 * @returns {Record<string, unknown> | null}
 */
function readWebjsBlock(appDir, readFile) {
  const read = readFile || ((p) => readFileSync(p, 'utf8'));
  let pkg;
  try {
    pkg = JSON.parse(read(join(appDir, 'package.json')));
  } catch {
    return null;
  }
  const webjs = pkg && typeof pkg === 'object' ? pkg.webjs : null;
  return webjs && typeof webjs === 'object' ? webjs : null;
}

/** @returns {{ dev: { before: string[], parallel: string[] }, start: { before: string[] } }} */
function emptyTasks() {
  return { dev: { before: [], parallel: [] }, start: { before: [] } };
}

/**
 * Read the `webjs db` verb map from an app's `package.json` `"webjs"` block
 * (#1468). Drizzle is the scaffold DEFAULT, never lock-in: the runtime never
 * imports it and `db/connection.server.ts` is the app's own file. But without
 * this map the `webjs db` verbs contradicted that, since `generate` / `migrate`
 * / `push` / `studio` resolved the app's drizzle-kit binary and exited 1 with
 * any other ORM installed, while `webjs db migrate` is the spelling baked into
 * the scaffolded `dev.before` / `start.before` tasks, the Dockerfile, and the
 * deployment docs. Mapping a verb here keeps that spelling stable across ORMs,
 * so an ORM swap is one config block plus the app's own `db/` files.
 *
 * Shape:
 *   "webjs": {
 *     "db": {
 *       "migrate": "prisma migrate deploy",
 *       "studio":  "prisma studio",
 *       "reset":   "prisma migrate reset --force"
 *     }
 *   }
 *
 * Any key is a verb: a mapped verb runs its command through the shell (the
 * same way a `before` step does, so a local-only binary resolves), with the
 * extra CLI args appended. A verb the map does not name keeps its default (the
 * drizzle-kit passthrough for the four kit verbs, `db/seed.server.ts` for
 * `seed`), so an app with no block is unchanged. Non-string / blank values are
 * dropped defensively, the same posture as `readAppTasks`.
 *
 * Pure (reads one file, never spawns / prints / exits) so it is unit-testable
 * without a process.
 *
 * @param {string} appDir
 * @param {(p: string) => string} [readFile] injectable reader for tests
 * @returns {Record<string, string>} verb -> shell command (empty when unset)
 */
export function readDbCommands(appDir, readFile) {
  const webjs = readWebjsBlock(appDir, readFile);
  const db = webjs ? webjs.db : null;
  if (!db || typeof db !== 'object' || Array.isArray(db)) return {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const [verb, cmd] of Object.entries(db)) {
    if (typeof cmd === 'string' && cmd.trim().length > 0 && verb.trim().length > 0) out[verb] = cmd;
  }
  return out;
}
