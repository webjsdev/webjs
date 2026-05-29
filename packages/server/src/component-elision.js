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
 *      enumerates every overridable WebComponent hook and asserts each
 *      flips a component to interactive. Adding a hook without updating
 *      this list fails that test.
 *   2. agent-docs/framework-dev.md documents this file as a mandatory
 *      stop in the "adding an interactivity feature" checklist, since
 *      webjs development is largely AI-agent driven.
 */

import {
  extractWebComponentClassBodies,
  matchClosingBrace,
  redactStringsAndTemplates,
} from './js-scan.js';

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
  'Task',
  'until',
  'asyncAppend',
  'asyncReplace',
  'ContextProvider',
  'ContextConsumer',
  'connectWS',
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

/** Match a `@event=${...}` binding inside a template (unquoted per invariant 4). */
const EVENT_BINDING_RE = /@[A-Za-z][\w-]*\s*=\s*\$\{/;

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
    for (const hook of CLIENT_LIFECYCLE_HOOKS) {
      // Method definition or call of a client lifecycle hook.
      if (new RegExp(`\\b${hook}\\s*\\(`).test(body)) {
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
  if (/\bstatic\s+get\s+properties\b/.test(classBody)) return true;
  const m = /\bstatic\s+properties\s*=\s*\{/.exec(classBody);
  if (!m) return false;
  const objStart = m.index + m[0].length;
  const objEnd = matchClosingBrace(classBody, objStart);
  if (objEnd === -1) return true;
  const obj = classBody.slice(objStart, objEnd);
  for (const entry of topLevelPropertyValues(obj)) {
    // Object-literal descriptor: inert only when it carries state: true.
    if (entry.startsWith('{')) {
      if (!/\bstate\s*:\s*true\b/.test(entry)) return true;
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
  const re = /<([a-z][a-z0-9]*-[a-z0-9-]*)\b/g;
  let m;
  while ((m = re.exec(src)) !== null) tags.add(m[1]);
  return tags;
}

/**
 * Compute the set of component FILES whose browser download can be
 * elided. A file is elidable only when every component it defines is
 * display-only AND it is not pulled into the client by an interactive
 * component (rendered by, or imported by, a shipping module).
 *
 * Two propagation rules iterate to a fixpoint:
 *   - render rule:  a shipping component that renders `<child-tag>` can
 *     instantiate that child on a client re-render, so the child must
 *     ship too.
 *   - import rule:  a component that imports a shipping component module
 *     ships too (matches the issue's transitive criterion; conservative).
 *
 * @param {Array<{ tag: string, file: string }>} components
 * @param {import('./module-graph.js').ModuleGraph} moduleGraph
 * @param {(file: string) => Promise<string>} readFileFn
 * @returns {Promise<Set<string>>} absolute paths of elidable component files
 */
export async function computeElidableComponents(components, moduleGraph, readFileFn) {
  /** @type {Set<string>} */
  const componentFiles = new Set();
  /** @type {Map<string, string>} */
  const tagToFile = new Map();
  for (const c of components) {
    componentFiles.add(c.file);
    tagToFile.set(c.tag, c.file);
  }

  /** @type {Set<string>} */
  const mustShip = new Set();
  /** @type {Map<string, Set<string>>} */
  const rendersTags = new Map();

  for (const file of componentFiles) {
    let src;
    try { src = await readFileFn(file); }
    catch { mustShip.add(file); continue; }
    const { interactive } = analyzeComponentSource(src);
    if (interactive) mustShip.add(file);
    rendersTags.set(file, extractRenderedTags(src));
  }

  let changed = true;
  while (changed) {
    changed = false;
    // Render rule.
    for (const parent of mustShip) {
      const tags = rendersTags.get(parent);
      if (!tags) continue;
      for (const tag of tags) {
        const childFile = tagToFile.get(tag);
        if (childFile && !mustShip.has(childFile)) {
          mustShip.add(childFile);
          changed = true;
        }
      }
    }
    // Import rule.
    for (const file of componentFiles) {
      if (mustShip.has(file)) continue;
      const deps = moduleGraph.get(file);
      if (!deps) continue;
      for (const dep of deps) {
        if (componentFiles.has(dep) && mustShip.has(dep)) {
          mustShip.add(file);
          changed = true;
          break;
        }
      }
    }
  }

  /** @type {Set<string>} */
  const elidable = new Set();
  for (const file of componentFiles) {
    if (!mustShip.has(file)) elidable.add(file);
  }
  return elidable;
}
