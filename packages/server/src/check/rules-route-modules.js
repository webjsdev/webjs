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
import { hasUseServerDirective } from './helpers.js';
import { EVENT_BINDING_RE, REACTIVE_IMPORTS, extractRenderedTags } from '../client-signals.js';

/**
 * @typedef {import('./rules.js').Violation} Violation
 * @typedef {{ abs: string, rel: string, content: string, scan: string }} ScannedFile
 */

const BUILTINS = new Set(builtinModules);
const SERVER_FILE_RE = /\.server\.m?[jt]s$/;
/** A registration with a literal tag: `X.register('tag')` or `customElements.define('tag', X)`. */
const REGISTER_RE = /(?:\.register|customElements\.define)\(\s*(['"])([a-z][a-z0-9]*-[a-z0-9-]*)\1/g;
/** Lifecycle hooks that only ever run in a browser (`willUpdate` also runs during SSR, so it is not here). */
const CLIENT_ONLY_HOOKS = ['connectedCallback', 'disconnectedCallback', 'attributeChangedCallback', 'adoptedCallback',
  'firstUpdated', 'updated', 'renderFallback', 'scheduleUpdate', 'performUpdate'];
const HOOK_RE = new RegExp(`^\\s*(?:async\\s+)?(${CLIENT_ONLY_HOOKS.join('|')})\\s*\\(`, 'm');
/** A named import of a reactive primitive from core: `import { signal } from '@webjsdev/core'`. */
const CORE_NAMED_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]@webjsdev\/core(?:\/[a-z-]+)?['"]/g;
/** A `'use client'` directive in a module's prologue (comments and blank lines may precede it). */
const USE_CLIENT_RE = /^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*(['"])use client\1\s*;?/;
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
  // Tags registered by components in `*.server.*` files: rendered on the
  // server, never defined in the browser (#1686).
  /** @type {Map<string, string>} tag -> the file that registers it */
  const serverTags = new Map();
  for (const { rel, content } of files) {
    if (!SERVER_FILE_RE.test(rel) || !/extends\s+WebComponent\b/.test(content)) continue;
    // --- no-component-in-use-server-file ---
    // Every function export of a `'use server'` file is wrapped as an action
    // (a class is a function), so a component there is neither a component
    // nor a usable action.
    if (hasUseServerDirective(content)) {
      violations.push({
        rule: 'no-component-in-use-server-file',
        file: rel,
        message: "This `'use server'` file defines a component. Every function export of a `'use server'` file is wrapped as a server action, and a class is a function, so the component is neither a working component nor a usable action.",
        fix: "Drop `'use server'` to make it a server-only component (a component in a `.server` file without the directive renders on the server and ships nothing), or move the class to an ordinary file to make it a component that runs in the browser. Keep the actions in their own `'use server'` file.",
      });
      continue;
    }
    for (const m of maskComments(content).matchAll(REGISTER_RE)) serverTags.set(m[2], rel);
    checkServerComponent(rel, content, violations);
  }
  for (const { abs, rel, content } of files) {
    if (routeFiles.has(abs)) {
      // --- no-use-client-in-route-module ---
      // The Next.js way to make a page interactive. In WebJs the client part
      // is a component (Lit's APIs), so the directive maps to one message
      // rather than a page model neither habit predicts. In a component file
      // the directive is true already and is left alone.
      if (USE_CLIENT_RE.test(content)) {
        violations.push({
          rule: 'no-use-client-in-route-module',
          file: rel,
          message: "`'use client'` marks this page, layout or boundary as client code, the Next.js way. In WebJs a route module is always a server component and the client part of a page is a component, so the directive does nothing here.",
          fix: "Move the interactive part into a component in its own file (`components/my-widget.ts`, a `WebComponent` using Lit's APIs: reactive properties, `@click`, the lifecycle), render its tag from this page, and drop `'use client'`. Pass server data in as properties.",
        });
      }
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
    // --- no-server-component-in-client-template ---
    if (serverTags.size) {
      for (const tag of extractRenderedTags(content)) {
        const owner = serverTags.get(tag);
        if (!owner) continue;
        violations.push({
          rule: 'no-server-component-in-client-template',
          file: rel,
          message: `This module loads in the browser and renders <${tag}>, a server-only component (${owner}). It is never defined in the browser, so it renders on the server and comes back empty after a client re-render, the reason Next.js does not let a client component render a server component.`,
          fix: `Render <${tag}> from the page and pass it into this component as a child (it lands in the component's <slot>), as Next.js passes a server component to a client one as children. Or, if it needs to run in the browser, move it out of the .server file.`,
        });
        break;
      }
    }
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

/**
 * `no-interactivity-in-server-component`: a component in a `*.server.*` file
 * renders on the server only and is never defined in the browser (#1686), so
 * an event binding, a reactive primitive or a client-only lifecycle hook in it
 * never runs.
 * @param {string} rel @param {string} content @param {Violation[]} violations
 */
function checkServerComponent(rel, content, violations) {
  const masked = maskComments(content);
  /** @type {string|null} */
  let what = null;
  const binding = firstTagBinding(masked);
  if (binding) what = `\`${binding.text.replace(/\s*=.*$/, '')}\` (line ${lineOf(masked, binding.index)})`;
  if (!what) {
    for (const m of masked.matchAll(CORE_NAMED_IMPORT_RE)) {
      const name = m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '')).find((x) => REACTIVE_IMPORTS.has(x));
      if (name) { what = `\`${name}\``; break; }
    }
  }
  if (!what) {
    const hook = HOOK_RE.exec(masked);
    if (hook) what = `\`${hook[1]}()\``;
  }
  if (!what) return;
  violations.push({
    rule: 'no-interactivity-in-server-component',
    file: rel,
    message: `This component is in a \`.server\` file, so it renders on the server only and is never defined in the browser, but it uses ${what}, which only runs in a browser.`,
    fix: 'Move the component out of the `.server` file (a component in an ordinary file always ships and runs in the browser), and keep its server data access in a `\'use server\'` action or pass the data in from the page.',
  });
}
