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
  // A routing file written as `.tsx` / `.jsx`: JSX needs a build step, so the
  // router never sees it and the route silently does not exist.
  for (const file of table.ignoredJsx || []) {
    const r = rel(appDir, file);
    const ts = r.replace(/\.(t|j)sx$/, (_, t) => `.${t}s`);
    problems.push({
      rule: 'no-jsx-route-file',
      file: r,
      message: `${r} is a routing file written as JSX, which WebJs never loads (there is no build step), so this route does not exist.`,
      fix: `Rename it to ${ts} and return an html\`...\` template from @webjsdev/core instead of JSX (interactive parts become a WebComponent).`,
    });
  }
  return problems;
}

/** The fix every CSS-import refusal names. */
export const CSS_IMPORT_FIX = 'Load a stylesheet with <link rel="stylesheet" href="..."> in the root layout (Tailwind\'s output included), or scope CSS to a component with `static styles = css`...`` and `static shadow = true`.';

/**
 * Every `import './x.css'` in the app's module graph, as layout problems. A
 * CSS import is a bundler feature: Node refuses the extension, Bun silently
 * turns it into a no-op on the server, and the browser refuses a stylesheet as
 * a module script, so the importing module never loads there.
 * @param {Map<string, Set<string>>} graph
 * @param {(abs: string) => string} rel
 * @returns {LayoutProblem[]}
 */
export function cssImportProblems(graph, rel) {
  /** @type {LayoutProblem[]} */
  const out = [];
  for (const [file, deps] of graph) {
    if (/[\\/]node_modules[\\/]/.test(file)) continue;
    for (const dep of deps) {
      if (!/\.css$/i.test(dep)) continue;
      out.push({
        rule: 'no-css-import',
        file: rel(file),
        message: `Imports ${rel(dep)}, a stylesheet. WebJs has no bundler: the import fails on Node, is silently dropped on Bun, and stops the module from loading in the browser.`,
        fix: CSS_IMPORT_FIX,
      });
    }
  }
  return out;
}
