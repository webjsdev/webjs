/**
 * Lexical signals of browser code, shared by the `webjs check` rules for the
 * server / browser line (#1686) and the route-module hints `webjs status` and
 * `webjs doctor` report. Nothing here decides what ships: a component always
 * ships, and these only spot code that would silently never run.
 *
 * @module
 */
import { maskComments, redactToPlaceholders } from './js-scan.js';
import { resolveImport } from './module-graph.js';

/** A `.server.{js,ts,mjs,mts}` file. */
const SERVER_FILE_RE = /\.server\.m?[jt]s$/;

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
  // Custom directive authoring (Lit's `directive()`, `Directive`,
  // `AsyncDirective`, from `@webjsdev/core/directive` and
  // `@webjsdev/core/async-directive`). A directive class may hold per-part
  // state and an AsyncDirective pushes values after upgrade through
  // `setValue`, so the analyser cannot prove the SSR output is the whole
  // story and a component importing one ships.
  'directive',
  'Directive',
  'AsyncDirective',
  // `ContextRoot` buffers context requests until a late provider upgrades,
  // and `ContextProviderEvent` hands subscribers to a nearer provider; both
  // only happen in the browser.
  'ContextRoot',
  'ContextProviderEvent',
  // Lit's `SignalWatcher` mixin (an identity mixin here, watching is built
  // in): a component that names it reacts to signals after upgrade.
  'SignalWatcher',
]);

/** An event binding (`@event=${...}`), quoted or unquoted (invariant 4). */
export const EVENT_BINDING_RE = /@[A-Za-z][\w-]*\s*=\s*["']?\$\{/;

/**
 * Identifiers that only exist in a browser; their presence means client work.
 * Both this and COMPONENT_CLIENT_GLOBAL_RE are tested against the
 * PLACEHOLDER redaction (`redactToPlaceholders`), never against raw or
 * comment-masked source: a quoted string body or a template literal's TEXT is
 * data, not a reference, so `'lucide-app-window'` must not read as `window`,
 * while code inside a `${...}` hole stays real code and still matches. A global
 * written in template text is SSR output (an inline `<script>` runs from the
 * served HTML whether or not the module ships), the reasoning #623 applied to
 * route modules, now extended to every module.
 */
export const CLIENT_GLOBAL_RE = /\b(?:window|document|navigator|localStorage|sessionStorage|customElements|matchMedia|addEventListener)\b/;

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

/** Reactive primitives: state a route module can hold but never update in a browser. */
const REACTIVE_NAMES = new Set(['signal', 'computed', 'effect', 'watch']);
const IMPORT_STMT_RE = /(?:^|[;\n])\s*import\s+(?:(type\s+)?([^'"`;]*?)\s+from\s+)?['"]__STR_(\d+)__['"]/g;
const FIX_HINT = 'Move it into a component, or into `instrumentation-client.ts` for app-wide browser code.';

/**
 * Advisory notes on a ROUTE module's source (#1686): code that looks meant for
 * the browser but runs only on the server, because a page, layout or boundary
 * never loads there. Never a refusal: each pattern is legal on the server and
 * merely does nothing useful, so the dev server and `webjs doctor`
 * (`ROUTE_BROWSER_CODE`) surface these as hints.
 *
 * Reads the placeholder redaction, so a browser global written in a string or
 * in template TEXT (an inline `<script>` that runs from the rendered HTML) is
 * not a hint, while one in code or in a `${...}` hole is.
 *
 * @param {string} src  the route module's source
 * @param {{ file: string, appDir: string, isComponent: (abs: string) => boolean, carriesComponent?: (abs: string) => boolean }} ctx
 *   `carriesComponent` says whether a module leads to a component (a barrel of
 *   component imports), whose components the boot already loads in its place
 * @returns {string[]}
 */
export function routeModuleBrowserHints(src, { file, appDir, isComponent, carriesComponent }) {
  /** @type {string[]} */
  const hints = [];
  const { redacted, literals } = redactToPlaceholders(src);
  const global = CLIENT_GLOBAL_RE.exec(redacted);
  if (global) {
    hints.push(`\`${global[0]}\` is used, but this module runs only on the server, so that code never runs in a browser. ${FIX_HINT}`);
  }
  for (const m of redacted.matchAll(IMPORT_STMT_RE)) {
    if (m[1]) continue; // `import type` is erased
    const spec = literals[Number(m[3])];
    const bindings = m[2];
    if (spec === undefined) continue;
    if (spec === '@webjsdev/core/client-router') {
      hints.push('`@webjsdev/core/client-router` is imported, but this module never loads in a browser. The router starts by itself once any component loads, or import it from `instrumentation-client.ts`.');
      continue;
    }
    if (bindings && /^@webjsdev\/core(\/signals)?$/.test(spec)) {
      const names = (bindings.match(/\{([^}]*)\}/)?.[1] || '').split(',')
        .map((n) => n.trim().split(/\s+as\s+/)[0].trim()).filter((n) => REACTIVE_NAMES.has(n));
      if (names.length) {
        hints.push(`\`${names[0]}\` is imported, but this module never hydrates, so its state never changes in a browser. Keep reactive state in a component.`);
      }
      continue;
    }
    if (bindings) continue;
    // A side-effect import: anything it sets up happens on the server only.
    if (/\.css$/.test(spec) || SERVER_FILE_RE.test(spec)) continue;
    const local = spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('#');
    if (local) {
      const abs = resolveImport(spec, file, appDir);
      if (!abs || isComponent(abs) || SERVER_FILE_RE.test(abs)) continue;
      if (carriesComponent && carriesComponent(abs)) continue;
    } else if (spec.startsWith('@webjsdev/') || spec.startsWith('node:')) {
      continue;
    }
    hints.push(`The side-effect import of \`${spec}\` runs only on the server. If it sets something up in the browser, import it from a component or from \`instrumentation-client.ts\`.`);
  }
  return hints;
}
