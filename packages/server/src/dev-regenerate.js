/**
 * Build outputs that rebuild themselves when stale (#967), and the record of
 * what each one was built from (#1672).
 *
 * A UI scaffold compiles a STATIC `public/tailwind.css` (#947) so the app is
 * fully styled with JavaScript OFF (progressive enhancement, invariant 1). In
 * DEV the classic shape was a long-lived `tailwindcss --watch` in
 * `dev.parallel`, but a watch that dies mid-session, lags, or never starts then
 * serves STALE or MISSING CSS with no error: a newly added utility class has no
 * backing rule, so the app renders unstyled locally while prod is fine.
 *
 * This module removes that foot-gun by regenerating the output ON REQUEST when
 * it is stale. It is deliberately GENERIC and styling-agnostic: it runs whatever
 * command the app declares, keyed by the output path, so the framework stays
 * BYO-styling (the Tailwind knowledge lives in the app's `package.json`).
 *
 * Declared as `webjs.dev.regenerate` in the app's `package.json`:
 *   "webjs": { "dev": { "regenerate": [
 *     { "output": "public/tailwind.css",
 *       "command": "tailwindcss -i ./public/input.css -o ./public/tailwind.css --minify",
 *       "inputs": ["app", "components", "modules", "lib", "public/input.css"] }
 *   ] } }
 *
 * FRESHNESS IS A RECORD, NOT AN MTIME ORDERING (#1672). Every build this module
 * runs records, in `.webjs/regenerate.json`, the command it ran, a fingerprint
 * of its inputs taken BEFORE the command started, and a fingerprint of the
 * output it produced. An output is fresh exactly when all three still match.
 * This is the shape of Ninja's `.ninja_log` (which records per output the
 * command hash and the mtime it was built against, so a `restat` output a rule
 * left untouched is not rebuilt) and of Vite's dep optimizer
 * (`node_modules/.vite/deps/_metadata.json`, a lockfile and config hash compared
 * on startup). Comparing mtimes instead, as Make does, fails three ways that all
 * bit here: a compiler that skips writing unchanged bytes (the Tailwind CLI)
 * leaves the output older than its inputs forever, an input dated in the future
 * hides every later edit, and a deleted input is invisible. Equality of a
 * recorded fingerprint has none of those failure modes.
 *
 * The same rules run outside the dev server through `webjs regenerate` (the
 * CLI), which an app puts in `dev.before` / `start.before` in place of a raw
 * compile, so every build path writes the one record and `webjs doctor` reads
 * it. A build by hand (`npm run css:build`) writes no record, so the output
 * reads as unrecorded and is rebuilt once on its next request.
 */

import { spawn as nodeSpawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join, relative, sep } from 'node:path';

/**
 * @typedef {{ output: string, command: string, inputs: string[] }} RegenerateRule
 * @typedef {{ command: string, inputs: string, output: string }} RegenerateRecord
 * @typedef {{ version: 1, outputs: Record<string, RegenerateRecord> }} RegenerateManifest
 * @typedef {'fresh' | 'stale' | 'missing' | 'unrecorded'} RegenerateState
 * @typedef {{ ok: true } | { ok: false, reason: 'failed' | 'no-output' }} BuildResult
 * @typedef {{ spawn?: typeof nodeSpawn, warn?: (msg: string) => void }} BuildOptions
 */

/** The record of every build, relative to the app root. */
export const REGENERATE_MANIFEST = '.webjs/regenerate.json';

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

// Directories never worth walking for a source fingerprint: build output,
// dependencies, VCS + framework caches. Skipping them keeps the walk cheap and
// avoids treating a dependency's mtime as an app-source edit.
const IGNORE_DIRS = new Set(['node_modules', '.git', '.webjs', 'dist', '.next', 'coverage']);

/**
 * Append one line per FILE under `abs` to `lines`: its appDir-relative path,
 * size and mtime. A missing path contributes a `missing` line, so creating it
 * later changes the fingerprint. Skips IGNORE_DIRS, dotfiles and symlinks (a
 * symlink can cycle into unbounded recursion or escape into node_modules).
 * Directory-node mtimes are not counted: an addition or a deletion already
 * shows as a line appearing or disappearing. Pure I/O, no throw.
 *
 * @param {string} appDir
 * @param {string} abs
 * @param {string[]} lines
 * @returns {Promise<void>}
 */
async function collectFiles(appDir, abs, lines) {
  const rel = relative(appDir, abs).split(sep).join('/');
  let st;
  try {
    st = await stat(abs);
  } catch {
    lines.push(`${rel}\0missing`);
    return;
  }
  if (!st.isDirectory()) {
    lines.push(`${rel}\0${st.size}\0${st.mtimeMs}`);
    return;
  }
  let entries;
  try {
    entries = await readdir(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || IGNORE_DIRS.has(e.name)) continue;
    if (e.isSymbolicLink()) continue;
    await collectFiles(appDir, join(abs, e.name), lines);
  }
}

/**
 * A fingerprint of every file under a rule's `inputs`: a hash over each file's
 * path, size and mtime, so an edit, an addition, a deletion and a rename all
 * change it. Compared for EQUALITY, never ordering, so a file dated in the
 * future is just another value and later edits still change the result.
 *
 * The rule's own `output` is left out even when an input directory contains it
 * (`inputs: ["public"]` around `public/tailwind.css`): every build rewrites the
 * output, so counting it would make each build invalidate itself.
 *
 * A command must not rewrite files under its own `inputs` with unchanged
 * bytes, for the same reason: a prepare step inside the command (a copy into
 * an input directory) has to compare before writing. One that writes a file
 * whose content did change costs a single extra rebuild, which then settles.
 *
 * @param {string} appDir
 * @param {RegenerateRule} rule
 * @returns {Promise<string>}
 */
export async function inputFingerprint(appDir, rule) {
  /** @type {string[]} */
  const lines = [];
  for (const inp of rule.inputs) await collectFiles(appDir, join(appDir, inp), lines);
  const self = rule.output + '\0';
  const own = lines.filter((l) => !l.startsWith(self)).sort();
  return createHash('sha256').update(own.join('\n')).digest('hex');
}

/**
 * The output's size and mtime, read right after a build and compared on every
 * check, so a hand edit, a delete, or a different build replacing the file all
 * read as stale. `null` when the output does not exist.
 *
 * @param {string} abs
 * @returns {Promise<string | null>}
 */
async function outputFingerprint(abs) {
  try {
    const st = await stat(abs);
    return st.isFile() ? `${st.size}:${st.mtimeMs}` : null;
  } catch {
    return null;
  }
}

/**
 * Read the build record. A missing, malformed, or other-version file reads as
 * empty, which makes every output unrecorded and rebuilds it once: the safe
 * direction.
 *
 * @param {string} appDir
 * @returns {Promise<RegenerateManifest>}
 */
export async function readRegenerateManifest(appDir) {
  try {
    const m = JSON.parse(await readFile(join(appDir, REGENERATE_MANIFEST), 'utf8'));
    if (m && m.version === 1 && m.outputs && typeof m.outputs === 'object') return m;
  } catch {
    // fall through
  }
  return { version: 1, outputs: {} };
}

// Writes to one manifest, chained per path. Parallel requests for different
// outputs (the website's /ui page links nine stylesheets) each record a build;
// unserialized, those read-modify-writes would drop each other's entries. A
// dev server and a concurrent `webjs regenerate` are separate processes and can
// still lose one entry, which costs one extra rebuild: the safe direction.
/** @type {Map<string, Promise<void>>} */
const manifestWrites = new Map();
let tmpCounter = 0;

/**
 * Record one build, read-modify-write, written to a temp file and renamed so a
 * reader never sees a half-written manifest. Never throws: a read-only
 * filesystem (a locked-down prod image) must still serve, it only loses the
 * record and rebuilds again.
 *
 * @param {string} appDir
 * @param {string} output
 * @param {RegenerateRecord} record
 * @param {(msg: string) => void} warn
 * @returns {Promise<void>}
 */
function recordBuild(appDir, output, record, warn) {
  const path = join(appDir, REGENERATE_MANIFEST);
  const prev = manifestWrites.get(path) || Promise.resolve();
  const next = prev.then(async () => {
    try {
      const manifest = await readRegenerateManifest(appDir);
      manifest.outputs[output] = record;
      await mkdir(dirname(path), { recursive: true });
      const tmp = `${path}.${process.pid}.${++tmpCounter}.tmp`;
      await writeFile(tmp, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      await rename(tmp, path);
    } catch (err) {
      warn(`[webjs] regenerate: could not record the build of ${output} in ${REGENERATE_MANIFEST} (${/** @type {Error} */ (err).message}); it will be rebuilt on its next request.`);
    }
  });
  manifestWrites.set(path, next);
  return next.finally(() => {
    if (manifestWrites.get(path) === next) manifestWrites.delete(path);
  });
}

/**
 * Whether a rule's output is fresh against the record. Cheapest test first: a
 * missing output or a missing record needs no input walk at all, and neither
 * does a changed command or an output something else rewrote. Only a record
 * that matches on all of those walks the inputs.
 *
 * @param {string} appDir
 * @param {RegenerateRule} rule
 * @param {RegenerateManifest} [manifest]
 * @returns {Promise<{ state: RegenerateState, inputs?: string }>} `inputs` is the
 *   fingerprint when the check computed it, so a build can record it unwalked.
 */
export async function regenerateState(appDir, rule, manifest) {
  const out = await outputFingerprint(join(appDir, rule.output));
  if (out === null) return { state: 'missing' };
  const record = (manifest || await readRegenerateManifest(appDir)).outputs[rule.output];
  if (!record) return { state: 'unrecorded' };
  if (record.command !== rule.command || record.output !== out) return { state: 'stale' };
  const inputs = await inputFingerprint(appDir, rule);
  return { state: record.inputs === inputs ? 'fresh' : 'stale', inputs };
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
 * Run a regenerate command to completion and resolve its exit code: `null` for
 * a spawn error or a child killed by a signal, so an interrupted compile is
 * never recorded. Never rejects: a compile failure is logged by the tool's own
 * inherited stderr.
 *
 * @param {string} command
 * @param {string} cwd
 * @param {typeof nodeSpawn} spawn
 * @returns {Promise<number | null>}
 */
function runCommand(command, cwd, spawn) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, stdio: 'inherit', cwd, env: envWithLocalBin(cwd) });
    // A Promise settles once, so whichever of these fires second is ignored.
    child.on('exit', (code) => resolve(typeof code === 'number' ? code : null));
    child.on('error', () => resolve(null));
  });
}

/**
 * Move a file, falling back to copy + delete across filesystems (`.webjs` may
 * be a link onto another volume). Resolves false when there is nothing to move.
 *
 * @param {string} from
 * @param {string} to
 * @returns {Promise<boolean>}
 */
async function moveFile(from, to) {
  try {
    await rename(from, to);
    return true;
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return false;
    await copyFile(from, to);
    await unlink(from);
    return true;
  }
}

/**
 * Run a rule's command and record what it built.
 *
 * The output is moved aside into `.webjs/regenerate/` first, so the command has
 * to WRITE it: a compiler that skips an unchanged write (the Tailwind CLI reads
 * the existing file and returns early) writes a missing one. That makes the
 * outcome decisive. Exit 0 with the output present is recorded. Exit 0 with no
 * output means the rule's `output` is not the path its command writes, so the
 * previous output is restored, nothing is recorded, and a warning names the
 * rule, which repeats on every request until the rule is fixed. A failed or
 * interrupted command restores the previous output (a last good stylesheet
 * beats a partial one) and records nothing, so the next request retries.
 *
 * @param {string} appDir
 * @param {RegenerateRule} rule
 * @param {BuildOptions & { inputs?: string }} [opts] `inputs`: a fingerprint
 *   already taken by `regenerateState`, so the build does not walk twice
 * @returns {Promise<BuildResult>}
 */
export async function buildRegenerateOutput(appDir, rule, opts = {}) {
  const spawn = opts.spawn || nodeSpawn;
  const warn = opts.warn || ((m) => console.warn(m));
  // The snapshot is taken BEFORE the command runs, so a file saved during the
  // compile no longer matches the record and the next check rebuilds.
  const inputs = opts.inputs ?? await inputFingerprint(appDir, rule);
  const outAbs = join(appDir, rule.output);
  const backupDir = join(appDir, '.webjs', 'regenerate');
  const backup = join(backupDir, encodeURIComponent(rule.output));
  await mkdir(backupDir, { recursive: true });
  await rm(backup, { force: true }); // a leftover from an interrupted process
  const hadOutput = await moveFile(outAbs, backup);

  const code = await runCommand(rule.command, appDir, spawn);
  const output = code === 0 ? await outputFingerprint(outAbs) : null;
  if (output !== null) {
    await rm(backup, { force: true });
    await recordBuild(appDir, rule.output, { command: rule.command, inputs, output }, warn);
    return { ok: true };
  }
  if (hadOutput) await moveFile(backup, outAbs);
  if (code === 0) {
    warn(`[webjs] regenerate: \`${rule.command}\` exited 0 but did not write ${rule.output}. Check that the rule's "output" is the path its command writes.`);
    return { ok: false, reason: 'no-output' };
  }
  return { ok: false, reason: 'failed' };
}

// In-flight builds, keyed by appDir + output, so concurrent requests for the
// same stale output share ONE compile instead of racing N of them. Module-scope
// (not per-handler): the filesystem is the shared resource being guarded.
const inFlight = new Map();

/**
 * If a regenerate rule matches `relPath` and its output is not fresh against
 * the record, build it before returning, so the caller serves a fresh file. A
 * no-op when no rule matches or the output is fresh. Concurrent calls for the
 * same output coalesce. Never rejects: a failed build leaves the previous
 * output on disk to be served.
 *
 * @param {string} appDir
 * @param {string} relPath  appDir-relative served path, no leading slash (e.g. `public/tailwind.css`)
 * @param {RegenerateRule[]} rules
 * @param {BuildOptions} [opts] injectable spawn and warning sink for tests
 * @returns {Promise<void>}
 */
export async function maybeRegenerate(appDir, relPath, rules, opts = {}) {
  const rule = rules && rules.find((r) => r.output === relPath);
  if (!rule) return;
  const key = appDir + '\0' + rule.output;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const run = (async () => {
    const { state, inputs } = await regenerateState(appDir, rule);
    if (state === 'fresh') return;
    await buildRegenerateOutput(appDir, rule, { ...opts, inputs });
  })().catch((err) => {
    (opts.warn || console.warn)(`[webjs] regenerate: building ${rule.output} failed (${err && err.message}); serving what is on disk.`);
  });
  inFlight.set(key, run);
  try {
    await run;
  } finally {
    inFlight.delete(key);
  }
}

/**
 * Build every rule whose output is not fresh, one at a time, and report each.
 * The engine behind `webjs regenerate`, which an app runs in `dev.before` /
 * `start.before` (or a CI step) so a build outside the dev server records its
 * freshness the same way a dev request does. `force` rebuilds every rule.
 *
 * @param {string} appDir
 * @param {{ force?: boolean, rules?: RegenerateRule[] } & BuildOptions} [opts]
 * @returns {Promise<Array<{ output: string, state: RegenerateState, built: boolean } & ({ ok: true } | { ok: false, reason: 'failed' | 'no-output' })>>}
 */
export async function regenerateOutputs(appDir, opts = {}) {
  const rules = opts.rules || await readRegenerateRules(appDir);
  const results = [];
  for (const rule of rules) {
    const { state, inputs } = await regenerateState(appDir, rule);
    if (state === 'fresh' && !opts.force) {
      results.push({ output: rule.output, state, built: false, ok: /** @type {const} */ (true) });
      continue;
    }
    const r = await buildRegenerateOutput(appDir, rule, { ...opts, inputs });
    results.push({ output: rule.output, state, built: true, ...r });
  }
  return results;
}

/**
 * Every rule's state against the record, without building anything. What
 * `webjs doctor` reads, so the doctor and the dev server share one definition
 * of fresh.
 *
 * @param {string} appDir
 * @returns {Promise<Array<{ output: string, command: string, state: RegenerateState }>>}
 */
export async function regenerateStatus(appDir) {
  const rules = await readRegenerateRules(appDir);
  const manifest = await readRegenerateManifest(appDir);
  const out = [];
  for (const rule of rules) {
    const { state } = await regenerateState(appDir, rule, manifest);
    out.push({ output: rule.output, command: rule.command, state });
  }
  return out;
}

/**
 * Whether a dev-watcher filename is a regenerate OUTPUT (#967). A regenerate
 * output is a build product the dev server itself writes on request, so a write
 * to it must NOT trigger a rebuild + SSE reload: that would spuriously reload
 * the page mid-navigation (breaking a soft-nav / streaming interaction) and,
 * worse, could reload -> refetch -> recompile -> reload. Same rationale as the
 * `db/dev.db` carve-out in `shouldIgnoreWatchPath`, which also skips `.webjs/`,
 * where the record and the moved-aside output live. `fs.watch` reports a path
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
