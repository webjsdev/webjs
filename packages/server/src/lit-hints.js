/**
 * The Lit-habit hint table: what to write in WebJs when Lit muscle memory
 * reaches for something WebJs cannot have.
 *
 * WebJs matches Lit's component API wherever it can with no build step. Two
 * kinds of Lit code still cannot work, and both fail far from the line that
 * caused them unless something names the fix:
 *
 *  - DECORATORS (`@customElement`, `@property`, `@state`, `@query`, ...).
 *    Node's type stripper passes them through untouched, so the module then
 *    dies with a bare `SyntaxError: Invalid or unexpected token` on Node and
 *    in the browser (Bun runs legacy decorators and throws a
 *    `ReferenceError` for the undefined decorator instead).
 *  - NAMES that do not exist in `@webjsdev/core` (`LitElement`, a decorator
 *    function, a type imported as a value). ESM reports them as
 *    `does not provide an export named X`, which says nothing about the fix.
 *
 * One table feeds every surface that reports these, so the fix text cannot
 * drift: the `no-non-erasable-typescript` and `core-imports-exist` check
 * rules, the dev server's post-strip scan, and the dev error overlay.
 */
import { redactStringsAndTemplates } from './js-scan.js';

/**
 * Lit decorator name to the WebJs spelling of the same thing.
 * @type {Readonly<Record<string, string>>}
 */
export const DECORATOR_FIXES = Object.freeze({
  customElement:
    "Drop `@customElement('my-el')` and register after the class: `MyEl.register('my-el')` (or `customElements.define('my-el', MyEl)`).",
  property:
    "Declare the property in Lit's `static properties = { count: { type: Number } }` plus a `declare count: number;` line (or pass the shape to the factory: `class X extends WebComponent({ count: Number })`), and set its default in the constructor after `super()`.",
  state:
    'Declare it as internal state with `static properties = { open: { state: true } }` plus `declare open: boolean;` (or hold it in a signal), and set its default in the constructor.',
  query:
    "Replace `@query('#x') el` with a getter: `get el() { return this.renderRoot.querySelector('#x'); }`.",
  queryAll:
    "Replace `@queryAll('.x') els` with a getter: `get els() { return this.renderRoot.querySelectorAll('.x'); }`.",
  queryAsync:
    "Replace `@queryAsync('#x') el` with an async method: `async el() { await this.updateComplete; return this.renderRoot.querySelector('#x'); }`.",
  queryAssignedElements:
    "Replace it with a getter over the slot: `get items() { return this.renderRoot.querySelector('slot')?.assignedElements({ flatten: true }) ?? []; }`.",
  queryAssignedNodes:
    "Replace it with a getter over the slot: `get nodes() { return this.renderRoot.querySelector('slot')?.assignedNodes({ flatten: true }) ?? []; }`.",
  eventOptions:
    'Pass listener options with a listener object in the binding: `@scroll=${{ handleEvent: (e) => this.onScroll(e), passive: true }}`.',
  provide:
    'Create the provider in the constructor: `new ContextProvider(this, { context: myContext, initialValue })` from `@webjsdev/core/context`.',
  consume:
    'Create the consumer in the constructor: `new ContextConsumer(this, { context: myContext, subscribe: true })` from `@webjsdev/core/context`.',
});

/** The fix line shared by every decorator not in the table. */
export const GENERIC_DECORATOR_FIX =
  'WebJs has no build step, so decorators cannot run. Declare reactive properties with `static properties` (or the `WebComponent({ ... })` factory), register with `MyEl.register(tag)`, and write `@query`-style lookups as getters over `this.renderRoot`.';

/**
 * The fix for one decorator name.
 * @param {string} name  the decorator identifier without the `@`
 * @returns {string}
 */
export function decoratorFix(name) {
  return Object.hasOwn(DECORATOR_FIXES, name) ? DECORATOR_FIXES[name] : GENERIC_DECORATOR_FIX;
}

/**
 * A decorator in CODE position: at the start of a line or right after a
 * `{`, `;` or `}`, an `@` followed by an identifier (optionally dotted), with
 * whatever follows being another decorator, a call, or a class member / class
 * declaration. Run over a mask in which every comment, string and template
 * body is blanked, so `@click=${...}` in an `html` template, `@media` in a
 * `css` template, and `@param` in a JSDoc block are never seen.
 */
const DECORATOR_RE = /(^|[{;}])([ \t]*)@([A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*)*(?=[ \t]*(?:\(|\r?\n|[A-Za-z_$#@*[]))/gm;

/**
 * Find the first decorator in `src`, or null.
 * @param {string} src  raw JS / TS source
 * @param {string} [scan]  an already-built `redactStringsAndTemplates(src, true)` mask
 * @returns {{ name: string, index: number, line: number, column: number } | null}
 */
export function findDecorator(src, scan) {
  if (typeof src !== 'string' || !src.includes('@')) return null;
  const mask = scan ?? redactStringsAndTemplates(src, true);
  DECORATOR_RE.lastIndex = 0;
  const m = DECORATOR_RE.exec(mask);
  if (!m) return null;
  const index = m.index + m[1].length + m[2].length;
  const before = src.slice(0, index);
  const line = before.split('\n').length;
  const column = index - before.lastIndexOf('\n');
  return { name: m[3], index, line, column };
}

/**
 * One message for a found decorator, shared by `webjs check` and dev.
 * @param {{ name: string, line: number }} hit
 * @returns {{ message: string, fix: string }}
 */
export function decoratorReport(hit) {
  return {
    message:
      `Decorator \`@${hit.name}\` at line ${hit.line}. WebJs serves source with no build step and decorators are not erasable TypeScript: ` +
      'Node and the browser reject the module with a bare `SyntaxError: Invalid or unexpected token`, so the component never loads.',
    fix: decoratorFix(hit.name),
  };
}

/**
 * Names Lit code imports that `@webjsdev/core` will never export, mapped to the
 * WebJs replacement. A name NOT here that is still missing from core gets the
 * generic "not exported" message with the list of near names; a name that core
 * exports only as a TYPE gets the `import type` fix instead.
 * @type {Readonly<Record<string, string>>}
 */
export const MISSING_NAME_FIXES = Object.freeze({
  LitElement: "Extend `WebComponent` from '@webjsdev/core': `class MyEl extends WebComponent { ... }`.",
  ReactiveElement: "Extend `WebComponent` from '@webjsdev/core'. It is the reactive element and the template renderer in one class.",
  customElement: DECORATOR_FIXES.customElement,
  property: DECORATOR_FIXES.property,
  state: DECORATOR_FIXES.state,
  query: DECORATOR_FIXES.query,
  queryAll: DECORATOR_FIXES.queryAll,
  queryAsync: DECORATOR_FIXES.queryAsync,
  queryAssignedElements: DECORATOR_FIXES.queryAssignedElements,
  queryAssignedNodes: DECORATOR_FIXES.queryAssignedNodes,
  eventOptions: DECORATOR_FIXES.eventOptions,
  provide: DECORATOR_FIXES.provide,
  consume: DECORATOR_FIXES.consume,
  supportsAdoptingStyleSheets: 'Drop it. WebJs adopts `static styles` into a shadow root itself and falls back to a `<style>` element when constructable stylesheets are missing.',
  defaultConverter: 'Drop the import. The built-in attribute conversion for `String` / `Number` / `Boolean` / `Object` / `Array` applies whenever a property declares no `converter`.',
  notEqual: 'Drop the import. A property with no `hasChanged` already uses `!Object.is(value, oldValue)`.',
});

/**
 * The fix for a name that `@webjsdev/core` does not export as a value.
 * @param {string} name
 * @param {{ typeOnly?: boolean, specifier?: string }} [info]
 * @returns {string}
 */
export function missingCoreNameFix(name, info = {}) {
  const spec = info.specifier || '@webjsdev/core';
  if (info.typeOnly) {
    return `\`${name}\` is a TYPE in ${spec}, with no runtime value. Import it with \`import type { ${name} } from '${spec}'\` (or \`import { type ${name} }\`), since the type stripper keeps a plain import and the module then fails to load.`;
  }
  if (Object.hasOwn(MISSING_NAME_FIXES, name)) return MISSING_NAME_FIXES[name];
  return `Remove the import of \`${name}\` or import a name ${spec} exports. Its source is readable in node_modules/@webjsdev/core.`;
}

/**
 * Parse the missing name and the module out of an ESM link error, on either
 * runtime: Node's `The requested module 'x' does not provide an export named
 * 'Y'` and Bun's `Export named 'Y' not found in module 'x'.`
 * @param {string} message
 * @returns {{ name: string, module: string } | null}
 */
export function parseMissingExport(message) {
  if (typeof message !== 'string') return null;
  let m = /requested module '([^']+)' does not provide an export named '([^']+)'/.exec(message);
  if (m) return { module: m[1], name: m[2] };
  m = /Export named '([^']+)' not found in module '([^']+)'/.exec(message);
  if (m) return { module: m[2], name: m[1] };
  return null;
}

/**
 * True when an ESM link error names a WebJs core module.
 * @param {string} mod
 */
export function isCoreModule(mod) {
  return /@webjsdev\/core|\/packages\/core\/|\/__webjs\/core\//.test(mod);
}
