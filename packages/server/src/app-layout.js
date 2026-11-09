/**
 * App layout validation: file arrangements that can never serve correctly,
 * found from the route table alone (no code is loaded).
 *
 * Next.js refuses these at build time. WebJs has no build, so the same
 * refusal happens in three places, all fed by `validateAppLayout`:
 *   - `webjs check` reports each problem as a violation (its `rule` id);
 *   - production refuses to boot (`createRequestHandler` throws);
 *   - dev answers every app request with a 500 naming the problem and pushes
 *     it to the error overlay, until an edit fixes it.
 *
 * @module app-layout
 */
import { relative, sep } from 'node:path';

/**
 * @typedef {{ rule: string, file: string, message: string, fix: string }} LayoutProblem
 */

/**
 * The thrown form of one or more layout problems. `code` lets the request
 * handler tell it apart from an ordinary analysis failure.
 */
export class AppLayoutError extends Error {
  /** @param {LayoutProblem[]} problems */
  constructor(problems) {
    super(problems.map((p) => `[${p.rule}] ${p.file}: ${p.message} Fix: ${p.fix}`).join('\n'));
    this.name = 'AppLayoutError';
    this.code = 'WEBJS_APP_LAYOUT';
    this.problems = problems;
  }
}

/**
 * @param {string} appDir
 * @param {string} file
 */
function rel(appDir, file) {
  return relative(appDir, file).split(sep).join('/');
}

/**
 * Every layout problem in the app, in a stable order.
 *
 * @param {string} appDir
 * @param {import('./router.js').RouteTable} table
 * @returns {LayoutProblem[]}
 */
export function validateAppLayout(appDir, table) {
  /** @type {LayoutProblem[]} */
  const problems = [];

  // A page and a route handler answering the same URL. Next refuses this
  // ("Conflicting route and page"); WebJs used to let the route handler win
  // silently, so the page never rendered.
  for (const c of table.conflicts || []) {
    problems.push({
      rule: 'no-page-route-conflict',
      file: rel(appDir, c.route),
      message: `${rel(appDir, c.page)} and ${rel(appDir, c.route)} both answer ${c.url}, so the page can never render.`,
      fix: 'Keep one: move the route handler to its own folder (for example app/api/...), or delete the page.',
    });
  }
  return problems;
}
