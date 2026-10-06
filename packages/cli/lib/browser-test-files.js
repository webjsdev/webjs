/**
 * Decide whether `webjs test --browser` has anything to run (#1491).
 *
 * web-test-runner throws `Could not find any test files with pattern(s)` when
 * its `files` globs match nothing, so an app with no browser tests yet (the
 * state `npm run gallery:clear` leaves behind) fails its own CI on the browser
 * layer. A missing layer is not a failing layer: the server layer already
 * passes with zero files, and the browser layer should too. WTR raises the
 * error while building its session groups, after it has started, so the check
 * has to happen here, before it is spawned.
 *
 * The globs are read from the config's SOURCE rather than by importing it,
 * because the scaffold's config top-level-awaits a warmed webjs handler (the
 * whole app boots) just to answer a question a file walk can answer. When the
 * `files` value is not a plain literal (computed, imported, spread), the
 * patterns come back `null` and the caller runs WTR exactly as before, so a
 * config this reader does not understand never turns into a silent skip.
 *
 * @module browser-test-files
 */
import { readdir } from 'node:fs/promises';
import { join, relative, sep, matchesGlob } from 'node:path';

/**
 * Pull the `files` globs out of a web-test-runner config's source text.
 * Accepts `files: 'one/glob'` and `files: ['a', "b", ...]` with only string
 * literals inside the array. Anything else returns `null` (unknown).
 *
 * @param {string} source
 * @returns {string[] | null}
 */
export function readWtrFilePatterns(source) {
  // Strip line + block comments first, so a commented-out `files:` cannot
  // match and a comment inside the array does not read as a non-literal.
  const code = stripComments(source);
  const single = code.match(/\bfiles\s*:\s*(['"])([^'"]+)\1\s*[,}\n]/);
  if (single) return [single[2]];
  const arr = code.match(/\bfiles\s*:\s*\[([\s\S]*?)\]/);
  if (!arr) return null;
  const body = arr[1].trim();
  if (body === '') return [];
  const out = [];
  // Every comma-separated element must be a quoted string literal.
  for (const raw of body.split(',')) {
    const el = raw.trim();
    if (el === '') continue; // trailing comma
    const m = el.match(/^(['"])([^'"]*)\1$/);
    if (!m) return null;
    out.push(m[2]);
  }
  return out;
}

/**
 * Walk `cwd` and return the app-relative paths (forward slashes) matching
 * the include globs and none of the `!`-prefixed exclude globs. Skips
 * `node_modules` and dot directories, which WTR's globber skips too.
 *
 * @param {string} cwd
 * @param {string[]} patterns
 * @returns {Promise<string[]>}
 */
export async function findBrowserTestFiles(cwd, patterns) {
  const include = patterns.filter((p) => !p.startsWith('!')).map(normalize);
  const exclude = patterns.filter((p) => p.startsWith('!')).map((p) => normalize(p.slice(1)));
  if (include.length === 0) return [];
  const found = [];
  const walk = async (dir) => {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      const full = join(dir, ent.name);
      if (ent.isDirectory()) { await walk(full); continue; }
      if (!ent.isFile()) continue;
      const rel = relative(cwd, full).split(sep).join('/');
      if (include.some((g) => matchesGlob(rel, g)) && !exclude.some((g) => matchesGlob(rel, g))) {
        found.push(rel);
      }
    }
  };
  await walk(cwd);
  return found;
}

/**
 * Remove `//` and `/* *\/` comments while leaving string literals intact. A
 * regex strip is not enough: a glob such as `test/**\/browser` contains the
 * very `/*` that opens a block comment.
 *
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
  let out = '';
  let quote = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      out += c;
      if (c === '\\') { out += src[++i] ?? ''; continue; }
      if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    out += c;
  }
  return out;
}

/** @param {string} p */
function normalize(p) {
  return p.replace(/^\.\//, '');
}
