/**
 * On-request regeneration of a stale build output in dev (#967).
 *
 * A UI scaffold compiles a STATIC `public/tailwind.css` (#947) so the app is
 * fully styled with JavaScript OFF (progressive enhancement, invariant 1). In
 * prod that static file is built once by `start.before`. In DEV the classic
 * shape was a long-lived `tailwindcss --watch` in `dev.parallel`, but a watch
 * that dies mid-session, lags, or never starts (an app-dir relocation, a killed
 * child) then serves STALE or MISSING CSS with no error: a newly added utility
 * class has no backing rule, so the app renders unstyled locally while prod is
 * fine, a confusing, hard-to-attribute regression.
 *
 * This module removes that foot-gun by regenerating the output ON REQUEST when
 * it is stale, instead of relying on a live watch. It is deliberately GENERIC
 * and styling-agnostic: it runs whatever command the app declares, keyed by the
 * output path, so the framework stays BYO-styling (the Tailwind knowledge lives
 * in the scaffold's `package.json` config, not here). It is DEV-ONLY; prod keeps
 * the static build, so dev and prod resolve classes through the exact SAME
 * command (`tailwindcss -i input.css -o tailwind.css`) and cannot diverge.
 *
 * Declared as `webjs.dev.regenerate` in the app's `package.json`:
 *   "webjs": { "dev": { "regenerate": [
 *     { "output": "public/tailwind.css",
 *       "command": "tailwindcss -i ./public/input.css -o ./public/tailwind.css --minify",
 *       "inputs": ["app", "components", "modules", "lib", "public/input.css"] }
 *   ] } }
 *
 * When `/public/tailwind.css` is requested and the newest mtime under any of
 * `inputs` is newer than the output (or the output is missing), `command` is run
 * to completion BEFORE the file is served, so the response is always fresh.
 * Concurrent requests coalesce onto one in-flight compile.
 */

import { spawn as nodeSpawn } from 'node:child_process';
import { readFile, stat, readdir } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';

/**
 * @typedef {{ output: string, command: string, inputs: string[] }} RegenerateRule
 */

/**
 * Read + normalize the `webjs.dev.regenerate` rules from an app's
 * `package.json`. Defensive: a missing/malformed block yields `[]` (a plain app
 * runs unchanged). Each rule's `output` is normalized to an appDir-relative path
 * with no leading slash so it matches a served `/public/...` path after the
 * slash is stripped.
 *
 * @param {string} appDir
 * @param {(p: string) => Promise<string>} [read] injectable reader for tests
 * @returns {Promise<RegenerateRule[]>}
 */
export async function readRegenerateRules(appDir, read) {
  const readFn = read || ((p) => readFile(p, 'utf8'));
  let pkg;
  try {
    pkg = JSON.parse(await readFn(join(appDir, 'package.json')));
  } catch {
    return [];
  }
  const rules = pkg && pkg.webjs && pkg.webjs.dev ? pkg.webjs.dev.regenerate : null;
  if (!Array.isArray(rules)) return [];
  return rules
    .filter((r) => r && typeof r.output === 'string' && typeof r.command === 'string')
    .map((r) => ({
      output: r.output.replace(/^\/+/, ''),
      command: r.command,
      inputs: Array.isArray(r.inputs) ? r.inputs.filter((i) => typeof i === 'string') : [],
    }));
}

// Directories never worth walking for a source-freshness check: build output,
// dependencies, VCS + framework caches. Skipping them keeps the walk cheap and
// avoids treating a dependency's mtime as an app-source edit.
const IGNORE_DIRS = new Set(['node_modules', '.git', '.webjs', 'dist', '.next', 'coverage']);

/**
 * Newest mtime (ms) under a path: the file's own mtime, or the max over a
 * directory tree (skipping IGNORE_DIRS and dotfiles). A missing path is 0, so it
 * never makes the output look stale. Pure I/O, no throw.
 *
 * @param {string} abs
 * @returns {Promise<number>}
 */
async function maxMtimeMs(abs) {
  let st;
  try {
    st = await stat(abs);
  } catch {
    return 0;
  }
  if (!st.isDirectory()) return st.mtimeMs;
  let newest = st.mtimeMs;
  let entries;
  try {
    entries = await readdir(abs, { withFileTypes: true });
  } catch {
    return newest;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || IGNORE_DIRS.has(e.name)) continue;
    const m = await maxMtimeMs(join(abs, e.name));
    if (m > newest) newest = m;
  }
  return newest;
}

/**
 * Build a PATH that prepends every ancestor `node_modules/.bin` (mirrors
 * `lib/run-tasks.js`'s `envWithLocalBin`), so a command naming a LOCAL-only
 * binary (`tailwindcss`) resolves the same way `npm run` would.
 *
 * @param {string} cwd
 * @returns {NodeJS.ProcessEnv}
 */
function envWithLocalBin(cwd) {
  const bins = [];
  let dir = cwd;
  for (;;) {
    bins.push(join(dir, 'node_modules', '.bin'));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { ...process.env, PATH: [...bins, process.env.PATH || ''].join(delimiter) };
}

/**
 * Run a regenerate command to completion. Never rejects (a compile failure is
 * logged by the tool's own inherited stderr; the caller then serves whatever is
 * on disk, degrading to the previous behaviour rather than 500ing the request).
 *
 * @param {string} command
 * @param {string} cwd
 * @param {typeof nodeSpawn} spawn
 * @returns {Promise<void>}
 */
function runCommand(command, cwd, spawn) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, stdio: 'inherit', cwd, env: envWithLocalBin(cwd) });
    child.on('exit', () => resolve());
    child.on('error', () => resolve());
  });
}

// In-flight compiles, keyed by appDir + output, so concurrent requests for the
// same stale output share ONE compile instead of racing N of them. Module-scope
// (not per-handler): the filesystem is the shared resource being guarded.
const inFlight = new Map();

/**
 * If a regenerate rule matches `relPath` and its output is stale (older than the
 * newest input, or missing), run the rule's command to completion before
 * returning, so the caller serves a fresh file. A no-op when no rule matches or
 * the output is already fresh. Concurrent calls for the same output coalesce.
 *
 * @param {string} appDir
 * @param {string} relPath  appDir-relative served path, no leading slash (e.g. `public/tailwind.css`)
 * @param {RegenerateRule[]} rules
 * @param {{ spawn?: typeof nodeSpawn, now?: () => number }} [opts] injectables for tests
 * @returns {Promise<void>}
 */
export async function maybeRegenerate(appDir, relPath, rules, opts = {}) {
  const rule = rules && rules.find((r) => r.output === relPath);
  if (!rule) return;
  const key = appDir + '\0' + rule.output;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const spawn = opts.spawn || nodeSpawn;
  const run = (async () => {
    const outAbs = join(appDir, rule.output);
    let outMtime = 0;
    try {
      outMtime = (await stat(outAbs)).mtimeMs;
    } catch {
      outMtime = 0; // missing output: always stale
    }
    if (outMtime !== 0) {
      let newestSrc = 0;
      for (const inp of rule.inputs) {
        const m = await maxMtimeMs(join(appDir, inp));
        if (m > newestSrc) newestSrc = m;
      }
      if (newestSrc <= outMtime) return; // fresh, nothing to do
    }
    await runCommand(rule.command, appDir, spawn);
  })();
  inFlight.set(key, run);
  try {
    await run;
  } finally {
    inFlight.delete(key);
  }
}

/** Test-only: clear the in-flight coalescing map between cases. */
export function _resetInFlight() {
  inFlight.clear();
}
