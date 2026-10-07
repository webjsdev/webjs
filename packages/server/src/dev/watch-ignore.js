/**
 * Which changed paths the dev watcher must NOT turn into a rebuild and a
 * browser reload, beyond the framework's own artefacts (`shouldIgnoreWatchPath`
 * in server.js).
 *
 * The dev server watches the app root, so any file written there reached the
 * reload path, including files nothing serves. The common case is the server's
 * own output: `npm run dev > dev.log` makes every log line a reload, which wipes
 * streamed and live UI in the open page mid-check. So two more rules:
 *
 * - Build and tool output that is never served: `*.log`, `coverage/`, `.cache/`,
 *   `.nyc_output/`, `test-results/`, `playwright-report/`, `.turbo/`, editor swap
 *   and backup files, `.DS_Store`.
 * - Whatever the app's root `.gitignore` ignores. A gitignored file is by
 *   definition not part of the app's source. The one exception is `.env*`,
 *   which is gitignored on purpose but IS input the server reads, so its edits
 *   keep the behaviour they had.
 *
 * The `.gitignore` support is the common subset: comments, blank lines, `!`
 * negation, a trailing `/` for directories, a leading or inner `/` anchoring the
 * pattern to the root, and the `*`, `**` and `?` wildcards. Last match wins, and
 * a path is ignored when it or any directory above it is, as in git.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT = /(?:^|[\\/])(?:coverage|\.cache|\.nyc_output|test-results|playwright-report|\.turbo)(?:[\\/]|$)|\.log$|(?:^|[\\/])\.DS_Store$|\.swp$|~$/;

/**
 * Tool output that is never served, whatever `.gitignore` says.
 * @param {string} rel path relative to the app root
 * @returns {boolean}
 */
export function isUnservedOutput(rel) {
  return OUTPUT.test(rel || '');
}

/**
 * One `.gitignore` glob as a RegExp over a `/`-separated path.
 * @param {string} glob
 * @returns {RegExp}
 */
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/**
 * Parse `.gitignore` text into ordered rules.
 * @param {string} text
 * @returns {{ re: RegExp, negate: boolean, dirOnly: boolean, anchored: boolean }[]}
 */
export function parseGitignore(text) {
  const rules = [];
  for (let line of String(text || '').split(/\r?\n/)) {
    line = line.replace(/\s+$/, '');
    if (!line || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    if (!line) continue;
    rules.push({ re: globToRegExp(line), negate, dirOnly, anchored });
  }
  return rules;
}

/**
 * Whether `.gitignore` rules ignore `rel` (a file) or one of its directories.
 * @param {ReturnType<typeof parseGitignore>} rules
 * @param {string} rel
 * @param {boolean} [leafIsDir] the path itself is a directory (a created dir is reported by name)
 * @returns {boolean}
 */
export function isGitignored(rules, rel, leafIsDir = false) {
  if (!rules.length) return false;
  const parts = String(rel || '').replace(/\\/g, '/').replace(/^\.\//, '').split('/').filter(Boolean);
  for (let depth = 1; depth <= parts.length; depth++) {
    const path = parts.slice(0, depth).join('/');
    const name = parts[depth - 1];
    const isDir = depth < parts.length || leafIsDir;
    let ignored = false;
    for (const r of rules) {
      if (r.dirOnly && !isDir) continue;
      if (r.anchored ? r.re.test(path) : r.re.test(name)) ignored = !r.negate;
    }
    // A directory git ignores is never descended into, so a negation below it
    // cannot bring a file back.
    if (ignored && isDir) return true;
    if (depth === parts.length) return ignored;
  }
  return false;
}

/**
 * The extra watch filter for one app root: unserved output plus that root's
 * `.gitignore` (read once; `.env*` excluded).
 * @param {string} root
 * @returns {(rel: string) => boolean}
 */
export function createWatchIgnore(root) {
  let rules = [];
  try { rules = parseGitignore(readFileSync(join(root, '.gitignore'), 'utf8')); } catch { /* no .gitignore */ }
  return (rel) => {
    const p = String(rel || '').replace(/\\/g, '/');
    if (isUnservedOutput(p)) return true;
    if (/(?:^|\/)\.env(?:\.[^/]*)?$/.test(p)) return false;
    let dir = false;
    if (rules.length) { try { dir = statSync(join(root, p)).isDirectory(); } catch { /* gone or unreadable */ } }
    return isGitignored(rules, p, dir);
  };
}
