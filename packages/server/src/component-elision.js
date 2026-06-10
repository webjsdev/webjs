/**
 * Static analyser deciding whether a webjs component module can be
 * ELIDED from the browser, that is, never downloaded as JS because its
 * SSR'd HTML is the complete, final output and the component does no
 * client-side work.
 *
 * Direction of safety: a false "interactive" verdict only costs a
 * missed optimization (we ship a module we could have skipped). A false
 * "display-only" verdict BREAKS the page (an interactive component never
 * boots). So every ambiguity resolves to "interactive / ship". The
 * analyser is a DENYLIST of interactivity signals; anything it does not
 * recognise ships by default.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH FOR INTERACTIVITY SIGNALS
 * ─────────────────────────────────────────────────────────────────────
 * The exported constants below (REACTIVE_IMPORTS, CLIENT_LIFECYCLE_HOOKS,
 * CLIENT_METHOD_CALLS) ARE the contract. When the framework gains a new
 * interactivity feature (a new lifecycle hook, a new reactive primitive,
 * a new client-only directive, a new event-binding syntax), the marker
 * for it MUST be added to the matching list here, or the analyser will
 * wrongly elide components that use it.
 *
 * This is enforced two ways:
 *   1. The guard test in test/elision/lifecycle-coverage.test.js
 *      introspects the live framework surface and fails on drift:
 *      it enumerates every overridable WebComponent hook (each must flip
 *      a component to interactive), classifies every @webjsdev/core/
 *      directives export as client-only or render-time (a new directive
 *      fails the test until classified), and checks that no
 *      REACTIVE_IMPORTS entry is stale. Adding an interactivity surface
 *      without updating these lists fails that test.
 *   2. Maintainer pointers route changes back here: invariant 6 in
 *      packages/core/AGENTS.md and the MAINTAINER NOTE on the
 *      WebComponent lifecycle in packages/core/src/component.js both
 *      direct anyone adding an interactivity surface to update these
 *      lists, since webjs development is largely AI-agent driven.
 */

import {
  extractWebComponentClassBodies,
  matchClosingBrace,
  redactStringsAndTemplates,
  maskComments,
} from './js-scan.js';
import { transitiveDeps } from './module-graph.js';

/**
 * Named imports from a `@webjsdev/core` specifier that imply the
 * component does reactive or async client work. Importing any of these
 * forces the module to ship: signals re-render on change, Task resolves
 * on the client, the streaming directives settle on the client, and
 * Context consumers subscribe after upgrade.
 *
 * @type {ReadonlySet<string>}
 */
export const REACTIVE_IMPORTS = new Set([
  'signal',
  'computed',
  'effect',
  'watch',
  // `optimistic(signal, value, action)` mutates a signal (client work) and
  // settles after a server round-trip, so a component importing it is not
  // display-only and must ship.
  'optimistic',
  'Task',
  'until',
  'asyncAppend',
  'asyncReplace',
  'ContextProvider',
  'ContextConsumer',
  'connectWS',
  // `renderStream(payload)` applies a server stream-action payload to the live
  // DOM (append/replace/remove), so a component importing it does client work
  // and must ship (#248).
  'renderStream',
  // Client-only directives. `ref` / `createRef` fire a callback against the
  // live element (focus, measure, third-party mount); `live` syncs an input
  // value against the DOM. All produce identical SSR HTML but do real work
  // only after upgrade, so a component using them must ship. Render-time
  // directives (repeat, unsafeHTML, keyed, guard, cache, map) are NOT here:
  // they are SSR-renderable and common in display-only components.
  'ref',
  'createRef',
  'live',
]);

/**
 * Overridable WebComponent lifecycle hooks. Overriding any of them is
 * client-side behaviour the SSR pass never runs, so the module must
 * ship. `render` is deliberately absent: every display-only component
 * defines `render`, and the SSR walker calls it directly. `constructor`
 * is absent for the same reason (it runs during SSR to seed first
 * paint). Keep this list in lockstep with the lifecycle table in
 * agent-docs/components.md.
 *
 * @type {readonly string[]}
 */
export const CLIENT_LIFECYCLE_HOOKS = [
  'connectedCallback',
  'disconnectedCallback',
  'attributeChangedCallback',
  // Standard custom-element callback webjs does not itself define (so it
  // is absent from the prototype guard's CLASSIFICATION), but an author
  // can still override it to do client work. Kept for conservatism.
  'adoptedCallback',
  'shouldUpdate',
  'willUpdate',
  'update',
  'updated',
  'firstUpdated',
  'getUpdateComplete',
  'renderError',
];

/**
 * Method calls that only make sense on the client. `addController`
 * registers a ReactiveController (client lifecycle). `requestUpdate`
 * schedules a re-render. Either implies the component is not inert.
 *
 * @type {readonly string[]}
 */
export const CLIENT_METHOD_CALLS = ['addController', 'removeController', 'requestUpdate'];

/**
 * Match an async (promise-returning) `render()` on a WebComponent: either
 * `async render(` or the arrow-field form `render = async (`. An async render
 * suspends on the client (it awaits data, then re-renders with the resolved
 * value, reads the SSR seed, and may re-fetch via RPC on a prop change), so the
 * module does real client work and must never be elided as display-only. The
 * SSR pass bakes the data into the first paint regardless, but the client half
 * (stale-while-revalidate, renderFallback, the seed read) only runs if the
 * module ships. `renderFallback` is the optional client re-fetch loading UI,
 * meaningless without an async render, so its presence is the same signal.
 */
const ASYNC_RENDER_RE = /\basync\s+render\s*\(|\brender\s*=\s*async\b|\brenderFallback\s*[=(]/;

/** Match a `@event=${...}` binding inside a template (unquoted per invariant 4). */
const EVENT_BINDING_RE = /@[A-Za-z][\w-]*\s*=\s*\$\{/;

/** Match a `.onclick=${...}` (native event-handler property) binding. */
const EVENT_PROP_RE = /\.on[a-z]+\s*=\s*\$\{/;

/** Match a rendered `<slot>` / `<slot ` / `<slot/>`, but not `<slot-machine>`. */
const SLOT_RE = /<slot[\s/>]/;

/** A `.server.{js,ts,mjs,mts}` file: a stub on the client, inert there. */
const SERVER_FILE_RE = /\.server\.m?[jt]s$/;

/** Side-effect or named import of the client router subpath. */
const CLIENT_ROUTER_SUBPATH_RE = /['"]@webjsdev\/core\/client-router['"]/;
/** Client-only named APIs from the `@webjsdev/core` main entry. */
const CLIENT_ROUTER_IMPORTS = ['navigate', 'enableClientRouter', 'disableClientRouter', 'revalidate'];

/** Identifiers that only exist in a browser; their presence means client work. */
const CLIENT_GLOBAL_RE = /\b(?:window|document|navigator|localStorage|sessionStorage|customElements|matchMedia|addEventListener)\b/;

/**
 * Cross-module observation of a component's registration. A module that
 * observes another component's tag forces that component to register on the
 * client, so the observed component cannot be elided even when its own render
 * is display-only (eliding it drops its `customElements.define`, after which
 * the observation silently fails). These scan for the three statically visible
 * forms; the captured group is the observed tag (or class) name.
 * - `customElements.whenDefined('my-tag')` / `whenDefined("my-tag")`
 * - a CSS `my-tag:defined { … }` selector
 * - `x instanceof MyClass` (mapped back to a tag via the component's className)
 */
const WHEN_DEFINED_RE = /\bwhenDefined\s*\(\s*['"`]([a-z][a-z0-9]*-[a-z0-9-]*)['"`]/g;
const TAG_DEFINED_RE = /\b([a-z][a-z0-9]*-[a-z0-9-]*):defined\b/g;
const INSTANCEOF_RE = /\binstanceof\s+([A-Z][A-Za-z0-9_$]*)/g;
/** Same, for component source, minus `customElements` (the registration call
 * `customElements.define(...)` legitimately uses it and must not force ship). */
const COMPONENT_CLIENT_GLOBAL_RE = /\b(?:window|document|navigator|localStorage|sessionStorage|matchMedia|addEventListener)\b/;

/**
 * Module-scope client work, detected by an ALLOWLIST of safe top-level forms
 * rather than a denylist of browser globals. A module that runs ANY code when
 * it loads (other than registering a component) does client work the render /
 * lifecycle / event checks would miss, so it must ship. Unlike a global
 * denylist this does not rot as browsers add APIs: a brand-new global trips it
 * automatically, because it is the CALL (or `new`, or dynamic `import()`), not
 * the global's name, that is recognised.
 *
 * Rule: at brace depth 0 (so code inside function / class / method bodies and
 * template holes, which do not run at module load, is ignored), the only
 * permitted forms are declarations (`import` / `export` / `function` / `class`
 * / `const` / `let` / `var`) and the component registration call
 * (`X.register(...)` / `customElements.define(...)`). Any other call, any
 * `new`, any dynamic `import(...)`, or top-level `await` means client work.
 *
 * Scans the redacted copy (strings / templates / comments blanked, regex
 * literals and nested `${...}` interpolation tracked by the lexer) so template
 * prose and JSDoc / TS type annotations cannot trip it; quoted-string bodies,
 * which redaction keeps verbatim for other rules, are blanked here too so a
 * string like `"foo()"` or `"{"` is not read as a call and cannot unbalance
 * the brace scan. The unbalanced-brace and unterminated-string fallbacks below
 * are defense in depth: with the lexer tracking regex literals, neither should
 * trigger on valid code, but if either does the module ships rather than risk
 * hiding client work.
 *
 * Over-detection is safe (a top-level arrow whose body calls something, or a
 * pure top-level helper call, only ships). The accepted residual misses, all
 * contrived and structural (so they do not rot), are a call buried inside a
 * top-level object / array initializer or a destructuring default, and a
 * side-effecting tagged-template hole evaluated at module scope.
 *
 * @param {string} src raw module source
 */
function hasModuleScopeSideEffect(src) {
  const redacted = redactStringsAndTemplates(src);
  // Keep only depth-0 text (outside every `{}`). Skip quoted-string bodies so
  // braces/parens inside a string neither desync the depth nor read as a call.
  let depth = 0;
  let frame = '';
  for (let i = 0; i < redacted.length; i++) {
    const c = redacted[i];
    if (c === "'" || c === '"') {
      i++;
      let closed = false;
      while (i < redacted.length) {
        const d = redacted[i];
        if (d === '\\') { i += 2; continue; }
        if (d === '\n') break;       // a real quoted string never spans a newline
        if (d === c) { closed = true; break; }
        i++;
      }
      // Not closed on its line is an unterminated string OR a regex literal
      // containing a quote that desynced the upstream redaction (regex bodies
      // are not tracked, so a stray quote shifts quote pairing). Either way the
      // lexical state is unreliable below here, so ship conservatively.
      if (!closed) return true;
      if (depth === 0) frame += "''";
      continue;
    }
    if (c === '{') { depth++; continue; }
    if (c === '}') { if (depth > 0) depth--; continue; }
    if (depth === 0) frame += c;
  }
  // Unbalanced braces mean a construct we could not lexically resolve (a regex
  // literal with a stray brace is the common case). Ship rather than risk a
  // hidden top-level statement.
  if (depth !== 0) return true;
  // Optional-chaining call/index: `foo?.()`, `x?.[i]()` (the `?.` defeats the
  // identifier-before-paren match below).
  if (/\?\.\s*[([]/.test(frame)) return true;
  // Top-level `new` (a `new X()` constructor also trips the call check, but a
  // `new X` without parens would not) and top-level `await`.
  if (/(?<![.\w])(?:new|await)\s/.test(frame)) return true;
  // A call: `(` preceded (ignoring whitespace) by an identifier, `)`, or `]`.
  const CALL_RE = /(?:([A-Za-z_$][\w$]*)|[)\]])\s*\(/g;
  // Identifiers that precede a `(` WITHOUT it being a call (keywords + a
  // `function` declaration's parameter list).
  const NOT_A_CALL = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'typeof',
    'instanceof', 'void', 'delete', 'in', 'of', 'yield', 'do', 'else',
    'case', 'default', 'function', 'await', 'new', 'async',
  ]);
  let m;
  while ((m = CALL_RE.exec(frame)) !== null) {
    const ident = m[1];
    if (ident === 'import') return true;                 // dynamic import()
    if (ident && NOT_A_CALL.has(ident)) continue;
    // A `function`-declaration parameter list (`function name(` or
    // `async function name(`) is not a call.
    if (ident && /\bfunction\s*\*?\s*$/.test(frame.slice(0, m.index))) continue;
    // The component registration call is the one permitted top-level call.
    if (ident === 'register' || ident === 'define') continue;
    return true;                                         // any other top-level call
  }
  return false;
}

/** Match a whole-line SIDE-EFFECT import: `import 'pkg';` (no binding clause).
 * `\s*` before the quote (not `\s+`) so `import"pkg"` (no space) is caught;
 * a binding clause still fails because a non-quote follows `import`. A
 * trailing line comment is tolerated. */
const SIDE_EFFECT_BARE_IMPORT_RE = /^\s*import\s*(['"])([^'"]+)\1\s*;?\s*(?:\/\/[^\n]*)?$/gm;

/**
 * True if `src` imports the client router (the `/client-router` subpath, or
 * a router/nav API from the core main entry). A page or layout that does so
 * is enabling client-side navigation and must ship.
 * @param {string} src
 * @returns {boolean}
 */
function importsClientRouter(src) {
  if (CLIENT_ROUTER_SUBPATH_RE.test(src)) return true;
  for (const m of src.matchAll(CORE_IMPORT_RE)) {
    const clause = m[1];
    if (clause.startsWith('{')) {
      const names = clause.slice(1, -1).split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim());
      if (names.some((n) => CLIENT_ROUTER_IMPORTS.includes(n))) return true;
    } else if (clause.startsWith('*')) {
      // Namespace import: a router/nav member reached through `ns.member`,
      // a destructure of `ns`, or computed access. Mirrors the reactive
      // primitive detection so the two stay symmetric.
      const ns = clause.replace(/^\*\s+as\s+/, '').trim();
      if (!ns || !/^\w+$/.test(ns)) continue;
      for (const name of CLIENT_ROUTER_IMPORTS) {
        if (new RegExp(`\\b${ns}\\.${name}\\b`).test(src)) return true;
      }
      if (new RegExp(`(?:const|let|var)\\s*\\{[^}]*\\}\\s*=\\s*${ns}\\b`).test(src)) return true;
      if (new RegExp(`\\b${ns}\\s*\\[`).test(src)) return true;
    }
  }
  return false;
}

/**
 * True if `src` SIDE-EFFECT imports a bare npm package other than the (inert)
 * `@webjsdev/core` family (`import 'pkg'`, no binding). A side-effect import
 * runs the package's top-level code when the module loads, which is real
 * client work, so a module that has one must ship.
 *
 * A BINDING import (`import x from 'pkg'`) is deliberately NOT flagged: a page
 * function never runs on the client and a display-only component's render
 * never runs on the client when elided, so a package used only as a value in
 * that code never executes client-side and rides away when the module is
 * dropped. This is what lets an SSR-only dependency stay off the client
 * without a `.server.{js,ts}` wrapper.
 *
 * Residual edge: a package that self-registers on import (e.g. calls
 * `customElements.define` at module top level) imported via a binding clause
 * is NOT caught here, so eliding the importer drops that registration and the
 * element silently does not upgrade. This is the cross-module-registration
 * caveat documented in agent-docs/components.md and server AGENTS invariant 7;
 * the fix is `.server.{js,ts}` for genuinely server-only deps, or an
 * interactivity signal on the consumer. (It is not caught by an SSR crash:
 * the SSR `customElements` shim makes `define` a no-op server-side.)
 * @param {string} src
 * @returns {boolean}
 */
function importsSideEffectNonCorePackage(src) {
  for (const m of src.matchAll(SIDE_EFFECT_BARE_IMPORT_RE)) {
    const spec = m[2];
    if (spec.startsWith('.') || spec.startsWith('/')) continue; // relative / absolute
    if (spec === '@webjsdev/core' || spec.startsWith('@webjsdev/core/')) continue; // inert framework / router handled separately
    if (spec.startsWith('node:')) continue; // server-only builtins
    return true;
  }
  return false;
}

/** Match a named-import clause from a `@webjsdev/core` specifier. */
const CORE_IMPORT_RE =
  /import\s+(?:type\s+)?(\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"](@webjsdev\/core[^'"]*|[^'"]*\/__webjs\/core\/[^'"]*)['"]/g;

/**
 * Decide whether a component module is interactive (must ship) or
 * display-only (may be elided).
 *
 * @param {string} src raw module source
 * @returns {{ interactive: boolean, reason: string | null }}
 */
export function analyzeComponentSource(src) {
  // A reactive primitive imported from core is the strongest signal and
  // is file-scoped, so check it first against the whole source.
  const reactiveImport = importsReactivePrimitive(src);
  if (reactiveImport) {
    return { interactive: true, reason: `imports reactive primitive '${reactiveImport}'` };
  }

  // Event bindings live inside `html` template bodies, which redaction
  // blanks. Scan the RAW source for them (over-detection is safe).
  if (EVENT_BINDING_RE.test(src)) {
    return { interactive: true, reason: 'template has an @event binding' };
  }
  if (EVENT_PROP_RE.test(src)) {
    return { interactive: true, reason: 'template sets a native event-handler property' };
  }

  // A rendered `<slot>` relies on webjs's client slot-projection runtime
  // for the slot API (assignedNodes, slotchange) and dynamic re-
  // projection. Shadow DOM slots are native via Declarative Shadow DOM,
  // but proving a given slot is purely native is beyond static analysis,
  // so any rendered slot ships. Tag names like `<slot-machine>` are
  // excluded by requiring a slot-closing character.
  if (SLOT_RE.test(src)) {
    return { interactive: true, reason: 'renders a <slot> (needs the projection runtime)' };
  }

  // Top-level client work the render/lifecycle checks would miss: a
  // side-effect import of an npm package runs its code when the module
  // loads, and a browser global (window/document/…, excluding the
  // registration's customElements) means the module does client work even
  // if its render is otherwise pure. Eliding such a component would drop
  // that effect, so ship. (Mirrors the route-module analysis.)
  if (importsSideEffectNonCorePackage(src)) {
    return { interactive: true, reason: 'side-effect imports an npm package' };
  }
  if (COMPONENT_CLIENT_GLOBAL_RE.test(src)) {
    return { interactive: true, reason: 'references a browser global at module scope' };
  }
  if (hasModuleScopeSideEffect(src)) {
    return { interactive: true, reason: 'runs code at module scope (a top-level call, new, or dynamic import())' };
  }

  // The brace matcher counts depth reliably only on redacted source
  // (template `${...}` holes would otherwise unbalance it). Code-shaped
  // signals (lifecycle hooks, method calls, property descriptors) all
  // survive redaction, so extract and inspect class bodies from there.
  const bodies = extractWebComponentClassBodies(redactStringsAndTemplates(src));
  // A registered component with no recognisable `extends WebComponent`
  // body is a subclass of a custom base (or otherwise unparseable).
  // Cannot prove it inert, so ship it.
  if (bodies.length === 0) {
    return { interactive: true, reason: 'no parseable WebComponent class body' };
  }

  for (const body of bodies) {
    // An async render() (or its renderFallback companion) means the component
    // suspends and re-renders on the client, so it is never display-only.
    if (ASYNC_RENDER_RE.test(body)) {
      return { interactive: true, reason: 'defines an async render() (suspends on the client)' };
    }
    for (const hook of CLIENT_LIFECYCLE_HOOKS) {
      // A client lifecycle hook as a method (`hook(`) OR as an arrow class
      // field (`hook = () =>`), which shadows the prototype method and still
      // runs. Either way the component is not inert.
      if (new RegExp(`\\b${hook}\\s*[=(]`).test(body)) {
        return { interactive: true, reason: `overrides lifecycle hook '${hook}'` };
      }
    }
    for (const call of CLIENT_METHOD_CALLS) {
      if (new RegExp(`\\b${call}\\s*\\(`).test(body)) {
        return { interactive: true, reason: `calls '${call}'` };
      }
    }
    if (hasNonStateReactiveProperty(body)) {
      return {
        interactive: true,
        reason: 'declares a reactive property that is not { state: true }',
      };
    }
  }

  return { interactive: false, reason: null };
}

/**
 * @param {string} src
 * @returns {string | null} the offending imported name, or null
 */
function importsReactivePrimitive(src) {
  for (const m of src.matchAll(CORE_IMPORT_RE)) {
    const clause = m[1];
    if (clause.startsWith('{')) {
      const names = clause
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean);
      for (const name of names) {
        if (REACTIVE_IMPORTS.has(name)) return name;
      }
    } else if (clause.startsWith('*')) {
      // Namespace import (`import * as core from '@webjsdev/core'`). We
      // cannot see which members are used from the clause, so look for a
      // reactive member reached through the namespace identifier `ns`
      // (which is a bare `\w+`, safe to interpolate into a RegExp).
      const ns = clause.replace(/^\*\s+as\s+/, '').trim();
      if (!ns || !/^\w+$/.test(ns)) continue;
      for (const name of REACTIVE_IMPORTS) {
        if (new RegExp(`\\b${ns}\\.${name}\\b`).test(src)) return name;
      }
      // Destructuring the namespace (`const { signal } = core`) or computed
      // access (`core['signal']`) hides which members are pulled. Ship.
      if (new RegExp(`(?:const|let|var)\\s*\\{[^}]*\\}\\s*=\\s*${ns}\\b`).test(src)) {
        return `${ns} (destructured namespace)`;
      }
      if (new RegExp(`\\b${ns}\\s*\\[`).test(src)) {
        return `${ns} (computed namespace access)`;
      }
    }
  }
  return null;
}

/**
 * True if the class body declares a `static properties` block with any
 * entry that is NOT marked `{ state: true }`. Non-state reactive
 * properties ride an attribute or a `.prop` binding, the channel through
 * which a parent pushes updates, which is client-side reactivity.
 *
 * Conservative on parse failure: a `static get properties()` accessor or
 * an unbalanced object literal returns true (ship).
 *
 * @param {string} classBody
 * @returns {boolean}
 */
function hasNonStateReactiveProperty(classBody) {
  // No reactive properties declared at all: nothing rides an attribute.
  if (!/\bstatic\s+(?:get\s+)?properties\b/.test(classBody)) return false;
  // Properties ARE declared. We can only clear a component as inert when
  // the declaration is a brace literal whose every entry is { state: true }.
  // A getter (`static get properties()`) or a non-literal assignment
  // (`= buildProps()`, `= SHARED_PROPS`, `= Object.assign(...)`) cannot be
  // parsed for state flags, so ship conservatively. `[^=]*` tolerates a TS
  // type annotation between the name and `=` without crossing the `=`.
  const m = /\bstatic\s+properties\b[^=]*=\s*\{/.exec(classBody);
  if (!m) return true;
  const objStart = m.index + m[0].length;
  const objEnd = matchClosingBrace(classBody, objStart);
  if (objEnd === -1) return true;
  const obj = classBody.slice(objStart, objEnd);
  // A spread (`...BASE_PROPS`) can inject reactive properties we cannot
  // see; ship rather than guess they are all { state: true }.
  if (/\.\.\./.test(obj)) return true;
  for (const entry of topLevelPropertyValues(obj)) {
    // Object-literal descriptor: inert only when it carries state: true.
    if (entry.startsWith('{')) {
      // Blank string / template bodies first. Redaction keeps quoted
      // string contents verbatim (so register('tag') stays readable), so
      // a descriptor like `{ attribute: 'data-state: true' }` would
      // otherwise forge the state flag. The real `state: true` is code,
      // not a string, so it survives this blanking.
      const code = entry
        .replace(/'[^'\n]*'/g, "''")
        .replace(/"[^"\n]*"/g, '""')
        .replace(/`[^`]*`/g, '``');
      if (!/\bstate\s*:\s*true\b/.test(code)) return true;
    } else {
      // Shorthand like `count: Number` rides an attribute, not state.
      return true;
    }
  }
  return false;
}

/**
 * Yield the trimmed VALUE text of each top-level `key: value` entry in a
 * properties object body, splitting on depth-0 commas and respecting
 * nested braces, brackets, parens, strings, and templates.
 *
 * @param {string} obj  the body between the outer braces
 * @returns {string[]}
 */
function topLevelPropertyValues(obj) {
  /** @type {string[]} */
  const values = [];
  let depth = 0;
  let str = '';
  let colonAt = -1;
  const push = (end) => {
    if (colonAt === -1) return;
    values.push(obj.slice(colonAt + 1, end).trim());
  };
  for (let i = 0; i < obj.length; i++) {
    const c = obj[i];
    if (str) {
      if (c === '\\') { i++; continue; }
      if (c === str) str = '';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { str = c; continue; }
    if (c === '{' || c === '[' || c === '(') { depth++; continue; }
    if (c === '}' || c === ']' || c === ')') { depth--; continue; }
    if (depth === 0) {
      if (c === ':' && colonAt === -1) colonAt = i;
      else if (c === ',') {
        push(i);
        colonAt = -1;
      }
    }
  }
  push(obj.length);
  return values;
}

/**
 * Custom-element tag names a module references in its templates. A tag
 * must contain a hyphen (HTML custom-element spec), which excludes
 * native elements. Over-detection is safe: it only forces more modules
 * to ship.
 *
 * @param {string} src raw module source
 * @returns {Set<string>}
 */
export function extractRenderedTags(src) {
  /** @type {Set<string>} */
  const tags = new Set();
  // Mask comments first so a `<some-tag>` written in a doc comment is not read
  // as a rendered tag (#179). String and template content is kept, so real tags
  // inside `html` templates are still found.
  const masked = maskComments(src);
  const re = /<([a-z][a-z0-9]*-[a-z0-9-]*)\b/g;
  let m;
  while ((m = re.exec(masked)) !== null) tags.add(m[1]);
  return tags;
}

/**
 * Compute the set of component FILES whose browser download can be
 * elided. A file is elidable only when every component it defines is
 * display-only AND it is not pulled into the client by an interactive
 * component (rendered by, or imported by, a shipping module).
 *
 * Two propagation rules iterate to a fixpoint:
 *   - render rule:  a shipping component that can emit `<child-tag>` on a
 *     client re-render forces the child to ship. The tags a component can
 *     emit are not only those in its own template but also those returned
 *     by the template helpers it imports (the documented `lib/utils/ui.ts`
 *     pattern), so the rule scans the component's transitive app-internal
 *     import closure, not just its own source.
 *   - import rule:  a component that imports a shipping component module
 *     ships too (matches the issue's transitive criterion; conservative).
 *
 * @param {Array<{ tag: string, file: string }>} components
 * @param {import('./module-graph.js').ModuleGraph} moduleGraph
 * @param {(file: string) => Promise<string>} readFileFn
 * @param {string} [appDir]  app root; enables the helper-closure render rule
 * @returns {Promise<Set<string>>} absolute paths of elidable component files
 */
export async function computeElidableComponents(components, moduleGraph, readFileFn, appDir) {
  const { elidableComponents } = await analyzeElision(components, [], moduleGraph, readFileFn, appDir);
  return elidableComponents;
}

/**
 * Full elision analysis: which display-only COMPONENT modules can be elided,
 * AND which page/layout ROUTE modules are inert (do no client work) and can
 * therefore be dropped from the client boot script entirely. The second is
 * the progressive-enhancement completion of the first: a route whose whole
 * subtree is inert ships zero JavaScript.
 *
 * A route module is inert only when neither it nor its effective client
 * closure (the import graph with elided components and `.server` stubs
 * skipped, since those never run on the client) touches anything
 * client-effecting: a reactive primitive, the client router, an `@event` /
 * `.on*` binding, a non-core npm import (which may self-execute), a client
 * global (`window`, `document`, …), or a shipping component. Anything
 * ambiguous or unreadable keeps shipping.
 *
 * @param {Array<{ tag: string, file: string }>} components
 * @param {string[]} routeModules  absolute paths of page + layout files
 * @param {import('./module-graph.js').ModuleGraph} moduleGraph
 * @param {(file: string) => Promise<string>} readFileFn
 * @param {string} [appDir]
 * @returns {Promise<{ elidableComponents: Set<string>, inertRouteModules: Set<string> }>}
 */
export async function analyzeElision(components, routeModules, moduleGraph, readFileFn, appDir) {
  /** @type {Set<string>} */
  const componentFiles = new Set();
  /** @type {Map<string, string>} */
  const tagToFile = new Map();
  /** @type {Map<string, string>} className -> file, for instanceof observation */
  const classToFile = new Map();
  for (const c of components) {
    componentFiles.add(c.file);
    tagToFile.set(c.tag, c.file);
    if (c.className) classToFile.set(c.className, c.file);
  }

  /** @type {Set<string>} */
  const mustShip = new Set();
  /** @type {Map<string, Set<string>>} */
  const fileTags = new Map();
  /** @type {Set<string>} modules importing a reactive primitive from core */
  const reactiveFiles = new Set();
  /** @type {Set<string>} modules enabling the client router */
  const clientRouterFiles = new Set();
  /** @type {Set<string>} modules with an @event/.on* binding, a non-core npm import, or a client global */
  const clientGlobalOrBareFiles = new Set();
  /** @type {Set<string>} */
  const serverFiles = new Set();
  /** @type {Set<string>} component files forced to ship because some module
   * observes their registration (whenDefined / :defined / instanceof). */
  const observedComponentFiles = new Set();

  /** @type {Set<string>} */
  const allFiles = new Set(componentFiles);
  for (const f of routeModules) allFiles.add(f);
  for (const [k, vs] of moduleGraph) {
    if (!appDir || k.startsWith(appDir)) allFiles.add(k);
    for (const v of vs) if (!appDir || v.startsWith(appDir)) allFiles.add(v);
  }

  for (const file of allFiles) {
    if (SERVER_FILE_RE.test(file)) { serverFiles.add(file); continue; }
    let src;
    try { src = await readFileFn(file); }
    catch {
      // A component file we cannot read ships conservatively; a helper we
      // cannot read simply contributes no tags.
      if (componentFiles.has(file)) mustShip.add(file);
      continue;
    }
    if (typeof src !== 'string') continue;
    // Mask comments once for every signal scan below (#179): a `<tag>`, an
    // `@event`, a browser global, an `import`, or a `whenDefined` written in a
    // comment must not register as a real signal. String and template content
    // is kept, so a real rendered tag, a real `@click=${}` in an html template,
    // and a real `whenDefined('tag')` (the tag rides a string) still match.
    // (`importsSideEffectNonCorePackage` / `hasModuleScopeSideEffect` /
    // `analyzeComponentSource` also redact strings/templates internally; running
    // them on the comment-masked source just additionally drops comment prose.)
    const masked = maskComments(src);
    fileTags.set(file, extractRenderedTags(masked));
    if (importsReactivePrimitive(masked)) reactiveFiles.add(file);
    if (importsClientRouter(masked)) clientRouterFiles.add(file);
    if (EVENT_BINDING_RE.test(masked) || EVENT_PROP_RE.test(masked) ||
        importsSideEffectNonCorePackage(masked) || CLIENT_GLOBAL_RE.test(masked) ||
        hasModuleScopeSideEffect(masked)) {
      clientGlobalOrBareFiles.add(file);
    }
    if (componentFiles.has(file) && analyzeComponentSource(masked).interactive) {
      mustShip.add(file);
    }
    // Cross-module registration observation (#169): if THIS module observes
    // another component's tag, that component must register client-side, so
    // it cannot be elided. Map each observed tag/class back to its component
    // file. Resolution against tagToFile / classToFile happens after the loop
    // (all components are known up front, but we collect here while we hold
    // each source). Verdict-safe: only ever forces MORE components to ship.
    for (const m of masked.matchAll(WHEN_DEFINED_RE)) {
      const f = tagToFile.get(m[1]); if (f) observedComponentFiles.add(f);
    }
    for (const m of masked.matchAll(TAG_DEFINED_RE)) {
      const f = tagToFile.get(m[1]); if (f) observedComponentFiles.add(f);
    }
    for (const m of masked.matchAll(INSTANCEOF_RE)) {
      const f = classToFile.get(m[1]); if (f) observedComponentFiles.add(f);
    }
  }

  // Force every observed component to ship before the fixpoint runs, so the
  // render/import rules propagate from it too. Dynamic tag strings and external
  // (non graph-reachable) stylesheets remain an author-facing caveat, since
  // static analysis cannot see them.
  for (const f of observedComponentFiles) mustShip.add(f);

  // Reverse import edges (who imports each file), built once from the graph.
  // Drives both the closure-client-work reachability below and the fixpoint's
  // import rule, each in O(N+E) rather than a per-component closure walk.
  /** @type {Map<string, Set<string>>} */
  const importersOf = new Map();
  for (const [file, deps] of moduleGraph) {
    for (const dep of deps) {
      let set = importersOf.get(dep);
      if (!set) { set = new Set(); importersOf.set(dep, set); }
      set.add(file);
    }
  }

  // Files that reach client work through their imports: a reactive primitive,
  // the client router, a browser global, an `@event` binding, or a side-effect
  // npm import. Computed by propagating BACKWARD from the client-effecting
  // files through the reverse edges, stopping at `.server` files (the forward
  // closure skips them, since the browser only ever sees their stub). This is
  // O(N+E) instead of a full transitive-closure walk per component, which was
  // the second O(N^2) on a deep component chain.
  /** @type {Set<string>} */
  const reachesClientWork = new Set();
  {
    const work = [];
    for (const f of [...reactiveFiles, ...clientRouterFiles, ...clientGlobalOrBareFiles]) {
      if (!reachesClientWork.has(f)) { reachesClientWork.add(f); work.push(f); }
    }
    while (work.length) {
      const node = /** @type {string} */ (work.pop());
      const importers = importersOf.get(node);
      if (!importers) continue;
      for (const imp of importers) {
        if (serverFiles.has(imp)) continue;  // a server file blocks the forward closure
        if (!reachesClientWork.has(imp)) { reachesClientWork.add(imp); work.push(imp); }
      }
    }
  }

  // Ship any component whose transitive import closure does client work (the
  // helper-imports-a-signal case): it ships if any of its direct, non-server
  // deps reaches client work. Equivalent to the old per-component closure walk
  // (a component that is itself client-effecting is already shipping via
  // analyzeComponentSource), but linear.
  if (appDir) {
    for (const file of componentFiles) {
      if (mustShip.has(file)) continue;
      const deps = moduleGraph.get(file);
      if (!deps) continue;
      for (const dep of deps) {
        if (serverFiles.has(dep)) continue;
        if (reachesClientWork.has(dep)) { mustShip.add(file); break; }
      }
    }
  }

  // Tags each component can emit on a client re-render: its OWN rendered tags
  // plus tags returned by the template HELPERS it imports (the lib/utils/ui.ts
  // pattern). The closure deliberately SKIPS component and server files:
  // importing another component does not mean rendering its tag (a rendered tag
  // is already in the importer's own source via extractRenderedTags), and a
  // server file renders nothing client-side. Following component edges here
  // makes the closure O(N^2) in time AND memory on a deep component chain
  // (every component would accumulate every downstream tag); helper-only
  // closures keep it linear. This is verdict-SAFE: it never elides a component
  // that the render rule requires to ship (so it can never break a page), and
  // it actually elides strictly MORE in some shapes, because following
  // component edges made the old version over-ship components whose tags
  // nothing actually renders client-side.
  const tagClosureSkip = new Set([...componentFiles, ...serverFiles]);
  /** @type {Map<string, Set<string>>} */
  const emittableTags = new Map();
  for (const file of componentFiles) {
    const tags = new Set(fileTags.get(file));
    const deps = appDir ? transitiveDeps(moduleGraph, [file], appDir, tagClosureSkip) : [];
    for (const dep of deps) {
      const dt = fileTags.get(dep);
      if (dt) for (const t of dt) tags.add(t);
    }
    emittableTags.set(file, tags);
  }

  // Fixpoint by worklist (render rule + import rule), O(N+E). Seed with the
  // components already known to ship; each shipping node forces the components
  // whose tags it can emit (render rule) and the COMPONENT files that import it
  // (import rule). Replaces the old iterate-until-stable double loop, which was
  // O(N^2) per pass and O(N^3) / out-of-memory on a deep render chain.
  const queue = [...mustShip];
  while (queue.length) {
    const node = /** @type {string} */ (queue.pop());
    const tags = emittableTags.get(node);
    if (tags) {
      for (const tag of tags) {
        const childFile = tagToFile.get(tag);
        if (childFile && !mustShip.has(childFile)) { mustShip.add(childFile); queue.push(childFile); }
      }
    }
    const importers = importersOf.get(node);
    if (importers) {
      for (const imp of importers) {
        if (!componentFiles.has(imp)) continue;  // import rule is component -> component
        if (!mustShip.has(imp)) { mustShip.add(imp); queue.push(imp); }
      }
    }
  }

  /** @type {Set<string>} */
  const elidableComponents = new Set();
  for (const file of componentFiles) {
    if (!mustShip.has(file)) elidableComponents.add(file);
  }

  // A file does client work if it ships as a component, or itself reaches a
  // reactive primitive / client router / event binding / non-core npm import
  // / client global.
  const isClientEffecting = (file) =>
    (componentFiles.has(file) && mustShip.has(file)) ||
    reactiveFiles.has(file) ||
    clientRouterFiles.has(file) ||
    clientGlobalOrBareFiles.has(file);

  // Route modules: inert iff neither the module nor its effective client
  // closure (skipping elided components and server stubs, which never load)
  // is client-effecting.
  /** @type {Set<string>} */
  const skip = new Set([...elidableComponents, ...serverFiles]);
  /** @type {Set<string>} */
  const inertRouteModules = new Set();
  for (const file of routeModules) {
    if (!fileTags.has(file)) continue; // unreadable / not analysed: ship (omit from inert set)
    if (isClientEffecting(file)) continue;
    const closure = appDir ? transitiveDeps(moduleGraph, [file], appDir, skip) : [];
    if (closure.some(isClientEffecting)) continue;
    inertRouteModules.add(file);
  }

  return { elidableComponents, inertRouteModules };
}

/** Match a whole-line side-effect import: `import './x.js';` (no bindings). */
const SIDE_EFFECT_IMPORT_RE = /^([ \t]*)import\s+(['"])([^'"]+)\2\s*;?[ \t]*$/gm;

/**
 * Remove side-effect imports of elidable components from a browser
 * module's served source, so the browser never downloads them. This is
 * what actually elides the JS: a component is fetched because the page
 * (or another component) statically imports it for registration, and
 * the modulepreload hint only parallelises that fetch.
 *
 * ONLY side-effect imports (`import './x'`) are stripped. A binding
 * import (`import { X } from './x'`) is left intact: its binding may be
 * used as a value at runtime, so removing it would break the module.
 * That is also why eliding stays correct, an elidable component is one
 * used purely as an SSR'd tag, never as an imported value.
 *
 * Fast path: if the importer has no elidable dependency in the graph,
 * the source is returned untouched without any regex work.
 *
 * Matching runs over a REDACTED copy (comment / string / template bodies
 * blanked, positions preserved) so a line that merely reads like an
 * import inside an `html\`...\`` template or a comment is never rewritten.
 * Real top-level import statements survive redaction; the quoted
 * specifier survives too (redaction keeps string bodies verbatim), so it
 * is read from the redacted match and the original source is spliced at
 * the matched range.
 *
 * @param {string} source             module source (already type-stripped if TS)
 * @param {string} importerAbs        absolute path of the importing module
 * @param {import('./module-graph.js').ModuleGraph | undefined} moduleGraph
 * @param {Set<string> | undefined} elidableSet  absolute paths of elidable files
 * @param {(spec: string, fromFile: string, appDir: string) => (string|null)} resolveImport
 * @param {string} appDir
 * @returns {string}
 */
export function elideImportsFromSource(source, importerAbs, moduleGraph, elidableSet, resolveImport, appDir) {
  if (!elidableSet || elidableSet.size === 0) return source;
  const deps = moduleGraph && moduleGraph.get(importerAbs);
  if (!deps) return source;
  let hasElidableDep = false;
  for (const d of deps) {
    if (elidableSet.has(d)) { hasElidableDep = true; break; }
  }
  if (!hasElidableDep) return source;

  const redacted = redactStringsAndTemplates(source);
  let out = '';
  let last = 0;
  for (const m of redacted.matchAll(SIDE_EFFECT_IMPORT_RE)) {
    const start = /** @type {number} */ (m.index);
    const end = start + m[0].length;
    const resolved = resolveImport(m[3], importerAbs, appDir);
    out += source.slice(last, start);
    if (resolved && elidableSet.has(resolved)) {
      out += `${m[1]}/* webjs: elided display-only component */`;
    } else {
      out += source.slice(start, end);
    }
    last = end;
  }
  out += source.slice(last);
  return out;
}
