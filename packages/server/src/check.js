import { readdir, readFile, stat } from 'node:fs/promises';
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
 * Scans an app directory and reports deviations from the conventions
 * documented in AGENTS.md. Designed to be run by AI agents, CI pipelines,
 * or `webjs lint` to catch structural mistakes early.
 *
 * **How AI agents should use the output:**
 * Each violation includes a machine-readable `rule` identifier, the offending
 * `file` (relative to appDir), a human-readable `message`, and a suggested
 * `fix`. Agents should iterate the array and apply (or propose) the fixes.
 * Rules can be disabled per-project via the
 * `"webjs": { "conventions": { … } }` key in `package.json`. That is
 * the only supported config surface. If the key is absent, every
 * rule defaults to enabled.
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
    name: 'actions-in-modules',
    description:
      'Server action files (*.server.{js,ts} or \'use server\') should live under modules/*/actions/ or modules/*/queries/, not loose in the app root. Files under lib/ are exempt: lib/ is the documented home for cross-cutting server infrastructure (prisma client, session helpers, auth config). Skipped when no modules/ directory exists.',
  },
  {
    name: 'one-function-per-action',
    description:
      'Each .server.{js,ts} file under modules/*/actions/ or modules/*/queries/ should export exactly one async function (one-function-per-file convention). Files outside those two directories: lib/ infrastructure modules, route handlers: are exempt; this rule is specifically about the action/query file pattern.',
  },
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
    name: 'tests-exist',
    description:
      'Each modules/<feature>/ directory should have corresponding test files under test/unit/ or test/e2e/.',
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
    name: 'no-json-data-files',
    description:
      'Apps must use Prisma + SQLite (already wired up in every scaffold) for persisted data, not JSON files. Flags JSON files that look like a fake database: top-level data/ JSON files (data/todos.json, data/posts.json…), or DB-shaped names (db.json, database.json, store.json, *-db.json) anywhere outside node_modules/, prisma/, .next/, dist/, build/, public/. Read-only seed data and config JSON (package.json, tsconfig.json, etc.) are exempt.',
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
      'Verifies the `.gitignore` exception for `.webjs/vendor/` is structurally correct via `git check-ignore`. The intended pattern is `.webjs/*` (NOT `.webjs/`) plus `!.webjs/vendor/` plus `!.webjs/vendor/**`. The common-looking pattern `.webjs/` excludes the directory itself, after which git cannot re-include children (gitignore semantics: a parent exclusion blocks child negations). Without this rule, an AI agent or human editor would silently break `webjs vendor pin` by simplifying the pattern; the failure is invisible until production. Rule fires when the working directory is a git repo and a `.gitignore` exists; skipped when neither is true.',
  },
  {
    name: 'no-browser-globals-in-render',
    description:
      'Flags genuinely browser-only APIs used in a WebComponent constructor, willUpdate, or render() method. The SSR pipeline instantiates the component, runs willUpdate plus controllers\' hostUpdate, reflects properties, and calls render() to produce HTML, on a server element shim that backs the attribute methods but has no real DOM. So a browser global (document, window, localStorage, sessionStorage, navigator, location, matchMedia, screen, history) or an unshimmed HTMLElement member on `this` (attachShadow, shadowRoot, classList, querySelector, querySelectorAll, getBoundingClientRect, focus, blur, scrollIntoView) touched there throws at SSR time (the isomorphic footgun). The attribute methods (getAttribute/setAttribute/hasAttribute/removeAttribute/toggleAttribute), the event methods (addEventListener/removeEventListener/dispatchEvent), and attachInternals are shim-backed and run server-side, so they are NOT flagged. The flagged APIs belong in connectedCallback() or a lifecycle hook (firstUpdated/updated), which SSR never calls; seed first-paint defaults in the constructor (or derive them in willUpdate) only from server-known inputs (attributes, props). Conservative: only the constructor, willUpdate, and render bodies are scanned, and only direct references, so helper indirection is not flagged (the runtime SSR error covers that case).',
  },
  {
    name: 'prefer-reactive-prop-over-getattribute',
    description:
      'webjs components are lit-shaped: read your own config through a reactive property (static properties + declare, read this.x), not by calling this.getAttribute, which is vanilla web-component muscle memory. Flags this.getAttribute(\'name\') with a literal attribute name inside a WebComponent class body. Standard attributes that are not modelled as typed props are allowlisted (class, style, id, is, slot, part, title, lang, dir, role, hidden, tabindex, name, type, value, and any aria-* / data-* name), as are dynamic names (this.getAttribute(variable)) and reads off another element (only this.getAttribute on `this` is flagged). The fix is a reactive property whose camelCase name rides the hyphenated attribute. Reserve getAttribute for reading a different element\'s attribute or a standard attribute with native semantics. The companion hasAttribute pattern is covered by the prose convention. See agent-docs/lit-muscle-memory-gotchas.md.',
  },
  {
    name: 'prefer-signal-over-state-prop',
    description:
      'Flags a `state: true` reactive property in a WebComponent\'s static properties. webjs reserves reactive properties for values that ride an HTML attribute (or arrive via .prop SSR hydration); internal reactive state with no attribute is held in a signal instead (framework invariant 5). lit uses `state: true` for attribute-less internal state, but in webjs that should be a `signal` (an instance signal created in the constructor, or a module-scope signal for shared state), read via signal.get() inside render(). Replace the `state: true` declaration with a signal field.',
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
 * Public wrapper around `loadOverrides` for callers (CLI, docs tools)
 * that want to inspect what's disabled in a project without running
 * the full check pipeline.
 *
 * @param {string} appDir
 * @returns {Promise<Record<string, boolean>>}
 */
export async function loadConventionOverrides(appDir) {
  return loadOverrides(appDir);
}

/**
 * Load overrides from the `"webjs": { "conventions": { … } }` key in
 * `package.json`. Returns a map of rule name to boolean (true =
 * enabled, false = disabled). Missing rules default to true.
 *
 * @param {string} appDir
 * @returns {Promise<Record<string, boolean>>}
 */
async function loadOverrides(appDir) {
  try {
    const pkgPath = join(appDir, 'package.json');
    const pkgText = await readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgText);
    if (pkg.webjs && typeof pkg.webjs === 'object'
      && pkg.webjs.conventions && typeof pkg.webjs.conventions === 'object') {
      return pkg.webjs.conventions;
    }
  } catch {
    // No package.json: every rule defaults to enabled.
  }
  return {};
}

/**
 * Check whether a rule is enabled given the overrides.
 * @param {string} ruleName
 * @param {Record<string, boolean>} overrides
 * @returns {boolean}
 */
function isRuleEnabled(ruleName, overrides) {
  if (ruleName in overrides) return overrides[ruleName] !== false;
  return true;
}

/**
 * Guess a module name from a loose server action file path. Used for the
 * `fix` suggestion in `actions-in-modules`.
 * @param {string} relPath
 * @returns {string}
 */
function guessModuleName(relPath) {
  const segments = relPath.split(sep);
  // Try to infer from the parent directory name
  // e.g. app/api/users/create.server.ts -> "users"
  for (let i = segments.length - 2; i >= 0; i--) {
    const seg = segments[i];
    if (seg !== 'app' && seg !== 'api' && !seg.startsWith('[') && !seg.startsWith('(') && !seg.startsWith('_')) {
      return seg;
    }
  }
  // Fall back to the file stem
  const base = basename(relPath).replace(/\.server\.m?[jt]s$/, '').replace(/\.m?[jt]s$/, '');
  return base;
}

/**
 * Count the number of named exported async functions in source text using
 * regex heuristics (no AST: intentionally fast and loose).
 *
 * Looks for patterns like:
 *   export async function name(...)
 *   export const name = async (...)
 *   export const name = async function(...)
 *   export default async function(...)
 *
 * @param {string} content
 * @returns {number}
 */
function countExportedFunctions(content) {
  const patterns = [
    /export\s+async\s+function\s+\w+/g,
    /export\s+const\s+\w+\s*=\s*async\s/g,
    /export\s+default\s+async\s+function/g,
    /export\s+function\s+\w+/g,
    /export\s+const\s+\w+\s*=\s*(?:async\s*)?\(/g,
    /export\s+const\s+\w+\s*=\s*(?:async\s*)?function/g,
  ];
  const seen = new Set();
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(content)) !== null) {
      seen.add(m.index);
    }
  }
  return seen.size;
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

// Standard attributes that are NOT modelled as typed reactive props, so
// reading them via getAttribute/hasAttribute is legitimate (not flagged).
const ALLOWED_ATTR_READS = new Set([
  'class', 'style', 'id', 'is', 'slot', 'part', 'title', 'lang', 'dir',
  'role', 'hidden', 'tabindex', 'name', 'type', 'value',
]);

/**
 * Find `this.getAttribute('name')` calls with a literal, non-allowlisted
 * attribute name in a (redacted) WebComponent class body. Dynamic names,
 * allowlisted standard attributes, and aria-* / data-* are skipped. Reads off
 * another element (e.g. `host.getAttribute`) are not matched because the
 * pattern is anchored to `this.`. Only `getAttribute` is matched (the config
 * read the lit prop API replaces); `hasAttribute` is covered by the prose
 * convention in agent-docs/lit-muscle-memory-gotchas.md.
 *
 * @param {string} classBody
 * @returns {{ method: string, attr: string }[]}
 */
/** `delay-duration` -> `delayDuration` (attribute name to reactive-prop name). */
function attrToCamel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function findOwnAttributeReads(classBody) {
  const out = [];
  const seen = new Set();
  const re = /\bthis\.(getAttribute)\(\s*(['"])([^'"]+)\2/g;
  let m;
  while ((m = re.exec(classBody)) !== null) {
    const method = m[1];
    const attr = m[3].toLowerCase();
    if (ALLOWED_ATTR_READS.has(attr) || attr.startsWith('aria-') || attr.startsWith('data-')) continue;
    const key = `${method}:${attr}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ method, attr });
  }
  return out;
}

/**
 * Scan a webjs app directory and report convention violations.
 *
 * @param {string} appDir - absolute path to the app root (the directory
 *   containing `app/`, `modules/`, `components/`, etc.)
 * @param {{ rules?: Record<string, boolean> }} [opts] - programmatic
 *   overrides. Merged on top of file-based overrides loaded from
 *   `package.json` `"webjs"."conventions"`. Set a rule to `false` to
 *   skip it.
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
export async function checkConventions(appDir, opts) {
  const fileOverrides = await loadOverrides(appDir);
  const overrides = { ...fileOverrides, ...(opts?.rules || {}) };

  /** @type {Violation[]} */
  const violations = [];

  // Determine if modules/ directory exists (small apps exempt from some rules)
  let hasModulesDir = false;
  try {
    const s = await stat(join(appDir, 'modules'));
    hasModulesDir = s.isDirectory();
  } catch {
    // no modules/ dir
  }

  // Determine which module feature names exist
  /** @type {string[]} */
  const moduleNames = [];
  if (hasModulesDir) {
    try {
      const entries = await readdir(join(appDir, 'modules'), { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith('.')) {
          moduleNames.push(e.name);
        }
      }
    } catch {
      // could not read modules/
    }
  }

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

  // --- Rule: actions-in-modules ---
  if (hasModulesDir && isRuleEnabled('actions-in-modules', overrides)) {
    for (const { abs, rel, content } of files) {
      if (!isServerActionFile(abs, content)) continue;
      const normRel = rel.split(sep).join('/');
      // OK: action / query files inside modules/<feature>/{actions,queries}/
      if (/^modules\/[^/]+\/(actions|queries)\//.test(normRel)) continue;
      // OK: module-scoped components/utils (utils may use 'use server' too)
      if (/^modules\/[^/]+\/(components|utils)\//.test(normRel)) continue;
      // OK: cross-cutting server infrastructure under lib/. The documented
      // pattern puts the Prisma singleton, session helpers, auth config,
      // password hashing, etc. in lib/: those files are intentionally
      // multi-export 'use server' modules, not one-function actions.
      if (/^lib\//.test(normRel)) continue;
      // Anything else (loose at the root, under app/, etc.) is flagged.
      const moduleName = guessModuleName(rel);
      const fileBase = basename(rel);
      violations.push({
        rule: 'actions-in-modules',
        file: rel,
        message: `Server action should be in modules/${moduleName}/actions/`,
        fix: `Move to modules/${moduleName}/actions/${fileBase}`,
      });
    }
  }

  // --- Rule: one-function-per-action ---
  // Apply ONLY to files inside modules/<feature>/{actions,queries}/: that
  // is where the one-function-per-file convention lives. lib/ infra modules
  // and any other 'use server' file outside the action/query dirs are
  // intentional multi-export utility modules and are exempt.
  if (isRuleEnabled('one-function-per-action', overrides)) {
    for (const { abs, rel, content } of files) {
      if (!isServerActionFile(abs, content)) continue;
      const normRel = rel.split(sep).join('/');
      if (!/^modules\/[^/]+\/(actions|queries)\//.test(normRel)) continue;
      const count = countExportedFunctions(content);
      if (count > 1) {
        violations.push({
          rule: 'one-function-per-action',
          file: rel,
          message: `Server action file exports ${count} functions; convention is one per file`,
          fix: 'Split into separate .server.{js,ts} files, one exported function each',
        });
      }
    }
  }

  // --- Rule: components-have-register ---
  if (isRuleEnabled('components-have-register', overrides)) {
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
  if (isRuleEnabled('reactive-props-use-declare', overrides)) {
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
  if (isRuleEnabled('no-browser-globals-in-render', overrides)) {
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

  // --- Rule: prefer-reactive-prop-over-getattribute ---
  // Lit-shaped components read their own config through a reactive property
  // (this.x), not this.getAttribute('x') / this.hasAttribute('x') (vanilla
  // muscle memory). Flags only literal, non-allowlisted attribute names on
  // `this`; standard attributes (class/style/id/...), aria-*/data-*, dynamic
  // names, and reads off another element are not flagged.
  if (isRuleEnabled('prefer-reactive-prop-over-getattribute', overrides)) {
    for (const { rel, scan } of files) {
      if (!/class\s+\w+\s+extends\s+WebComponent/.test(scan)) continue;
      for (const body of extractWebComponentClassBodies(scan)) {
        for (const { method, attr } of findOwnAttributeReads(body)) {
          violations.push({
            rule: 'prefer-reactive-prop-over-getattribute',
            file: rel,
            message: `\`this.${method}('${attr}')\` reads own config via a vanilla attribute call. Use a reactive property instead.`,
            fix: `Declare \`${attrToCamel(attr)}\` in \`static properties\` with a \`declare ${attrToCamel(attr)}\` field (the prop rides the \`${attr}\` attribute), then read \`this.${attrToCamel(attr)}\`. Reserve getAttribute/hasAttribute for reading another element's attribute or a standard attribute with native semantics.`,
          });
        }
      }
    }
  }

  // --- Rule: prefer-signal-over-state-prop ---
  // `state: true` is a reactive property with no attribute (lit's internal
  // state). webjs holds attribute-less internal state in a signal (invariant
  // 5), so flag `state: true` in a WebComponent's static properties.
  if (isRuleEnabled('prefer-signal-over-state-prop', overrides)) {
    for (const { rel, scan } of files) {
      if (!/class\s+\w+\s+extends\s+WebComponent/.test(scan)) continue;
      for (const body of extractWebComponentClassBodies(scan)) {
        if (/\bstate\s*:\s*true\b/.test(body)) {
          violations.push({
            rule: 'prefer-signal-over-state-prop',
            file: rel,
            message: `A \`state: true\` reactive property holds internal state with no attribute. webjs uses a signal for that.`,
            fix: `Remove the \`state: true\` declaration and hold the value in a signal: create an instance signal in the constructor (or a module-scope signal for shared state) and read it via signal.get() inside render(). Reactive properties are reserved for values that ride an HTML attribute.`,
          });
        }
      }
    }
  }

  // --- Rule: no-server-env-in-components ---
  // Catches `process.env.X` reads in component files where X is not a
  // WEBJS_PUBLIC_* var and not NODE_ENV. The SSR shim only exposes those
  // two categories to the browser; any other read either leaks a secret
  // into the SSR'd HTML or reads as undefined after hydration.
  if (isRuleEnabled('no-server-env-in-components', overrides)) {
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

  // --- Rule: tests-exist ---
  if (hasModulesDir && isRuleEnabled('tests-exist', overrides)) {
    for (const mod of moduleNames) {
      // Look for test files that reference this module
      let hasTest = false;

      // Check test/unit/ and test/e2e/
      for (const testDir of ['test/unit', 'test/e2e', 'test']) {
        try {
          const testDirAbs = join(appDir, testDir);
          for await (const testFile of walk(testDirAbs, (p) => /\.(test|spec)\.m?[jt]sx?$/.test(p))) {
            const testRel = relative(appDir, testFile);
            // Check if test file name contains the module name
            if (testRel.toLowerCase().includes(mod.toLowerCase())) {
              hasTest = true;
              break;
            }
          }
        } catch {
          // test directory doesn't exist
        }
        if (hasTest) break;
      }

      if (!hasTest) {
        violations.push({
          rule: 'tests-exist',
          file: `modules/${mod}`,
          message: `No test files found for module "${mod}"`,
          fix: `Add test files under test/unit/${mod}.test.js or test/e2e/${mod}.test.js`,
        });
      }
    }
  }

  // --- Rule: no-json-data-files ---
  // Catch AI agents (or hurried humans) using JSON files as a substitute for
  // the real database. Every scaffold ships Prisma + SQLite ready to go, so
  // there is never a good reason to invent `data/todos.json`, `db.json`,
  // etc. The rule is intentionally narrow: we only flag JSON files that
  // *look like* a database: by location (top-level `data/` directory) or by
  // name (db/database/store/*-db). Config and read-only seed JSON elsewhere
  // is left alone.
  if (isRuleEnabled('no-json-data-files', overrides)) {
    /** @type {Array<{rel: string, why: string}>} */
    const suspects = [];
    /**
     * @param {string} dir absolute
     * @param {string} relBase relative to appDir
     */
    async function scanDir(dir, relBase) {
      /** @type {import('node:fs').Dirent[]} */
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const name = e.name;
        if (name.startsWith('.')) continue;
        // Skip directories we know are not the user's data dir.
        if (e.isDirectory()) {
          if (
            name === 'node_modules' ||
            name === 'prisma' ||
            name === 'dist' ||
            name === 'build' ||
            name === '.next' ||
            name === 'coverage' ||
            name === 'public'
          ) continue;
          await scanDir(join(dir, name), relBase ? `${relBase}/${name}` : name);
          continue;
        }
        if (!e.isFile()) continue;
        if (!name.endsWith('.json')) continue;
        const rel = relBase ? `${relBase}/${name}` : name;

        // Skip well-known config / tooling JSON.
        const configNames = new Set([
          'package.json', 'package-lock.json', 'tsconfig.json',
          'jsconfig.json', 'manifest.json', 'site.webmanifest',
          '.eslintrc.json', '.prettierrc.json', 'compose.json',
          'turbo.json', 'lerna.json', 'nx.json', 'biome.json',
          'renovate.json', 'vercel.json', 'now.json', 'fly.json',
        ]);
        if (configNames.has(name)) continue;

        // Trigger 1: any JSON under a top-level `data/` directory.
        if (rel.startsWith('data/')) {
          suspects.push({ rel, why: `JSON file in top-level data/ directory (likely a fake database)` });
          continue;
        }

        // Trigger 2: file name looks like a database.
        const lower = name.toLowerCase();
        const dbShapedName =
          lower === 'db.json' ||
          lower === 'database.json' ||
          lower === 'store.json' ||
          lower === 'storage.json' ||
          /-db\.json$/.test(lower) ||
          /\.db\.json$/.test(lower);
        if (dbShapedName) {
          suspects.push({ rel, why: `file name "${name}" suggests it is being used as a database` });
        }
      }
    }
    await scanDir(appDir, '');

    for (const s of suspects) {
      violations.push({
        rule: 'no-json-data-files',
        file: s.rel,
        message: `${s.why}. webjs apps must persist data with Prisma + SQLite (already wired up: see prisma/schema.prisma and lib/prisma.server.ts), not JSON files.`,
        fix: `Define a Prisma model in prisma/schema.prisma for this data, run \`webjs db migrate <name>\` to create the migration, then read/write via \`import { prisma } from 'lib/prisma.server.ts'\`. Delete ${s.rel} once the data has moved.`,
      });
    }
  }

  // --- Rule: shell-in-non-root-layout ---
  // Only app/layout.{js,ts} may write <!doctype>/<html>/<head>/<body>. The
  // framework auto-emits the shell around the whole composition; a nested
  // shell ends up duplicated and silently dropped by the HTML parser.
  if (isRuleEnabled('shell-in-non-root-layout', overrides)) {
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
  if (isRuleEnabled('erasable-typescript-only', overrides)) {
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
  if (isRuleEnabled('no-non-erasable-typescript', overrides)) {
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
  if (isRuleEnabled('use-server-needs-extension', overrides)) {
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
  if (isRuleEnabled('tag-name-has-hyphen', overrides)) {
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
  if (isRuleEnabled('gitignore-vendor-not-ignored', overrides)) {
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
            '  .webjs/*\n' +
            '  !.webjs/vendor/\n' +
            '  !.webjs/vendor/**\n' +
            'Verify with `git check-ignore -q .webjs/vendor/importmap.json` (exit 1 means correctly un-ignored).',
        });
      }
    }
    }
  }

  // Inline opt-out (the per-occurrence escape hatch). A file may suppress a
  // rule with a `// webjs-check-ignore <rule>[,<rule>]` comment (or `* ` for
  // all rules) anywhere in the file. The package.json `webjs.conventions`
  // switch turns a rule off across the whole project; this is the finer,
  // per-file escape hatch so a component that genuinely needs a flagged
  // pattern (a vanilla DOM call with no lit equivalent, a deliberate browser
  // global) can keep it without disabling the rule everywhere. Authors should
  // add a short reason after the rule name.
  const ignoresByRel = new Map();
  for (const { rel, content } of files) {
    const ignored = new Set();
    const re = /webjs-check-ignore[ \t]+([^\n]+)/gi;
    let m;
    while ((m = re.exec(content)) !== null) {
      for (const tok of m[1].split(/[\s,]+/)) {
        if (tok === '*' || RULE_NAMES.has(tok)) ignored.add(tok);
      }
    }
    if (ignored.size) ignoresByRel.set(rel, ignored);
  }
  if (ignoresByRel.size) {
    return violations.filter((v) => {
      const ig = ignoresByRel.get(v.file);
      return !ig || !(ig.has(v.rule) || ig.has('*'));
    });
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
