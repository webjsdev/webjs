import { readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ROUTE_WALK_IGNORE } from '../route-modules.js';

/**
 * @typedef {import('../codes.js').DoctorResult} DoctorResult
 */

/** Routing stems, matching the server router's set. */
const ROUTING_STEM = /^(?:page|layout|route|error|loading|not-found|forbidden|unauthorized|global-error|global-not-found|middleware|template|default|sitemap|robots|manifest|icon|apple-icon|opengraph-image|twitter-image)\.(?:tsx|jsx)$/;

/**
 * Every routing file under `app/` written as `.tsx` / `.jsx`.
 * @param {string} dir
 * @param {string[]} [out]
 * @returns {string[]}
 */
export function collectJsxRouteFiles(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || ROUTE_WALK_IGNORE.has(e.name) || e.isSymbolicLink()) continue;
    if (e.isDirectory() && e.name.startsWith('_')) continue;
    const abs = join(dir, e.name);
    if (e.isDirectory()) collectJsxRouteFiles(abs, out);
    else if (ROUTING_STEM.test(e.name)) out.push(abs);
  }
  return out;
}

/**
 * Fail when a routing file is written as JSX (`page.tsx`, `layout.jsx`, the
 * Next.js default). WebJs has no build step, so the router never loads it and
 * the route silently does not exist. The server refuses to boot on the same
 * condition (`no-jsx-route-file`), so this is the pre-flight for it.
 *
 * @param {string} appDir
 * @returns {DoctorResult}
 */
export function checkJsxRouteFiles(appDir) {
  const name = 'jsx-route-files';
  const app = join(appDir, 'app');
  if (!existsSync(app)) return { name, status: 'pass', message: 'no app/ directory to analyse' };
  const found = collectJsxRouteFiles(app).map((f) => relative(appDir, f).split(sep).join('/'));
  if (!found.length) return { name, status: 'pass', message: 'no routing file is written as .tsx / .jsx' };
  return {
    name,
    status: 'fail',
    message: `routing files written as JSX are never loaded (no build step): ${found.join(', ')}`,
    fix: 'Rename each to .ts (or .js) and return an html`...` template from @webjsdev/core instead of JSX.',
  };
}
