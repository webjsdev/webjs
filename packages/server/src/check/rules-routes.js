/**
 * Rule: `no-conflicting-routes` (#1686). Two files that resolve to ONE url, the
 * two conflicts Next.js fails the build on:
 *
 *   - two pages, typically in different route groups (`app/(marketing)/page.ts`
 *     and `app/(app)/page.ts` both serve `/`), or the same dynamic position
 *     spelled with different param names (`[id]` beside `[slug]`);
 *   - a `page` and a `route` handler at the same url.
 *
 * WebJs used to accept either silently and serve whichever the matcher met
 * first, so one of the two files was dead code that looked live.
 *
 * @module
 */
import { relative, sep } from 'node:path';
import { buildRouteTable } from '../router.js';

/**
 * @param {string} appDir
 * @param {import('./rules.js').Violation[]} violations
 */
export async function checkNoConflictingRoutes(appDir, violations) {
  let table;
  try { table = await buildRouteTable(appDir); } catch { return; }
  const rel = (f) => relative(appDir, f).split(sep).join('/');
  /** @type {Map<string, string[]>} url pattern -> page files */
  const pages = new Map();
  for (const p of table.pages || []) {
    const key = p.pattern.source;
    if (!pages.has(key)) pages.set(key, []);
    pages.get(key).push(rel(p.file));
  }
  for (const files of pages.values()) {
    if (files.length < 2) continue;
    const [first, ...rest] = files.sort();
    for (const file of rest) {
      violations.push({
        rule: 'no-conflicting-routes',
        file,
        message: `This page resolves to the same URL as ${first} (route groups and param names do not change a URL), so only one of them can ever be served. Next.js refuses this at build time.`,
        fix: 'Give one of the pages a different path, merge the two, or, for a dynamic segment, use one param name at that position.',
      });
    }
  }
  for (const api of table.apis || []) {
    const page = pages.get(api.pattern.source);
    if (!page) continue;
    violations.push({
      rule: 'no-conflicting-routes',
      file: rel(api.file),
      message: `This route handler shares its URL with the page ${page[0]}, so one of them is never reached. Next.js refuses a page and a route at the same path.`,
      fix: 'Move the handler under app/api/ (or another path no page uses), or turn the page into the handler.',
    });
  }
}
