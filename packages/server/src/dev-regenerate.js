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
 *
 * A successful run then STAMPS the output (#1672). A compiler may leave an
 * output whose bytes did not change untouched (the Tailwind CLI does), so after
 * an edit that adds no class the output would keep its old mtime and every
 * later request would recompile it. The stamp records the build the way Ninja's
 * `restat` does: the output's mtime is raised to the newest input mtime measured
 * BEFORE the command ran, never to the wall clock after it, so an input edited
 * during the compile still reads as newer and the next request rebuilds.
 */

import { spawn as nodeSpawn } from 'node:child_process';
import { readFile, stat, readdir, utimes } from 'node:fs/promises';
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
 * Newest mtime (ms) of any FILE under a path: the file's own mtime, or the max
 * over the files in a directory tree (skipping IGNORE_DIRS and dotfiles). A
 * missing path is 0, so it never makes the output look stale.
 *
 * Directory-node mtimes are deliberately NOT counted: a directory's mtime bumps
 * on a file add/remove but NOT on a content edit, so a content edit (the case
 * that matters, a new utility class in an existing file) is only visible through
 * the FILE mtime. Counting a new file's own mtime still catches an addition;
 * only a pure deletion is missed, which is harmless (stale rules self-heal on
 * the next real edit) and keeps the freshness check deterministic (a directory
 * mtime is a moving target that made the comparison flaky across runtimes).
 * Pure I/O, no throw.
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
  let newest = 0;
  let entries;
  try {
    entries = await readdir(abs, { withFileTypes: true });
  } catch {
    return newest;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || IGNORE_DIRS.has(e.name)) continue;
    // Skip symlinks entirely: following one can cycle (a link back to an
    // ancestor) into unbounded recursion, or escape into node_modules via a
    // renamed link. A symlinked source file is rare in an app tree; not
    // counting its mtime is a safe tradeoff for a walk that cannot hang.
    if (e.isSymbolicLink()) continue;
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
 * Run a regenerate command to completion and resolve its exit code. Never
 * rejects: a compile failure is logged by the tool's own inherited stderr and
 * resolves non-zero (a spawn `error` or a signal resolves `null`), and the
 * caller then serves whatever is on disk, degrading to the previous behaviour
 * rather than 500ing the request.
 *
 * @param {string} command
 * @param {string} cwd
 * @param {typeof nodeSpawn} spawn
 * @returns {Promise<number | null>}
 */
function runCommand(command, cwd, spawn) {
  return new Promise((resolve) => {
    let settled = false;
    /** @param {number | null} code */
    const done = (code) => {
      if (settled) return;
      settled = true;
      resolve(code);
    };
    const child = spawn(command, { shell: true, stdio: 'inherit', cwd, env: envWithLocalBin(cwd) });
    child.on('exit', (code) => done(typeof code === 'number' ? code : null));
    child.on('error', () => done(null));
  });
}

// How far past the input snapshot a stamp lands, in ms. `utimes` takes the time
// as floating-point SECONDS, and at today's epoch a double rounds that to about
// a tenth of a microsecond, so a stamp of exactly the snapshot (whose `mtimeMs`
// carries a nanosecond fraction on ext4 / APFS) can read back a hair BELOW it
// and leave the output stale. Two whole milliseconds clear any fraction plus the
// rounding. The cost is a 2 ms window: an input edited within 2 ms of the newest
// pre-compile edit, and during the compile, would not reread as newer.
const STAMP_MARGIN_MS = 2;

/**
 * Record that an output was built against inputs whose newest mtime is
 * `builtAgainstMs` (#1672). A no-op when the command rewrote the output (its
 * mtime is already past the inputs), when the output is missing, or when the
 * rule has no inputs. Pure I/O, no throw: a failed stamp only costs one more
 * rebuild on the next request.
 *
 * @param {string} outAbs
 * @param {number} builtAgainstMs
 * @returns {Promise<void>}
 */
async function stampOutput(outAbs, builtAgainstMs) {
  if (!(builtAgainstMs > 0)) return;
  try {
    const st = await stat(outAbs);
    if (st.mtimeMs > builtAgainstMs) return;
    const mtimeMs = Math.floor(builtAgainstMs) + STAMP_MARGIN_MS;
    await utimes(outAbs, st.atimeMs / 1000, mtimeMs / 1000);
  } catch {
    // Missing or read-only output: nothing to record.
  }
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
 * @param {{ spawn?: typeof nodeSpawn }} [opts] injectable spawn for tests
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
    // Snapshot the newest input BEFORE the command runs: it is both the
    // staleness test and the value a successful build is stamped with.
    let newestSrc = 0;
    for (const inp of rule.inputs) {
      const m = await maxMtimeMs(join(appDir, inp));
      if (m > newestSrc) newestSrc = m;
    }
    if (outMtime !== 0 && newestSrc <= outMtime) return; // fresh, nothing to do
    const code = await runCommand(rule.command, appDir, spawn);
    // Only a clean exit is recorded: stamping after a failure would mark a
    // broken compile fresh until an input changed again.
    if (code === 0) await stampOutput(outAbs, newestSrc);
  })();
  inFlight.set(key, run);
  try {
    await run;
  } finally {
    inFlight.delete(key);
  }
}

/**
 * Whether a dev-watcher filename is a regenerate OUTPUT (#967). A regenerate
 * output is a build product the dev server itself writes on request, so a write
 * to it must NOT trigger a rebuild + SSE reload: that would spuriously reload
 * the page mid-navigation (breaking a soft-nav / streaming interaction) and,
 * worse, could reload -> refetch -> recompile -> reload. Same rationale as the
 * `db/dev.db` carve-out in `shouldIgnoreWatchPath`. `fs.watch` reports a path
 * relative to the watched root with OS separators, so it is normalized to `/`
 * before matching the rule's already-normalized `output`.
 *
 * @param {string} filename  `event.filename` from the dev watcher (root-relative)
 * @param {RegenerateRule[]} rules
 * @returns {boolean}
 */
export function isRegenerateOutputPath(filename, rules) {
  if (!filename || !rules || !rules.length) return false;
  const norm = String(filename).replace(/\\/g, '/');
  return rules.some((r) => r.output === norm);
}

/** Test-only: clear the in-flight coalescing map between cases. */
export function _resetInFlight() {
  inFlight.clear();
}
