import { readFile, stat } from 'node:fs/promises';
import { join, relative, sep, basename, dirname } from 'node:path';
import { walk } from './fs-walk.js';
import {
  redactStringsAndTemplates,
  extractWebComponentClassBodies,
  matchClosingBrace,
} from './js-scan.js';

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
    name: 'reactive-props-use-declare',
    description:
      'Reactive properties listed in `static properties = { … }` must be typed with `declare propName: Type` (no value), and have their default set in `constructor()`. Plain class-field initializers (`prop = value` or `prop: Type = value`) compile to Object.defineProperty *after* super() under modern class-field semantics, clobbering the framework\'s reactive accessor and silently breaking re-renders.',
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
    name: 'no-non-erasable-typescript',
    description:
      'Scans .ts / .mts source for the four non-erasable TypeScript constructs (enum declarations, namespace blocks with value statements, constructor parameter properties, and `import = require`) that the framework\'s type-stripper rejects at request time. Companion to `erasable-typescript-only`: that rule checks the tsconfig flag, this rule checks the actual source. Both run by default so the flag check catches violations early in the editor while the source scan catches violations even if the tsconfig flag is missing or the rule is bypassed. Skips node_modules, dist, build, .git, .next, and _private folders.',
  },
  {
    name: 'gitignore-vendor-not-ignored',
    description:
      'Verifies the `.gitignore` exception for `.webjs/vendor/` is structurally correct via `git check-ignore`. The intended pattern is `**/.webjs/*` (NOT `.webjs/`) plus `!**/.webjs/vendor/` plus `!**/.webjs/vendor/**`. The `**/` prefix matches `.webjs/` at any depth so a nested / monorepo app does not leak its generated `.webjs/routes.d.ts`; the older root-anchored `.webjs/*` also passes this rule (the probe is run from the app root). The common-looking pattern `.webjs/` excludes the directory itself, after which git cannot re-include children (gitignore semantics: a parent exclusion blocks child negations). Without this rule, an AI agent or human editor would silently break `webjs vendor pin` by simplifying the pattern; the failure is invisible until production. Rule fires when the working directory is a git repo and a `.gitignore` exists; skipped when neither is true.',
  },
  {
    name: 'no-browser-globals-in-render',
    description:
      'Flags genuinely browser-only APIs used in a WebComponent constructor, willUpdate, or render() method. The SSR pipeline instantiates the component, runs willUpdate plus controllers\' hostUpdate, reflects properties, and calls render() to produce HTML, on a server element shim that backs the attribute methods but has no real DOM. So a browser global (document, window, localStorage, sessionStorage, navigator, location, matchMedia, screen, history) or an unshimmed HTMLElement member on `this` (attachShadow, shadowRoot, classList, querySelector, querySelectorAll, getBoundingClientRect, focus, blur, scrollIntoView) touched there throws at SSR time (the isomorphic footgun). The attribute methods (getAttribute/setAttribute/hasAttribute/removeAttribute/toggleAttribute), the event methods (addEventListener/removeEventListener/dispatchEvent), and attachInternals are shim-backed and run server-side, so they are NOT flagged. The flagged APIs belong in connectedCallback() or a lifecycle hook (firstUpdated/updated), which SSR never calls; seed first-paint defaults in the constructor (or derive them in willUpdate) only from server-known inputs (attributes, props). Conservative: only the constructor, willUpdate, and render bodies are scanned, and only direct references, so helper indirection is not flagged (the runtime SSR error covers that case).',
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
 * Find every `<key>:` entry inside the first `static properties = { … }`
 * literal in `classBody`. Returns the bare property names: the keys
 * we'll then look up as class fields.
 *
 * @param {string} classBody
 * @returns {Set<string>}
 */
function extractStaticPropertyNames(classBody) {
  /** @type {Set<string>} */
  const names = new Set();
  const m = /static\s+properties\s*=\s*\{/.exec(classBody);
  if (!m) return names;
  const objStart = m.index + m[0].length;
  const objEnd = matchClosingBrace(classBody, objStart);
  if (objEnd === -1) return names;
  const obj = classBody.slice(objStart, objEnd);
  // Match keys at the top level of the object literal. A nested `{ … }`
  // (the per-property declaration) is skipped via brace counting.
  let i = 0;
  while (i < obj.length) {
    // Skip whitespace and commas.
    while (i < obj.length && /[\s,]/.test(obj[i])) i++;
    if (i >= obj.length) break;
    // Read the identifier or string-literal key.
    let key = '';
    if (obj[i] === '"' || obj[i] === "'") {
      const quote = obj[i++];
      while (i < obj.length && obj[i] !== quote) { key += obj[i++]; }
      i++; // closing quote
    } else {
      while (i < obj.length && /[A-Za-z0-9_$]/.test(obj[i])) key += obj[i++];
    }
    // Skip whitespace, then expect `:`.
    while (i < obj.length && /\s/.test(obj[i])) i++;
    if (obj[i] !== ':') break;
    i++;
    // Skip whitespace, then skip the value (either a `{ … }` literal or
    // a single token like `String`).
    while (i < obj.length && /\s/.test(obj[i])) i++;
    if (obj[i] === '{') {
      const valEnd = matchClosingBrace(obj, i + 1);
      if (valEnd === -1) break;
      i = valEnd + 1;
    } else {
      while (i < obj.length && obj[i] !== ',' && obj[i] !== '}') i++;
    }
    if (key) names.add(key);
  }
  return names;
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

  // --- Rule: reactive-props-use-declare ---
  {
    for (const { rel, scan } of files) {
      // Use redacted source so test-fixture-style strings like
      // `class X extends WebComponent { x = 0 }` inside template
      // literals don't trip the rule. Real declarations live at
      // top-level code where the redactor leaves them alone.
      if (!/class\s+\w+\s+extends\s+WebComponent/.test(scan)) continue;
      for (const body of extractWebComponentClassBodies(scan)) {
        const propNames = extractStaticPropertyNames(body);
        if (propNames.size === 0) continue;
        for (const bad of findFieldInitializers(body, propNames)) {
          violations.push({
            rule: 'reactive-props-use-declare',
            file: rel,
            message: `Reactive prop \`${bad}\` uses a class-field initializer; this clobbers the framework's reactive accessor under modern class-field semantics.`,
            fix: `Replace with \`declare ${bad}: <Type>;\` and set the default inside \`constructor()\` after \`super()\`.`,
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
      for (const body of extractWebComponentClassBodies(scan)) {
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
        fix: 'Replace `constructor(public x: number)` with `x: number; constructor(x: number) { this.x = x; }`. The reactive-props-use-declare rule has the framework-specific shape: `declare x: number;` (no value) plus the assignment in the constructor body.',
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

  // --- Rule: gitignore-vendor-not-ignored ---
  // The .gitignore pattern for .webjs/vendor/ is subtle: `.webjs/`
  // alone excludes the directory entirely and git can't re-include
  // children of an excluded parent. The correct pattern is `.webjs/*`
  // plus `!.webjs/vendor/` plus `!.webjs/vendor/**`. AI agents
  // and human reviewers frequently "simplify" this back to `.webjs/`,
  // silently breaking `webjs vendor pin`.
  //
  // This rule verifies the actual gitignore behavior by spawning
  // `git check-ignore` against a representative pin-file path. If
  // git reports the file as ignored, the pattern is broken.
  //
  // Skipped when the directory isn't a git repo or has no .gitignore
  // (the user hasn't opted into version control yet).
  {
    const hasGit = await pathExists(join(appDir, '.git'));
    const hasGitignore = await pathExists(join(appDir, '.gitignore'));
    if (hasGit && hasGitignore) {
      const { spawnSync } = await import('node:child_process');
      // Strip inherited git env vars so `cwd` is the sole authority on
      // which repo `git check-ignore` consults. Git exports GIT_DIR /
      // GIT_WORK_TREE / GIT_INDEX_FILE / GIT_PREFIX into hook processes
      // (notably a pre-commit hook run from a linked worktree exports
      // GIT_WORK_TREE), and those OVERRIDE cwd-based discovery, so
      // without this the probe would consult the outer repo instead of
      // `appDir`. See the gitignore-vendor-not-ignored regression test.
      const {
        GIT_DIR: _gd, GIT_WORK_TREE: _gwt, GIT_INDEX_FILE: _gif, GIT_PREFIX: _gp,
        ...gitEnv
      } = process.env;
      // Check two representative paths: the pin manifest AND a sample
      // downloaded bundle. A `.gitignore` that allows the manifest
      // but blocks bundles (e.g. `*.js` higher up) would still break
      // `webjs vendor pin --download`. `git check-ignore -q` exits 0
      // when ignored, 1 when not ignored.
      const probes = [
        '.webjs/vendor/importmap.json',
        '.webjs/vendor/sample-pkg@1.0.0.js',
      ];
      for (const probe of probes) {
        const result = spawnSync('git', ['check-ignore', '-q', probe], {
          cwd: appDir,
          stdio: 'pipe',
          env: gitEnv,
        });
        if (result.status === 0) {
          violations.push({
            rule: 'gitignore-vendor-not-ignored',
            file: '.gitignore',
            message:
              `${probe} is gitignored, but \`webjs vendor pin\` writes files under .webjs/vendor/ and they MUST be committed for production deploys to use the pin (instead of calling api.jspm.io on every cold start). The most common cause: a \`.webjs/\` line in .gitignore that excludes the parent directory before the \`!.webjs/vendor/\` exception can take effect (git semantics: a parent exclusion blocks child negations). A second possible cause is a broader rule (e.g. \`*.js\` at root) that hides bundle files added by \`webjs vendor pin --download\`.`,
          fix:
            'Replace `.webjs/` in your .gitignore with this three-line pattern:\n' +
            '  **/.webjs/*\n' +
            '  !**/.webjs/vendor/\n' +
            '  !**/.webjs/vendor/**\n' +
            'The `**/` prefix ignores `.webjs/` at any depth (so a nested / monorepo app does not leak its generated `.webjs/routes.d.ts`) while still re-including the committed vendor pin. ' +
            'Verify with `git check-ignore -q .webjs/vendor/importmap.json` (exit 1 means correctly un-ignored).',
        });
      }
    }
    }
  }

  return violations;
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
