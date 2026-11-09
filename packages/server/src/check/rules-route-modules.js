/**
 * Rules for the line between server-only route modules and browser code
 * (#1686). A page, layout or boundary runs only on the server, like a Next.js
 * server component, and never loads in a browser. These rules refuse the
 * shapes that would fail silently because of it: a component defined in a
 * route file (its tag never upgrades), an event binding in a route template
 * (its handler never runs), a browser module importing a route file (the
 * import 404s), and a Node builtin reached from browser code (it can never
 * resolve there).
 *
 * @module
 */
import { builtinModules } from 'node:module';
import { relative } from 'node:path';

import { maskComments, redactToPlaceholders } from '../js-scan.js';
import { EVENT_BINDING_RE } from '../component-elision.js';

/**
 * @typedef {import('./rules.js').Violation} Violation
 * @typedef {{ abs: string, rel: string, content: string, scan: string }} ScannedFile
 */

const BUILTINS = new Set(builtinModules);
const IMPORT_RE = /(?:^|[;\n])\s*(?:import|export)\s+(type\s+)?(?:[^'"`;]*?\s+from\s+)?['"]__STR_(\d+)__['"]/g;

/**
 * The first event binding that sits inside a real open tag. A binding written
 * as escaped text (`&lt;button @click=...`, a docs sample) is not one: the
 * nearest `<` before it must open a tag, with no `>` in between.
 * @param {string} src
 * @returns {{ index: number, text: string } | null}
 */
function firstTagBinding(src) {
  const re = new RegExp(EVENT_BINDING_RE.source, 'g');
  for (const m of src.matchAll(re)) {
    const lt = src.lastIndexOf('<', m.index);
    if (lt === -1 || src.lastIndexOf('>', m.index) > lt) continue;
    if (!/[A-Za-z]/.test(src[lt + 1] || '')) continue;
    return { index: /** @type {number} */ (m.index), text: m[0] };
  }
  return null;
}

/** 1-based line of `index` in `src`. */
const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/**
 * @param {string} appDir
 * @param {ScannedFile[]} files
 * @param {Violation[]} violations
 * @param {{ routeFiles: Set<string>, componentFiles: Set<string>, moduleGraph: Map<string, Set<string>>, shipped: Set<string> }} ctx
 */
export function checkRouteModuleBoundaries(appDir, files, violations, ctx) {
  const { routeFiles, componentFiles, moduleGraph, shipped } = ctx;
  for (const { abs, rel, content } of files) {
    if (routeFiles.has(abs)) {
      // --- no-component-in-route-module ---
      if (componentFiles.has(abs)) {
        violations.push({
          rule: 'no-component-in-route-module',
          file: rel,
          message: 'This page, layout or boundary defines a component. A route module runs only on the server and never loads in the browser, so the element renders its server markup and never upgrades.',
          fix: 'Move the component class into its own file (for example `components/my-widget.ts`) and import that file here.',
        });
      }
      // --- no-event-binding-in-route-module ---
      const masked = maskComments(content);
      const m = firstTagBinding(masked);
      if (m) {
        const binding = m.text.replace(/\s*=.*$/, '');
        violations.push({
          rule: 'no-event-binding-in-route-module',
          file: rel,
          message: `\`${binding}\` (line ${lineOf(masked, m.index)}) is bound in a page, layout or boundary template. A route module renders only on the server and never hydrates, so the handler never runs (the same reason Next.js refuses an event handler in a server component).`,
          fix: 'Put the interactive part in a component and render its tag here, or use a plain `<form action=${action}>` / `<a href>` that works without JavaScript.',
        });
      }
    }
    if (!shipped.has(abs) || routeFiles.has(abs)) continue;
    // --- no-route-module-import-in-browser-module ---
    for (const dep of moduleGraph.get(abs) || []) {
      if (!routeFiles.has(dep)) continue;
      violations.push({
        rule: 'no-route-module-import-in-browser-module',
        file: rel,
        message: `This module loads in the browser but imports the route module ${relative(appDir, dep)}. Pages, layouts and boundaries run only on the server, so the import 404s in the browser and this module fails to load.`,
        fix: 'Move what you need from the route module into a shared file (a helper under `lib/`, or a component) and import that from both.',
      });
      break;
    }
    // --- no-node-builtin-in-browser-module ---
    const { redacted, literals } = redactToPlaceholders(content);
    for (const im of redacted.matchAll(IMPORT_RE)) {
      if (im[1]) continue; // `import type` is erased
      const spec = literals[Number(im[2])];
      if (!spec || !(spec.startsWith('node:') || BUILTINS.has(spec))) continue;
      violations.push({
        rule: 'no-node-builtin-in-browser-module',
        file: rel,
        message: `This module loads in the browser but imports \`${spec}\` (line ${lineOf(redacted, im.index + (im[0].length - im[0].trimStart().length))}), a Node builtin that cannot resolve there, so the module fails to load.`,
        fix: 'Do the work on the server: read it in the page (pages run only on the server) and pass the result in as a property, or put it behind a `\'use server\'` action in a `.server.ts` file.',
      });
      break;
    }
  }
}
