import { readFile, stat } from 'node:fs/promises';
import { join, relative, sep, basename, dirname } from 'node:path';
import { walk } from './fs-walk.js';
import {
  redactStringsAndTemplates,
  extractWebComponentClassBodies,
  matchClosingBrace,
  parsePropEntries,
} from './js-scan.js';
import { buildModuleGraph, transitiveDeps } from './module-graph.js';
import { scanComponents } from './component-scanner.js';
import { buildRouteTable } from './router.js';
import { analyzeElision } from './component-elision.js';
import { RESERVED_CONFIG } from './action-config.js';

/**
 * Convention validator for webjs apps.
 *
 * Scans an app directory and reports correctness violations: things that
 * crash the app, leak a secret, or fail the build / type-strip. Designed to be
 * run by AI agents, CI pipelines, or `webjs check` to catch real breakage
 * early. Every rule is unconditional (no per-project disabling): project
 * conventions (layout, style, process) are guidance in CONVENTIONS.md, not
 * rules in this tool.
 *
 * **How AI agents should use the output:**
 * Each violation includes a machine-readable `rule` identifier, the offending
 * `file` (relative to appDir), a human-readable `message`, and a suggested
 * `fix`. Agents should iterate the array and apply (or propose) the fixes.
 *
 * @module check
 */

/**
 * @typedef {{
 *   rule: string,
 *   file: string,
 *   message: string,
 *   fix: string,
 * }} Violation
 */

/**
 * @typedef {{
 *   name: string,
 *   description: string,
 * }} RuleDescriptor
 */

/**
 * All available rule names with descriptions. Useful for help text and
 * documentation generators.
 *
 * @type {RuleDescriptor[]}
 */
export const RULES = [
  {
    name: 'components-have-register',
    description:
      'Component files that define a class extending WebComponent must register the class with ClassName.register(\'tag\') (or customElements.define). The server-side scanner derives the module URL from the file path.',
  },
  {
    name: 'no-server-env-in-components',
    description:
      'Component files (under components/ or modules/*/components/) must not read non-public environment variables. process.env.X is allowed when X starts with WEBJS_PUBLIC_ (exposed to the browser via the SSR shim) or equals NODE_ENV (also defined in the browser). Any other process.env read in a component would leak the server-side value into the SSR\'d HTML, then read as undefined after hydration. Read server-only env vars in a page function, server action, or middleware (which never reach the browser as source) and pass derived values to the component as attributes.',
  },
  {
    name: 'tag-name-has-hyphen',
    description:
      'Static tag = \'...\' in component files must contain a hyphen (HTML custom element spec).',
  },
  {
    name: 'no-duplicate-tag',
    description:
      'A custom-element tag name must be registered exactly once across the app. Two `Class.register(\'tag\')` / `customElements.define(\'tag\', …)` calls for the SAME tag resolve INCONSISTENTLY at runtime: SSR overwrites the registry (last registration wins) while the browser keeps the first native upgrade, so the rendered element and the webjs registry disagree. Rename one tag.',
  },
  {
    name: 'no-static-properties',
    description:
      'Reactive properties must be declared via the `extends WebComponent({ … })` factory, never a hand-written `static properties = { … }` field in the class body. The factory types each field for you (no `declare` needed) and the runtime throws on a direct `static properties`. Migrate `class X extends WebComponent { static properties = { count: { type: Number } } }` to `class X extends WebComponent({ count: Number })`; use the `prop()` helper for options (`prop(Number, { reflect: true })`) and set defaults in the constructor after super().',
  },
  {
    name: 'reactive-props-no-class-field',
    description:
      'A reactive property declared via the `extends WebComponent({ … })` factory must NOT also have a plain class-field initializer (`count = 0` or `count: number = 0`) in the class body. Under modern class-field semantics that initializer runs Object.defineProperty *after* super(), clobbering the framework\'s reactive accessor and silently breaking re-renders. Set the default by assigning in the constructor after super().',
  },
  {
    name: 'array-prop-uses-array-type',
    description:
      'An array-typed reactive property declared via the `extends WebComponent({ … })` factory must pass the `Array` runtime constructor, not `Object`: `count: prop<Tag[]>(Array)`, never `prop<Tag[]>(Object)`. The two share one converter (both JSON-encode the value), so the wrong one does not crash, but `Object` misstates the prop contract to the next reader and diverges from the documented built-in set (String/Number/Boolean/Object/Array). Fires only when the factory generic is itself an array type (`T[]`, `readonly T[]`, `Array<T>`, `ReadonlyArray<T>`) AND the constructor argument is `Object`; a bare `foo: Object` with no generic is never flagged. Fix: change the constructor to `Array`.',
  },
  {
    name: 'shell-in-non-root-layout',
    description:
      'Only the root layout (app/layout.{js,ts}) may write a <!doctype>/<html>/<head>/<body> shell to override default <html lang>, <body class>, etc. Non-root layouts (app/<segment>/layout.{js,ts}) and pages (app/**/page.{js,ts}) must not: the framework auto-emits the wrapper around the whole composition, so a nested shell ends up nested inside <body> where browsers drop it. Triggers on any of <!doctype>, <html, <head, <body in a non-root layout or page.',
  },
  {
    name: 'erasable-typescript-only',
    description:
      'Apps must opt into TypeScript\'s `erasableSyntaxOnly: true` so the compiler rejects non-erasable syntax (enum, namespace with values, constructor parameter properties, legacy decorators with emitDecoratorMetadata, import = require) at edit time. webjs strips types via Node\'s built-in `module.stripTypeScriptTypes`, which only supports erasable TypeScript and produces byte-exact position preservation (no sourcemap overhead). Files using non-erasable syntax fail at strip time and the dev server returns a 500 pointing at the no-non-erasable-typescript rule; webjs is buildless end-to-end and has no bundler fallback. The rule checks the project\'s tsconfig.json and warns when `erasableSyntaxOnly` is missing or set to false. Set `compilerOptions.erasableSyntaxOnly: true` in tsconfig.json to comply.',
  },
  {
    name: 'use-server-needs-extension',
    description:
      'Files that declare the `\'use server\'` directive at the top must also have the `.server.{js,ts,mts,mjs}` extension. The two markers are complementary, not interchangeable: `.server.ts` is the path-level boundary that triggers source protection by the file router; `\'use server\'` is the semantic opt-in that registers exports as RPC-callable from client code. A `\'use server\'` directive without the extension is silently ignored: the file is served to the browser as plain source, exports are NOT registered as RPC, and code the developer expects to run on the server actually runs in the browser. Rename the file to add the `.server.` infix.',
  },
  {
    name: 'use-server-exports-callable',
    description:
      'A `.server.{js,ts}` file that declares the `\'use server\'` directive registers its function exports as RPC-callable server actions, but only its FUNCTION exports: `buildActionIndex` / the stub generator register an export only when `typeof export === \'function\'`, so a `\'use server\'` file that exports zero functions (or only a non-function `const` / a type / only verb config like `method` / `cache`) registers NOTHING and gives no signal. The developer believes they exposed an action; nothing did, and the failure only surfaces as a 404 / undefined at the first call site. This is the complement of `use-server-needs-extension` (the directive without the extension) and of `one-action-per-configured-file` (more than one action in a configured file); this rule catches the directive-present-but-nothing-callable case. The rule asserts only that the file exports at least one callable, NOT that the action returns a value (a server action may be a void side-effect or throw `redirect()` / `notFound()` and never return). Conservative: a re-export (`export ... from`, `export *`) or an `export const NAME = <identifier-or-call>` (a possible factory-produced function such as `export const get = cache(fetch)`) is treated as a possible callable and NOT flagged, so the rule fires only when every export is provably non-callable. Fix: export an `async function` action, or drop the `\'use server\'` directive if the file is a plain server-only utility.',
  },
  {
    name: 'no-non-erasable-typescript',
    description:
      'Scans .ts / .mts source for the four non-erasable TypeScript constructs (enum declarations, namespace blocks with value statements, constructor parameter properties, and `import = require`) that the framework\'s type-stripper rejects at request time. Companion to `erasable-typescript-only`: that rule checks the tsconfig flag, this rule checks the actual source. Both run by default so the flag check catches violations early in the editor while the source scan catches violations even if the tsconfig flag is missing or the rule is bypassed. Skips node_modules, dist, build, .git, .next, and _private folders.',
  },
  {
    name: 'no-browser-globals-in-render',
    description:
      'Flags genuinely browser-only APIs used in a WebComponent constructor, willUpdate, or render() method. The SSR pipeline instantiates the component, runs willUpdate plus controllers\' hostUpdate, reflects properties, and calls render() to produce HTML, on a server element shim that backs the attribute methods but has no real DOM. So a browser global (document, window, localStorage, sessionStorage, navigator, location, matchMedia, screen, history) or an unshimmed HTMLElement member on `this` (attachShadow, shadowRoot, classList, querySelector, querySelectorAll, getBoundingClientRect, focus, blur, scrollIntoView) touched there throws at SSR time (the isomorphic footgun). The attribute methods (getAttribute/setAttribute/hasAttribute/removeAttribute/toggleAttribute), the event methods (addEventListener/removeEventListener/dispatchEvent), and attachInternals are shim-backed and run server-side, so they are NOT flagged. The flagged APIs belong in connectedCallback() or a lifecycle hook (firstUpdated/updated), which SSR never calls; seed first-paint defaults in the constructor (or derive them in willUpdate) only from server-known inputs (attributes, props). Conservative: only the constructor, willUpdate, and render bodies are scanned, and only direct references, so helper indirection is not flagged (the runtime SSR error covers that case).',
  },
  {
    name: 'no-server-import-in-browser-module',
    description:
      'A page / layout / component module that SHIPS to the browser (the build does NOT elide it) must not transitively import a server-only `.server.{ts,js}` module. The server module is replaced by a stub in the browser, so the import is fine while the page is display-only and elided (its server import is stripped), but the moment the page also does client work (it imports a component to register, enables the client router, uses a reactive primitive, …) it stops being elided and must load in the browser, dragging the server import with it. The stub then throws (or a server-only export like `auth` is missing) the instant the module loads, a runtime browser crash that `webjs typecheck` and the rest of `webjs check` miss. The rule reuses the build\'s own elision verdict, so it ONLY fires on modules that genuinely ship; a display-only page the framework elides is never flagged. The fix is to keep the server call off the browser-shipped module: gate the route in `middleware.ts`, call the server through a `\'use server\'` action, or register the component in a layout so the page elides again. Server-to-server imports (`.server.ts` importing `.server.ts`) and `middleware.ts` / `route.ts` (never shipped) are never flagged.',
  },
  {
    name: 'one-action-per-configured-file',
    description:
      'A `\'use server\'` action file that declares HTTP-verb config (any of `method` / `cache` / `tags` / `invalidates` / `validate`, #488) must export exactly ONE callable action function. The config is file-level (it applies to the action in the file), so a second exported function would silently inherit the same verb / cache, which is almost never intended and makes the contract ambiguous. Move the extra function to its own `.server.ts` file (the one-function-per-file convention), or, if it is a private helper, do not export it. Files with no verb config are unaffected.',
  },
  {
    name: 'no-scaffold-placeholder',
    description:
      'The one sentinel-based check, and the deliberate exception to the "objectively broken code" framing of the other rules: it flags scaffold example content that has not been replaced, so a delivered app contains only what the user intended and never leftover scaffold code. `webjs create` marks its example/demo files (the example homepage in app/page.ts, the example app chrome in app/layout.ts) with a one-line marker comment carrying the literal token `webjs-scaffold-placeholder`. The rule scans raw source (the marker lives in a comment, which the redacted scan view would hide) and fails for every file that still carries the token. A freshly scaffolded app fails this rule BY DESIGN until its placeholders are addressed: replace the example content, or deliberately keep it, and in either case delete the marker line. No finished app legitimately ships a literal remove-me marker, so this still qualifies as a check rather than a convention. The marker is acknowledge-and-remove, so keeping a piece is a one-line deletion rather than a forced rewrite.',
  },
];

/** Set of all known rule names for fast lookup. */
const RULE_NAMES = new Set(RULES.map((r) => r.name));

/**
 * Check whether a file has the `'use server'` directive in its first
 * five lines. Used by the `use-server-needs-extension` rule, and by
 * `isServerActionFile` below.
 * @param {string} content file content (already read)
 * @returns {boolean}
 */
function hasUseServerDirective(content) {
  const head = content.split('\n').slice(0, 5).join('\n');
  return /^\s*(['"])use server\1\s*;?\s*$/m.test(head);
}

/**
 * Check whether a file is a server action. A server action requires
 * BOTH the `.server.{js,ts,mts,mjs}` extension AND the `'use server'`
 * directive in the file head. Either alone is not enough: bare `.server.ts`
 * is a server-only utility (no RPC), and bare `'use server'` is a lint
 * violation (use-server-needs-extension).
 * @param {string} filePath absolute path
 * @param {string} content file content (already read)
 * @returns {boolean}
 */
function isServerActionFile(filePath, content) {
  if (!/\.server\.m?[jt]s$/.test(filePath)) return false;
  return hasUseServerDirective(content);
}

/**
 * Check whether a file resides under a components/ directory (shared or
 * module-scoped).
 * @param {string} relPath - path relative to appDir
 * @returns {boolean}
 */
function isComponentFile(relPath) {
  const segments = relPath.split(sep);
  return segments.includes('components');
}

/**
 * Scan a class body for class-field initializers naming any of `props`.
 * "Class-field" means: at the top of the class body (brace depth 0
 * relative to the body), at the start of a line, NOT prefixed with
 * `declare`, `static`, or `this.`.
 *
 * Returns the offending property names. The caller maps these to
 * Violation objects.
 *
 * @param {string} classBody
 * @param {Set<string>} props
 * @returns {string[]}
 */
/**
 * True when a factory prop value is an array-typed `prop<…>(…)` whose
 * runtime constructor argument is `Object`. The generic and the
 * constructor sit in the same call, so it is decidable from the value
 * text alone. The match is greedy on the generic so a nested generic
 * (`prop<Array<X>>(Object)`) closes at the outer `>` that precedes the
 * `(Object` call. A bare constructor (`Object`, with no generic) or a
 * non-array generic (`prop<Foo>(Object)`) returns false.
 *
 * @param {string} value the raw prop value text, e.g. `prop<Tag[]>(Object)`
 * @returns {boolean}
 */
function arrayPropUsesObject(value) {
  const m = /^prop\s*<([\s\S]*)>\s*\(\s*Object\s*[,)]/.exec(value.trim());
  if (!m) return false;
  return isArrayTypeText(m[1]);
}

/**
 * True when a TypeScript type expression denotes an array: `T[]`,
 * `readonly T[]`, `T[][]`, `Array<T>`, or `ReadonlyArray<T>`.
 *
 * @param {string} type
 * @returns {boolean}
 */
function isArrayTypeText(type) {
  const bare = type.trim().replace(/^readonly\s+/, '');
  if (/\[\s*\]$/.test(bare)) return true;
  if (/^(?:Readonly)?Array\s*<[\s\S]*>$/.test(bare)) return true;
  return false;
}

function findFieldInitializers(classBody, props) {
  /** @type {string[]} */
  const out = [];
  // Walk the body, tracking brace depth. At depth 0, look for
  // class-field-shaped lines.
  let depth = 0;
  let i = 0;
  let lineStart = 0;
  let str = '';
  while (i < classBody.length) {
    const c = classBody[i];
    if (str) {
      if (c === '\\') { i += 2; continue; }
      if (c === str) str = '';
      else if (str === '`' && c === '$' && classBody[i + 1] === '{') {
        depth++;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (c === '\n') {
      lineStart = i + 1;
      i++;
      continue;
    }
    if (c === '/' && classBody[i + 1] === '/') {
      while (i < classBody.length && classBody[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && classBody[i + 1] === '*') {
      i += 2;
      while (i < classBody.length && !(classBody[i] === '*' && classBody[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { str = c; i++; continue; }
    if (c === '{') { depth++; i++; continue; }
    if (c === '}') { depth--; i++; continue; }
    // At class-body top level, examine candidate lines starting at lineStart.
    if (depth === 0 && i === lineStart || (depth === 0 && /\s/.test(c) && i === lineStart)) {
      // Take the rest of the line up to a newline.
      let j = lineStart;
      while (j < classBody.length && classBody[j] !== '\n') j++;
      const line = classBody.slice(lineStart, j);
      // Match: optional whitespace, optional `public/private/protected/readonly`,
      // an identifier, optional `: <type>`, then `=`.
      const fieldRe = /^\s*(?:(public|private|protected|readonly)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[^=;]+)?\s*=\s*[^=>]/;
      const m = fieldRe.exec(line);
      if (m) {
        const name = m[2];
        // `declare`, `static`, and `this.` patterns shouldn't reach here
        // (declare/static start with their keyword, this.x has the dot in
        // the regex group), but guard against matching keywords as names:
        if (name !== 'declare' && name !== 'static' && props.has(name)) {
          out.push(name);
        }
      }
      // Advance past this line so we don't re-match.
      i = j;
      continue;
    }
    i++;
  }
  return out;
}

// Browser-only globals that are undefined during SSR (the server-side
// WebComponent base is a bare class with no DOM). High-confidence names only
// (unlikely to be ordinary local variables), so the rule stays low-noise.
const BROWSER_GLOBALS = [
  'document', 'window', 'localStorage', 'sessionStorage', 'navigator',
  'matchMedia', 'requestAnimationFrame', 'getComputedStyle',
  'IntersectionObserver', 'MutationObserver', 'ResizeObserver',
];
// HTMLElement instance members that do not exist on the server element shim,
// so `this.<member>` throws (a method call) or is `undefined` (a property) at
// SSR. The attribute methods (get/set/has/remove/toggleAttribute), the event
// methods (add/removeEventListener, dispatchEvent), and attachInternals are
// backed by the shim and run server-side, so they are intentionally NOT
// flagged: a component may read attributes in render and reflect properties
// during the SSR update cycle. What stays is the genuinely browser-only
// surface (DOM querying, layout reads, shadow construction, focus).
const HTMLELEMENT_MEMBERS = [
  'attachShadow', 'shadowRoot', 'classList',
  'querySelector', 'querySelectorAll', 'getBoundingClientRect',
  'focus', 'blur', 'scrollIntoView',
];

/**
 * Extract the body text of a named method from a (redacted) class body, or
 * '' if absent. Handles `async`, a TS return-type annotation, and params.
 * @param {string} classBody
 * @param {string} name
 */
function methodBodyOf(classBody, name) {
  const re = new RegExp(`(?:^|[\\s;}])(?:async\\s+)?${name}\\s*\\([^)]*\\)\\s*(?::[^{]*)?\\{`, 'g');
  const m = re.exec(classBody);
  if (!m) return '';
  const open = classBody.indexOf('{', m.index + m[0].length - 1);
  if (open === -1) return '';
  const close = matchClosingBrace(classBody, open + 1);
  return close === -1 ? '' : classBody.slice(open + 1, close);
}

/**
 * Find browser-only globals and HTMLElement `this.<member>` accesses in a
 * (redacted) method body. Returns one entry per distinct member.
 * @param {string} code
 * @returns {{ member: string, kind: string }[]}
 */
function findBrowserMemberUses(code) {
  // The class body arrives template-redacted, but `redactStringsAndTemplates`
  // keeps single/double-quoted string CONTENT (real specifiers ride strings).
  // Blank that too so a browser word inside a string literal (e.g. a label
  // `'open the document'`) is not mistaken for a real global access.
  code = code
    .replace(/'(?:[^'\\]|\\.)*'/g, (s) => `'${' '.repeat(Math.max(0, s.length - 2))}'`)
    .replace(/"(?:[^"\\]|\\.)*"/g, (s) => `"${' '.repeat(Math.max(0, s.length - 2))}"`);
  const out = [];
  const seen = new Set();
  const gRe = new RegExp(`(?<![.\\w$])(${BROWSER_GLOBALS.join('|')})\\b`, 'g');
  let m;
  while ((m = gRe.exec(code)) !== null) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ member: m[1], kind: 'a browser global' });
  }
  const hRe = new RegExp(`\\bthis\\.(${HTMLELEMENT_MEMBERS.join('|')})\\b`, 'g');
  while ((m = hRe.exec(code)) !== null) {
    const key = `this.${m[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ member: key, kind: 'an HTMLElement member' });
  }
  return out;
}

/**
 * Scan a webjs app directory and report convention violations.
 *
 * Every rule is a correctness check (a crash, a security leak, or a
 * build/type-strip failure), so they all run unconditionally. There is no
 * per-project disabling: project conventions (layout, style, process) live in
 * CONVENTIONS.md as guidance, not in this tool.
 *
 * @param {string} appDir  absolute path to the app root (the directory
 *   containing `app/`, `modules/`, `components/`, etc.)
 * @returns {Promise<Violation[]>}
 *
 * @example
 * ```js
 * import { checkConventions } from '@webjsdev/server';
 * const violations = await checkConventions('/path/to/myapp');
 * for (const v of violations) {
 *   console.warn(`[${v.rule}] ${v.file}: ${v.message}`);
 * }
 * ```
 */
export async function checkConventions(appDir) {
  /** @type {Violation[]} */
  const violations = [];

  // Collect all JS/TS files in the app directory. Each entry carries
  // both the raw `content` (for rules that need verbatim source: the
  // `'use server'` directive detector, the `.gitignore` reader, etc.)
  // and a `scan` view with comments, string contents, and
  // template-literal bodies redacted to whitespace. Rules that
  // pattern-match across raw source should consume `scan` so docs-
  // page code-block examples and JSDoc samples don't trigger false
  // positives.
  /** @type {{ abs: string, rel: string, content: string, scan: string }[]} */
  const files = [];
  for await (const abs of walk(appDir, (p) => /\.m?[jt]sx?$/.test(p))) {
    const rel = relative(appDir, abs);
    let content;
    try {
      content = await readFile(abs, 'utf8');
    } catch {
      continue;
    }
    files.push({ abs, rel, content, scan: redactStringsAndTemplates(content) });
  }

  // --- Rule: components-have-register ---
  {
    for (const { rel, scan } of files) {
      if (!isComponentFile(rel)) continue;
      // Use redacted source so a code-example string like
      // `Foo.register('bar')` inside a tagged template literal does
      // not falsely satisfy the rule for a sibling unregistered
      // class. Real register() calls live at top level where the
      // redactor leaves them alone.
      if (!/class\s+\w+\s+extends\s+WebComponent/.test(scan)) continue;
      // Accept either registration pattern:
      //   Counter.register('tag')                    (webjs idiom)
      //   customElements.define('tag', Counter)      (native)
      if (/\b[A-Z][A-Za-z0-9_$]*\.register\s*\(\s*['"`]/.test(scan)) continue;
      if (/\bcustomElements\.define\s*\(/.test(scan)) continue;
      violations.push({
        rule: 'components-have-register',
        file: rel,
        message: "Component extends WebComponent but is never registered. Call ClassName.register('tag-name') at the bottom of the file.",
        fix: "Add `ClassName.register('tag-name')` after the class definition",
      });
    }
  }

  // --- Rule: no-static-properties ---
  // A hand-written `static properties = { … }` in a WebComponent class body is
  // no longer supported: reactive properties are declared via the
  // `extends WebComponent({ … })` factory (the runtime throws on a direct
  // `static properties`). Flag it statically so the editor catches it before
  // the page 500s.
  {
    for (const { rel, scan } of files) {
      // Use redacted source so fixture-style strings like
      // `class X extends WebComponent { static properties = {…} }` inside
      // template literals don't trip the rule. Real declarations live at
      // top-level code where the redactor leaves them alone.
      if (!/class\s+\w+\s+extends\s+WebComponent/.test(scan)) continue;
      for (const { body } of extractWebComponentClassBodies(scan)) {
        if (!/static\s+properties\s*=\s*\{/.test(body)) continue;
        violations.push({
          rule: 'no-static-properties',
          file: rel,
          message:
            '`static properties = { … }` is no longer supported; declare reactive properties via the `extends WebComponent({ … })` factory instead.',
          fix: 'Move the properties into the factory call: `class X extends WebComponent({ count: Number })`. Use `prop(Number, { reflect: true })` for options and set defaults in the constructor after super(). Delete the `static properties` block and any `declare` fields for those props.',
        });
      }
    }
  }

  // --- Rule: reactive-props-no-class-field ---
  // A reactive property declared via the factory must not also carry a plain
  // class-field initializer: it runs Object.defineProperty after super() and
  // clobbers the framework's reactive accessor (silent broken re-renders).
  {
    for (const { rel, scan } of files) {
      if (!/class\s+\w+\s+extends\s+WebComponent/.test(scan)) continue;
      for (const { body, factoryProps } of extractWebComponentClassBodies(scan)) {
        if (factoryProps.size === 0) continue;
        for (const bad of findFieldInitializers(body, factoryProps)) {
          violations.push({
            rule: 'reactive-props-no-class-field',
            file: rel,
            message: `Reactive prop \`${bad}\` uses a class-field initializer; this clobbers the framework's reactive accessor under modern class-field semantics.`,
            fix: `Remove the class-field initializer and set the default by assigning \`this.${bad} = <value>\` inside \`constructor()\` after \`super()\`.`,
          });
        }
      }
    }
  }

  // --- Rule: array-prop-uses-array-type ---
  // An array-typed reactive prop declared via the factory should pass the
  // `Array` runtime constructor, not `Object`. Both share one converter
  // (JSON encode/decode), so `Object` does not crash, but it misstates the
  // prop contract and diverges from the documented built-in set. Fires only
  // when the factory generic is itself an array type AND the constructor is
  // `Object`; a bare `foo: Object` (no generic to prove array-ness) is left
  // alone to avoid false positives. Uses the redacted `scan`, so a
  // `prop<X[]>(Object)` shown inside an html`` example string never fires.
  {
    for (const { rel, scan } of files) {
      if (!/class\s+\w+\s+extends\s+WebComponent/.test(scan)) continue;
      for (const { factoryArg } of extractWebComponentClassBodies(scan)) {
        const objStart = factoryArg.indexOf('{');
        if (objStart === -1) continue;
        const objEnd = matchClosingBrace(factoryArg, objStart + 1);
        if (objEnd === -1) continue;
        const objContent = factoryArg.slice(objStart + 1, objEnd);
        for (const { key, value } of parsePropEntries(objContent)) {
          if (!arrayPropUsesObject(value)) continue;
          violations.push({
            rule: 'array-prop-uses-array-type',
            file: rel,
            message: `Array-typed reactive prop \`${key}\` is declared with the \`Object\` constructor (\`prop<…[]>(Object)\`); use \`Array\` so the runtime converter matches the declared shape.`,
            fix: `Change the constructor to \`Array\`: \`${key}: prop<…[]>(Array)\`. Object and Array share one converter so behaviour is unchanged, but \`Array\` states the prop's shape correctly.`,
          });
        }
      }
    }
  }

  // --- Rule: no-browser-globals-in-render ---
  // The SSR pipeline runs the constructor (`new Cls()`), willUpdate, and
  // render() on the server element shim (attribute methods backed, but no real
  // DOM). A genuinely browser-only global or an unshimmed HTMLElement member on
  // `this` touched in any of those throws at SSR time. Those belong in
  // connectedCallback / post-render hooks, which SSR never calls. willUpdate is
  // scanned because it now runs at SSR (issue #217).
  {
    for (const { rel, scan } of files) {
      if (!/class\s+\w+\s+extends\s+WebComponent/.test(scan)) continue;
      for (const { body } of extractWebComponentClassBodies(scan)) {
        for (const method of ['constructor', 'willUpdate', 'render']) {
          const code = methodBodyOf(body, method);
          if (!code) continue;
          for (const { member, kind } of findBrowserMemberUses(code)) {
            violations.push({
              rule: 'no-browser-globals-in-render',
              file: rel,
              message: `\`${member}\` (${kind}) is used in ${method}(), which runs during SSR where it is not available, so it throws and the component fails to server-render.`,
              fix: `Move browser-only work to connectedCallback() or a lifecycle hook (firstUpdated/updated), which SSR never calls. Seed first-paint defaults in the constructor only from server-known inputs (attributes / props), then refine in connectedCallback by writing to a signal.`,
            });
          }
        }
      }
    }
  }

  // --- Rule: no-scaffold-placeholder ---
  // `webjs create` marks its example/demo files (app/page.ts, app/layout.ts)
  // with a one-line marker comment so a delivered app cannot silently ship
  // leftover scaffold content. Scan RAW `content`: the marker lives in a
  // comment, which the `scan` view redacts to whitespace. One violation per
  // still-marked file. The token is assembled here so this source does not
  // itself carry the contiguous literal.
  {
    const MARKER = 'webjs-scaffold-' + 'placeholder';
    for (const { rel, content } of files) {
      if (!content.includes(MARKER)) continue;
      violations.push({
        rule: 'no-scaffold-placeholder',
        file: rel,
        message:
          'Scaffold placeholder marker still present. This file is unmodified example content from `webjs create`, and the delivered app should contain only what the user intended, not leftover scaffold code.',
        fix: `Replace the example content (or deliberately keep it), then delete the marker comment line carrying the ${MARKER} token.`,
      });
    }
  }

  // --- Rule: no-server-env-in-components ---
  // Catches `process.env.X` reads in component files where X is not a
  // WEBJS_PUBLIC_* var and not NODE_ENV. The SSR shim only exposes those
  // two categories to the browser; any other read either leaks a secret
  // into the SSR'd HTML or reads as undefined after hydration.
  {
    for (const { abs, rel, content } of files) {
      if (!isComponentFile(rel)) continue;
      if (isServerActionFile(abs, content)) continue;

      const re = /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/g;
      const seen = new Set();
      let m;
      while ((m = re.exec(content)) !== null) {
        const name = m[1];
        if (name.startsWith('WEBJS_PUBLIC_')) continue;
        if (name === 'NODE_ENV') continue;
        if (seen.has(name)) continue;
        seen.add(name);
        violations.push({
          rule: 'no-server-env-in-components',
          file: rel,
          message: `Component reads process.env.${name}; server-only env vars must not be read in components (would leak into SSR'd HTML and read as undefined after hydration)`,
          fix: `Either rename to WEBJS_PUBLIC_${name} if the value is intended for the browser, or read process.env.${name} in a page function / server action / middleware and pass a derived value to the component as an attribute.`,
        });
      }
    }
  }

  // --- Rule: shell-in-non-root-layout ---
  // Only app/layout.{js,ts} may write <!doctype>/<html>/<head>/<body>. The
  // framework auto-emits the shell around the whole composition; a nested
  // shell ends up duplicated and silently dropped by the HTML parser.
  {
    // Root layout = exactly "app/layout.js" or "app/layout.ts".
    const ROOT_LAYOUT = /^app\/layout\.(?:js|mjs|ts|mts)$/;
    // Any other layout or page under app/ (including pages, nested layouts).
    const LAYOUT_OR_PAGE = /^app\/(?:.+\/)?(?:layout|page)\.(?:js|mjs|ts|mts)$/;
    // Shell tags. Case-insensitive, allow whitespace, allow attributes for <html>/<body>.
    const SHELL_RE = /<!doctype\b|<html\b|<head\b|<body\b/i;
    for (const { rel, content } of files) {
      if (ROOT_LAYOUT.test(rel)) continue;
      if (!LAYOUT_OR_PAGE.test(rel)) continue;
      // Strip line comments + /* … */ block comments + ` ` string-template
      // tag content is fine: we're looking at the literal HTML in the
      // returned `html` template, which won't be inside a code comment.
      // A naive substring scan is good enough; false positives only when
      // someone genuinely embeds `<html>` inside a string literal that
      // isn't a layout shell (rare and probably an honest code smell).
      const stripped = content
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      const m = stripped.match(SHELL_RE);
      if (m) {
        violations.push({
          rule: 'shell-in-non-root-layout',
          file: rel,
          message:
            `Non-root layout/page contains ${m[0]}: only the root layout (app/layout.{js,ts}) may write the shell. The framework auto-emits <!doctype>/<html>/<head>/<body> around the whole composition; a nested shell ends up duplicated and dropped by the HTML parser.`,
          fix:
            'Remove the <!doctype>/<html>/<head>/<body> wrapper from this file. Use the `metadata` export for <title>/<meta>/og/twitter, return inline <link>/<style>/<script> for head-bound resources (they auto-hoist), and put any `<html lang>` / `<body class>` overrides in app/layout.{js,ts} instead.',
        });
      }
    }
  }

  // --- Rule: erasable-typescript-only ---
  // The dev server's type-stripper is Node's built-in
  // module.stripTypeScriptTypes, which rejects non-erasable TS (enum,
  // namespace with values, constructor parameter properties, legacy
  // decorators, `import = require`). There is no fallback: non-erasable
  // syntax is rejected at request time with a 500. Enforce TS-side
  // rejection of those patterns via `compilerOptions.erasableSyntaxOnly:
  // true` in tsconfig.json so violations surface as red squiggles in
  // the editor before they ever hit the dev server. The companion
  // no-non-erasable-typescript rule (below) catches violations even if
  // the tsconfig flag is unset.
  {
    let tsconfigContent = null;
    try {
      tsconfigContent = await readFile(join(appDir, 'tsconfig.json'), 'utf8');
    } catch {
      // No tsconfig.json (pure JS app). Skip the rule.
    }
    if (tsconfigContent != null) {
      let parsed = null;
      try {
        const stripped = tsconfigContent
          .replace(/\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/,(\s*[}\]])/g, '$1');
        parsed = JSON.parse(stripped);
      } catch {
        parsed = null;
      }
      const compilerOptions = parsed && typeof parsed === 'object' ? parsed.compilerOptions : null;
      const flag = compilerOptions && typeof compilerOptions === 'object' ? compilerOptions.erasableSyntaxOnly : undefined;
      if (flag !== true) {
        violations.push({
          rule: 'erasable-typescript-only',
          file: 'tsconfig.json',
          message:
            flag === false
              ? '`compilerOptions.erasableSyntaxOnly` is `false`. The framework strips TypeScript via Node\'s built-in stripper, which only supports erasable TS. Non-erasable syntax (enum, namespace with values, constructor parameter properties, legacy decorators) fails at strip time and the dev server returns a 500. webjs is buildless end-to-end and has no bundler fallback; turn the flag on so the TypeScript compiler catches non-erasable constructs as red squiggles at edit time.'
              : '`compilerOptions.erasableSyntaxOnly` is not set. The framework strips TypeScript via Node\'s built-in stripper, which only supports erasable TS. Setting this flag makes the TypeScript compiler flag non-erasable syntax as a red squiggle in the editor instead of letting it silently slip through to a 500 at runtime.',
          fix:
            'Set `"erasableSyntaxOnly": true` under `compilerOptions` in tsconfig.json. Replace any existing `enum` declarations with `const X = { ... } as const` plus a `type X = typeof X[keyof typeof X]` union. Replace constructor parameter properties with explicit field declarations + assignments.',
        });
      }
    }
  }

  // --- Rule: no-non-erasable-typescript ---
  // Scans .ts source for the four non-erasable TypeScript constructs
  // that the runtime stripper rejects. Complement to
  // erasable-typescript-only: the flag check catches the case where
  // the user opts into the tsconfig flag; this scan catches the
  // case where the flag is missing OR the user has bypassed it and
  // written offending syntax anyway. Both rules ship enabled by
  // default so violators get the strongest signal possible.
  {
    /** @type {Array<{ name: string, regex: RegExp, fix: string }>} */
    const NON_ERASABLE_PATTERNS = [
      {
        name: 'enum',
        // Matches `enum X {`, `export enum X {`, `const enum X {`,
        // `declare enum X {`. Requires uppercase first letter on the
        // identifier to avoid matching variables literally named "enum"
        // in user code (rare but possible).
        regex: /^[ \t]*(?:export[ \t]+)?(?:declare[ \t]+)?(?:const[ \t]+)?enum[ \t]+[A-Z]\w*[ \t]*\{/m,
        fix: 'Replace `enum Foo { A, B }` with `const Foo = { A: "A", B: "B" } as const; type Foo = typeof Foo[keyof typeof Foo];`.',
      },
      {
        name: 'namespace with values',
        // Matches `namespace Foo { ... <value statement> ... }` at top
        // level. Type-only namespaces (which ARE erasable) won't contain
        // `let|const|var|function|class` as statements, so this catches
        // only the value-carrying form. False positives possible for
        // type-only namespaces that contain those words in type aliases;
        // accept this as a soft warning.
        regex: /^[ \t]*(?:export[ \t]+)?namespace[ \t]+\w+[ \t]*\{[\s\S]*?\b(?:let|const|var|function|class)\b/m,
        fix: 'Replace `namespace Foo { export const x = 1 }` with `export const Foo = { x: 1 } as const;` or split the contents into separate modules.',
      },
      {
        name: 'constructor parameter property',
        // Matches `constructor(public x: T)`, `constructor(private foo, ...)`,
        // `constructor(readonly bar)`. Looks for one of the four access
        // modifiers immediately followed by an identifier inside the
        // constructor's parameter list.
        regex: /constructor[ \t]*\([^)]*\b(?:public|private|protected|readonly)[ \t]+\w+/,
        fix: 'Replace `constructor(public x: number)` with `x: number; constructor(x: number) { this.x = x; }`.',
      },
      {
        name: 'import = require',
        // TypeScript-style CommonJS import. Catches `import foo =
        // require("bar")` and `export import foo = require("bar")`.
        regex: /^[ \t]*(?:export[ \t]+)?import[ \t]+\w+[ \t]*=[ \t]*require[ \t]*\(/m,
        fix: 'Replace `import foo = require("bar")` with `import * as foo from "bar"` or `import { something } from "bar"`.',
      },
    ];

    // Walk every .ts / .mts file under appDir, skipping node_modules,
    // build outputs, version control, and the framework's own private
    // folders. Match the conventional excludes that fs-walk.js's caller
    // contract expects.
    for await (const abs of walk(appDir, (p) => /\.m?ts$/.test(p))) {
      // Skip anything inside node_modules or common build / cache dirs.
      const relPath = relative(appDir, abs);
      if (
        relPath.includes('node_modules' + sep) ||
        relPath.startsWith('dist' + sep) ||
        relPath.startsWith('build' + sep) ||
        relPath.startsWith('.next' + sep) ||
        relPath.startsWith('.git' + sep) ||
        relPath.split(sep).some((s) => s.startsWith('_'))
      ) {
        continue;
      }
      let content;
      try {
        content = await readFile(abs, 'utf8');
      } catch {
        continue;
      }
      // Redact comments, string contents, and template-literal bodies
      // so docs-page code examples like `<pre>enum Direction { ... }</pre>`
      // inside `html\`...\`` template literals don't trip the rule.
      // The redactor preserves line + column so the reported line
      // number still maps to the right place in the original.
      const scan = redactStringsAndTemplates(content);
      for (const { name, regex, fix } of NON_ERASABLE_PATTERNS) {
        const m = scan.match(regex);
        if (m && typeof m.index === 'number') {
          const line = content.slice(0, m.index).split('\n').length;
          violations.push({
            rule: 'no-non-erasable-typescript',
            file: relPath,
            message: `Non-erasable TypeScript construct (${name}) detected at line ${line}. The framework's type-stripper rejects this at request time with a 500.`,
            fix,
          });
        }
      }
    }
  }

  // --- Rule: use-server-needs-extension ---
  // Catch files that declare `'use server'` at the top but lack the
  // `.server.{js,ts}` extension. Under the two-marker convention the
  // directive alone does nothing (the file is served to the browser as
  // plain source and exports are not registered as RPC), which is a
  // silent footgun. The fix is mechanical: rename the file.
  {
    for (const { rel, content } of files) {
      if (!hasUseServerDirective(content)) continue;
      if (/\.server\.m?[jt]s$/.test(rel)) continue; // OK: has both markers
      const fileBase = basename(rel);
      const renamedBase = fileBase.replace(/\.(m?[jt]sx?)$/, '.server.$1');
      violations.push({
        rule: 'use-server-needs-extension',
        file: rel,
        message:
          "File declares `'use server'` but its name does not match `.server.{js,ts,mts,mjs}`. The directive is silently ignored: the file is served to the browser as plain source and its exports are not RPC-callable. Code the developer expects to run on the server actually runs in the browser.",
        fix: `Rename to ${renamedBase} (add the .server. infix before the extension)`,
      });
    }
  }

  // --- Rule: use-server-exports-callable (#464) ---
  // A `.server.{js,ts}` file with the `'use server'` directive registers only
  // its FUNCTION exports as RPC actions (the registrar checks `typeof === 'function'`).
  // A file that declares the directive but exports no callable registers nothing,
  // silently: the developer thinks they exposed an action, and the only signal is
  // a 404 / undefined at the first call site. Flag it. The complement of
  // use-server-needs-extension (the directive without the extension) and of
  // one-action-per-configured-file (more than one action).
  {
    for (const { rel, content, scan } of files) {
      // Only properly-marked action files (the extension boundary). A `'use
      // server'` file WITHOUT the .server. extension is the use-server-needs-
      // extension rule's job; do not double-flag it here.
      if (!/\.server\.m?[jt]s$/.test(rel)) continue;
      if (!hasUseServerDirective(content)) continue;
      // Count function-shaped EXPORTED callables, the SAME way the action
      // registrar sees them: function declarations + arrow / function-expression
      // consts (with an optional `: Type` annotation, #495). Reserved verb-config
      // names (method/cache/...) are config, never a callable action.
      const names = new Set();
      let m;
      const reFn = /\bexport\s+(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)/g;
      while ((m = reFn.exec(scan))) names.add(m[1]);
      const reArrow = /\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*(?::(?:[^=]|=>)*?)?=(?!>)\s*(?:async\s+)?(?:function\b|(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/g;
      while ((m = reArrow.exec(scan))) names.add(m[1]);
      const callables = [...names].filter((n) => !RESERVED_CONFIG.has(n));
      if (callables.length > 0) continue; // exports at least one callable -> fine
      // A default export is assumed callable (an action commonly default-exports).
      if (/\bexport\s+default\b/.test(scan)) continue;
      // Conservative, avoid a FALSE POSITIVE: the runtime registrar
      // (`actionFunctionNames`) keeps EVERY export whose value is a function at
      // load time, regardless of the export syntax, so any export shape these
      // patterns cannot prove is non-callable must NOT be flagged. Skip when the
      // file has:
      //   - a named-export clause `export { a, b as c }` (with or WITHOUT `from`):
      //     it can surface a local function (`function getX(){}; export { getX }`)
      //     or a re-exported / imported function, neither matched above;
      //   - a star re-export `export * from ...`;
      //   - a destructuring export `export const { x } = obj` / `export const [x] = arr`,
      //     which may bind a function;
      //   - an `export const NAME = <identifier-or-call>`, a factory-produced
      //     function (`export const get = cache(fetch)`).
      // A sole `export { aConst }` of a non-function is then a tolerated FALSE
      // NEGATIVE, which is the right bias for a non-overridable correctness rule.
      if (/\bexport\s*\{/.test(scan)) continue;
      if (/\bexport\s*\*/.test(scan)) continue;
      if (/\bexport\s+(?:const|let|var)\s*[{[]/.test(scan)) continue;
      // A factory / identifier-valued const could be a callable ACTION, so skip,
      // BUT only when its name is NOT a reserved config key: the registrar
      // excludes reserved names from actions (`actionFunctionNames`), so a file
      // whose only ambiguous const is `validate` / `tags` / ... (config produced
      // by an arrow or a factory) still has zero actions and must flag. Skip only
      // for a NON-reserved ambiguous const (a real possible action).
      const reFactory = /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::(?:[^=]|=>)*?)?=\s*[A-Za-z_$(]/g;
      let ambiguousAction = false;
      while ((m = reFactory.exec(scan))) { if (!RESERVED_CONFIG.has(m[1])) { ambiguousAction = true; break; } }
      if (ambiguousAction) continue;
      // Every export is provably non-callable (a literal const, a type) or there
      // are none: the directive exposes nothing.
      violations.push({
        rule: 'use-server-exports-callable',
        file: rel,
        message:
          "File declares `'use server'` but exports no callable action. The `'use server'` directive registers FUNCTION exports as RPC-callable; a file exporting only a non-function (a `const` / a type / only verb config) registers nothing, so a client import resolves to nothing and the call 404s.",
        fix: "Export an `async function` action from this file, or remove the `'use server'` directive if it is a plain server-only utility.",
      });
    }
  }

  // --- Rule: one-action-per-configured-file (#488) ---
  // A `'use server'` file that declares HTTP-verb config (method/cache/tags/
  // invalidates/validate) must export exactly one callable action; the config
  // is file-level, so a second exported function would silently inherit it.
  {
    for (const { rel, content, scan } of files) {
      if (!/\.server\.m?[jt]s$/.test(rel)) continue;
      if (!hasUseServerDirective(content)) continue;
      if (!/\bexport\s+const\s+(?:method|cache|tags|invalidates|validate|middleware)\b/.test(scan)) continue;
      const names = new Set();
      let m;
      const reFn = /\bexport\s+(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)/g;
      while ((m = reFn.exec(scan))) names.add(m[1]);
      // An arrow-const action: `export const x = (...) => ...`, the paren-less
      // `export const x = id => ...`, or a function expression. The `=>` /
      // `function` anchor keeps a plain `export const N = 5` from counting.
      // An OPTIONAL `: Type` annotation may sit between the name and the `=`
      // (#495); the type itself can contain a function-type `=>`, so the
      // annotation matcher consumes any non-`=` char OR a literal `=>`, and the
      // assignment is the first `=` NOT followed by `>` (`=(?!>)`). The
      // alternation is unambiguous at each position (a `=` can only start `=>`),
      // so there is no catastrophic backtracking.
      const reArrow = /\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*(?::(?:[^=]|=>)*?)?=(?!>)\s*(?:async\s+)?(?:function\b|(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/g;
      while ((m = reArrow.exec(scan))) names.add(m[1]);
      if (/\bexport\s+default\b/.test(scan)) names.add('default');
      const actions = [...names].filter((n) => !RESERVED_CONFIG.has(n));
      if (actions.length > 1) {
        violations.push({
          rule: 'one-action-per-configured-file',
          file: rel,
          message: `Configured action file exports ${actions.length} callable functions (${actions.join(', ')}); the verb/cache config is file-level, so only one action per file is allowed.`,
          fix: 'Move the extra function to its own .server.{js,ts} file, or keep it private (do not export it).',
        });
      }
    }
  }

  // --- Rule: tag-name-has-hyphen ---
  {
    for (const { rel, scan } of files) {
      if (!isComponentFile(rel)) continue;
      // Use redacted source. A `register('tag')` call inside a
      // TAGGED template literal (docs-page code example) is blanked.
      // Calls at top level keep their structure AND their string
      // argument. Quote style can be ', ", or ` (untagged backtick
      // literals survive the redactor, like single/double-quote
      // strings).
      const patterns = [
        // Class.register('tag') / register("tag") / register(`tag`)
        /\b[A-Z][A-Za-z0-9_$]*\.register\s*\(\s*(['"`])([^'"`]+)\1/g,
        // customElements.define('tag', Class) and quote variants
        /\bcustomElements\.define\s*\(\s*(['"`])([^'"`]+)\1/g,
      ];
      for (const re of patterns) {
        let match;
        while ((match = re.exec(scan)) !== null) {
          const tagName = match[2];
          if (!tagName.includes('-')) {
            violations.push({
              rule: 'tag-name-has-hyphen',
              file: rel,
              message: `Custom element tag "${tagName}" must contain a hyphen`,
              fix: `Rename to a hyphenated tag name, e.g. "app-${tagName}" or "${tagName}-element"`,
            });
          }
        }
      }
    }
  }

  // --- Rule: no-duplicate-tag ---
  // Two registrations of the SAME tag string anywhere in the app resolve
  // inconsistently at runtime (SSR last-wins, browser first-wins), so flag
  // every colliding site naming the others. Scans EVERY source file, not just
  // components/, because a duplicate is a runtime hazard regardless of where
  // the register/define call lives (a page, a lib, a module can register a
  // tag too); this keeps the rule in lockstep with the editor's 9004
  // diagnostic, which is likewise project-wide. Reuses the same
  // register/define extraction as tag-name-has-hyphen, over the redacted
  // source so a tag in a docs-page tagged-template example does not count.
  // Only hyphenated tags are considered (a non-hyphenated tag is already
  // flagged by tag-name-has-hyphen / invariant 3), matching the 9004 filter.
  {
    // Generated / gitignored files (e.g. a `webjs ui add`-regenerated
    // `components/` dir) are not committed source the rule should police;
    // counting them would flag a collision between a hand-written component
    // and its generated copy. Skip anything git reports as ignored.
    // Best-effort: a non-git project (or absent git) scans everything.
    const ignored = await gitIgnoredSet(appDir, files.map((f) => f.rel));
    /** @type {Map<string, string[]>} tag -> rel files that register it (with repeats) */
    const tagSites = new Map();
    const patterns = [
      /\b[A-Z][A-Za-z0-9_$]*\.register\s*\(\s*(['"`])([^'"`]+)\1/g,
      /\bcustomElements\.define\s*\(\s*(['"`])([^'"`]+)\1/g,
    ];
    for (const { scan, rel } of files) {
      if (ignored.has(rel)) continue;
      for (const re of patterns) {
        let match;
        while ((match = re.exec(scan)) !== null) {
          const tagName = match[2];
          if (!tagName.includes('-')) continue;
          const arr = tagSites.get(tagName) || [];
          arr.push(rel);
          tagSites.set(tagName, arr);
        }
      }
    }
    for (const [tagName, sites] of tagSites) {
      if (sites.length < 2) continue;
      // Report once per DISTINCT file, naming the others.
      for (const file of new Set(sites)) {
        const others = [...new Set(sites)].filter((f) => f !== file);
        const where = others.length
          ? `also registered in ${others.join(', ')}`
          : 'registered more than once in this file';
        violations.push({
          rule: 'no-duplicate-tag',
          file,
          message: `Custom element tag "${tagName}" is registered more than once (${where}). A tag must be registered exactly once; the runtime resolves a duplicate inconsistently (SSR keeps the last registration, the browser keeps the first).`,
          fix: `Rename one registration so each "${tagName}" is unique, e.g. "${tagName}-2".`,
        });
      }
    }
  }

  // --- Rule: no-server-import-in-browser-module ---
  // A page / layout / component module that SHIPS to the browser must not
  // transitively import a server-only `.server.{ts,js}` module. The browser
  // gets a stub for the server file, so the import is harmless while the page
  // is display-only and the framework ELIDES it (its server import is stripped
  // from the served source). But the moment the page also does client work
  // (imports a component to register, enables the client router, uses a
  // reactive primitive, …) it stops being elided, must load in the browser,
  // and drags the server import with it: the stub throws (or a server-only
  // export like `auth` is missing) the instant the module loads. That crash
  // only surfaces at runtime; typecheck and every other check pass.
  //
  // The rule reuses the BUILD'S elision verdict (analyzeElision) instead of
  // re-deriving it, so it fires ONLY on modules that genuinely ship: a
  // display-only page the framework elides is never flagged (that is the
  // legitimate pattern). The motivating case (crisp dogfood): a page that does
  // `await auth()` (import from `lib/auth.server.ts`) AND imports a component
  // directly, so it is not elided and ships the server import.
  await checkServerImportInBrowserModule(appDir, violations);

  return violations;
}

/**
 * Implements `no-server-import-in-browser-module`. Factored into its own
 * function (rather than an inline block) because it does the heavier
 * whole-app analysis the other rules avoid: it builds the module graph,
 * scans components, builds the route table, and runs the framework's own
 * elision analysis so the rule's notion of "ships to the browser" is
 * byte-for-byte the build's.
 *
 * A module is flagged when BOTH hold:
 *   1. It SHIPS to the browser. For a component that means it is NOT in the
 *      elidable set; for a page / layout that means it is NOT in the inert
 *      route-module set. (Pages and layouts that do real client work are not
 *      inert and therefore ship.)
 *   2. Its transitive import closure reaches a `.server.{ts,js}` module.
 *      `transitiveDeps` stops AT a server file (it is included but not walked
 *      into), so a server file pulled in only through another server file is
 *      not attributed to a browser module that never reaches it directly.
 *
 * Also flagged: error / loading / not-found modules. These ship to the browser
 * too (the dev server's `computeBrowserBoundFiles` adds them unconditionally)
 * and are never elided, so a server import reaching one of them is the same
 * throw-at-load crash.
 *
 * Never flagged: a `.server.ts` importing another `.server.ts` (server-to-
 * server, and `.server.*` modules are not components nor route modules), and
 * `middleware.ts` / `route.ts` (server-only, never page/layout/component
 * entries, so they are not in the candidate set to begin with).
 *
 * Scope note for dynamic imports: a string-literal `import('./widget.ts')` IS
 * tracked by the module graph now (#751), but only as a GATE edge (so the
 * lazily-imported module is servable); this rule's server-import detection
 * still runs over STATIC edges only (`transitiveDeps`), so a dynamic
 * `import('./x.server.ts')` of a no-`'use server'` utility is not flagged here.
 * That is deliberate: the throw-at-load crash is deferred to call time (when
 * the module is actually fetched), not module load, and a dynamic import is
 * also not elided framework-wide. A computed `import(expr)` cannot be resolved
 * statically at all; rather than a false-positive-prone check rule (a computed
 * import of an npm specifier or an otherwise-reachable app module is perfectly
 * valid, so it fails the check-is-correctness-only dividing line), the dev
 * server surfaces it with a 404 hint when the target 404s (see dev.js #751).
 *
 * @param {string} appDir
 * @param {Violation[]} violations  appended to in place
 */
async function checkServerImportInBrowserModule(appDir, violations) {
  // No `app/` directory means this is not a routable webjs app (e.g. a bare
  // component library, or a fixture with only `lib/`); nothing ships, so the
  // rule has nothing to police. Skip rather than do the heavy analysis.
  if (!(await pathExists(join(appDir, 'app')))) return;

  let moduleGraph, components, routeTable;
  try {
    moduleGraph = await buildModuleGraph(appDir);
    components = await scanComponents(appDir);
    routeTable = await buildRouteTable(appDir);
  } catch {
    // A malformed app the analysis can't process is left to the other rules
    // (and the dev server) to surface; this rule degrades to a no-op.
    return;
  }

  // Page + layout modules that the router treats as route modules, exactly the
  // set the dev server feeds to analyzeElision (so the inert verdict matches).
  /** @type {Set<string>} */
  const routeModuleSet = new Set();
  for (const page of routeTable.pages || []) {
    if (page.file) routeModuleSet.add(page.file);
    for (const f of page.layouts || []) routeModuleSet.add(f);
  }
  const routeModules = [...routeModuleSet];

  // error / loading / not-found modules ALSO ship to the browser, but unlike
  // pages + layouts they are never elided: the dev server's
  // `computeBrowserBoundFiles` adds them to the browser-bound entry set
  // unconditionally (only ELIDABLE-COMPONENT imports are ever stripped, and
  // these modules have no component to strip). So a personalized 404 that does
  // `await auth()` is a real throw-at-load crash the page+layout-only candidate
  // set would miss. Collect them here and add them to the candidate set as
  // always-shipping (no elision verdict to consult).
  /** @type {Map<string, string>} abs file -> kind */
  const alwaysShipRouteModules = new Map();
  for (const page of routeTable.pages || []) {
    for (const f of page.errors || []) alwaysShipRouteModules.set(f, 'error boundary');
    for (const f of page.loadings || []) alwaysShipRouteModules.set(f, 'loading boundary');
  }
  if (routeTable.notFound) alwaysShipRouteModules.set(routeTable.notFound, 'not-found page');
  if (routeTable.notFounds) {
    for (const f of routeTable.notFounds.values()) {
      alwaysShipRouteModules.set(f, 'not-found page');
    }
  }

  // The elision flag mirrors `dev.js`: respect `webjs.elide === false` and the
  // WEBJS_ELIDE override. When elision is OFF, the build ships EVERY component
  // and route module, so the verdict is "nothing is elidable / inert" and the
  // rule treats every candidate as shipping (which is correct: with elision
  // off, a display-only page really does ship its server import too).
  const elideEnabled = await readElideEnabledForCheck(appDir);
  const { elidableComponents, inertRouteModules } = elideEnabled
    ? await analyzeElision(components, routeModules, moduleGraph, (f) => readFile(f, 'utf8'), appDir)
    : { elidableComponents: new Set(), inertRouteModules: new Set() };

  // Candidate browser-shipped modules: components that are NOT elided, plus
  // route modules that are NOT inert. A `.server.*` file is never a component
  // (the scanner skips it) nor a route module the browser loads, so it cannot
  // enter this set; server-to-server imports are excluded by construction.
  /** @type {Map<string, { kind: string }>} relFile is keyed by ABS path */
  const candidates = new Map();
  for (const c of components) {
    if (!elidableComponents.has(c.file)) candidates.set(c.file, { kind: 'component' });
  }
  for (const file of routeModules) {
    if (inertRouteModules.has(file)) continue;
    const base = basename(file);
    const kind = /^layout\./.test(base) ? 'layout' : 'page';
    candidates.set(file, { kind });
  }
  // error / loading / not-found modules always ship (never elided), so they are
  // candidates unconditionally. A page/layout entry already in `candidates`
  // wins (it is the more specific kind); these only add files not already seen.
  for (const [file, kind] of alwaysShipRouteModules) {
    if (!candidates.has(file)) candidates.set(file, { kind });
  }

  // Report at most once per module (a page importing two server modules is one
  // finding, naming the first reached). Sorted for deterministic output.
  for (const file of [...candidates.keys()].sort()) {
    // `transitiveDeps` skips nothing here, so it includes (but does not walk
    // into) any `.server.*` file reachable from this module. The module itself
    // is not in the result. A direct OR indirect server import both surface,
    // because the closure walks every non-server edge until it hits one.
    const closure = transitiveDeps(moduleGraph, [file], appDir);
    // Of the reachable server files, find one that is a genuine throw-at-load
    // crash in the browser. TWO kinds of `.server.*` import are NOT crashes and
    // must be skipped, or the rule false-positives on legitimate code:
    //   - A `'use server'` ACTION. The browser receives a working RPC stub
    //     whose exports POST to the server, so calling it from a shipping
    //     module is the intended pattern (the issue even lists it as a fix).
    //     Only a bare `.server.*` utility (no directive) gets the
    //     throw-at-module-load stub that crashes the page.
    //   - A PHANTOM edge to a file that does not exist on disk. The module
    //     graph keeps quoted-string CONTENT verbatim, so an `import` written
    //     inside a code-example string (the docs / website `<pre>` samples)
    //     resolves to a non-existent path. That import never runs, so it is
    //     not a crash; require the server file to actually exist.
    let serverDep = null;
    for (const d of closure) {
      if (!/\.server\.m?[jt]s$/.test(d)) continue;
      if (await isUseServerActionFile(d)) continue; // working RPC stub, not a crash
      if (!(await pathExists(d))) continue;          // phantom edge from a string sample
      serverDep = d;
      break;
    }
    if (!serverDep) continue;

    const { kind } = candidates.get(file);
    const relFile = relative(appDir, file);
    const relServer = relative(appDir, serverDep);
    // Name the import chain: if the server file is a DIRECT import of this
    // module, the chain is just the two; otherwise show one intermediate hop
    // so the diagnostic points at where the edge enters (the full path is
    // recoverable from the graph, but one hop is enough to locate it).
    const directDeps = moduleGraph.get(file);
    const directlyImported = directDeps && directDeps.has(serverDep);
    const chain = directlyImported
      ? `${relFile} -> ${relServer}`
      : `${relFile} -> … -> ${relServer}`;

    // The "register the component in a layout so it elides again" remedy only
    // applies to a page / layout, which CAN elide (it became browser-bound by
    // importing a component). The error / loading / not-found boundaries always
    // ship and are never elided, so offering them an "elides again" fix is
    // wrong. Branch the fix text on whether the kind can elide.
    const canElide = kind === 'page' || kind === 'layout';
    const fixText = canElide
      ? `Keep the server call off this browser-shipped ${kind}. Options: (1) gate the route in \`middleware.ts\` (runs server-side, never ships); (2) move the server-only call behind a \`'use server'\` action in a \`.server.{ts,js}\` file and call it as an RPC; or (3) if this ${kind} only became browser-bound because it imports a component to register, register that component in a \`layout.{ts,js}\` instead so the ${kind} elides again and its server import is stripped.`
      : `Keep the server call off this browser-shipped ${kind} (it always ships and is never elided). Options: (1) gate the route in \`middleware.ts\` (runs server-side, never ships); or (2) move the server-only call behind a \`'use server'\` action in a \`.server.{ts,js}\` file and call it as an RPC.`;

    violations.push({
      rule: 'no-server-import-in-browser-module',
      file: relFile,
      message:
        `This ${kind} ships to the browser (the build does not elide it) but transitively imports the server-only module ${relServer} (${chain}). In the browser that import resolves to a stub, so the module crashes at load (the stub throws, or a server-only export such as \`auth\` is missing). \`webjs typecheck\` and the rest of \`webjs check\` pass; only the running ${kind} fails.`,
      fix: fixText,
    });
  }
}

/**
 * Read whether component elision is enabled for `appDir`, mirroring
 * `dev.js`'s `readElideEnabled` so the check's notion of "ships" matches the
 * dev server's. Elision is ON unless `webjs.elide === false` in package.json or
 * the `WEBJS_ELIDE` env var forces it off (`0` / `false` / `off` / `no`). A
 * missing or malformed package.json keeps the default (on). Inlined rather
 * than imported from `dev.js` so the check tool does not pull the whole dev
 * server module just for this flag.
 *
 * @param {string} appDir
 * @returns {Promise<boolean>}
 */
/**
 * True if `file` is a `'use server'` action: a `.server.{ts,js}` module that
 * declares the `'use server'` directive. The dev server rewrites its browser
 * import into a working RPC stub (exports POST to the server), so importing it
 * from a shipping module is legitimate, NOT the throw-at-load crash the
 * no-server-import-in-browser-module rule catches. A bare `.server.*` utility
 * (no directive) instead gets a stub that throws when the module loads, which
 * IS the crash. Returns false on any read failure (treat an unreadable server
 * file as a potential crash, the conservative direction for this rule).
 *
 * @param {string} file absolute path to a `.server.*` file
 * @returns {Promise<boolean>}
 */
async function isUseServerActionFile(file) {
  try {
    const content = await readFile(file, 'utf8');
    return hasUseServerDirective(content);
  } catch {
    return false;
  }
}

async function readElideEnabledForCheck(appDir) {
  const raw = process.env.WEBJS_ELIDE;
  if (raw != null) {
    const v = raw.trim().toLowerCase();
    if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
    if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  }
  try {
    const pkg = JSON.parse(await readFile(join(appDir, 'package.json'), 'utf8'));
    if (pkg && pkg.webjs && pkg.webjs.elide === false) return false;
  } catch {
    // No package.json, malformed JSON, or unreadable: keep the default.
  }
  return true;
}

/**
 * Async fs.exists shim. Returns true if the path exists at all (file
 * or directory), false on ENOENT or any other stat failure.
 *
 * @param {string} p absolute path
 * @returns {Promise<boolean>}
 */
async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * The subset of `rels` (appDir-relative paths) that git reports as ignored,
 * via a single batched `git check-ignore --stdin`. Best-effort: returns an
 * empty Set when the directory is not a git repo, git is absent, or the
 * spawn fails, so a non-git project scans every file as before. Runs with
 * `cwd: appDir` and the inherited GIT_* env stripped so cwd is the sole
 * authority on which repo + .gitignore stack is consulted (a pre-commit
 * hook from a linked worktree exports GIT_WORK_TREE, which would otherwise
 * override cwd-based discovery; same reason the doctor vendor-gitignore check
 * strips them).
 * Works for an in-repo sub-package with no nested `.git` too: git walks up
 * to the monorepo root and resolves the relative paths against cwd.
 *
 * @param {string} appDir absolute app directory
 * @param {string[]} rels appDir-relative file paths
 * @returns {Promise<Set<string>>}
 */
async function gitIgnoredSet(appDir, rels) {
  /** @type {Set<string>} */
  const out = new Set();
  if (!rels.length) return out;
  try {
    const { spawnSync } = await import('node:child_process');
    const {
      GIT_DIR: _gd, GIT_WORK_TREE: _gwt, GIT_INDEX_FILE: _gif, GIT_PREFIX: _gp,
      ...gitEnv
    } = process.env;
    // `git check-ignore --stdin` exits 0 when ≥1 path is ignored (those
    // paths are echoed on stdout), 1 when none are ignored, >1 on error.
    const res = spawnSync('git', ['check-ignore', '--stdin'], {
      cwd: appDir,
      input: rels.join('\n'),
      encoding: 'utf8',
      env: gitEnv,
    });
    if (res.status === 0 && typeof res.stdout === 'string') {
      for (const line of res.stdout.split('\n')) {
        const p = line.trim();
        if (p) out.add(p);
      }
    }
  } catch {
    // git missing or spawn failure: scan everything (no filter).
  }
  return out;
}
