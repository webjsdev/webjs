/**
 * The `webjsui lint` orchestrator: walks the app, reads each module, runs the
 * scanner, dispatches every class site to every enabled rule, and returns the
 * violations. It does the filesystem work so the rules stay pure (the same
 * split `@webjsdev/server`'s check runner uses: collect first, then hand pure
 * rule functions the collected set).
 *
 * Scope (D7): `app/**`, `components/**`, `modules/**` and `lib/**` under the
 * config's cwd, over `.ts .tsx .js .jsx .mts .mjs`; `node_modules`, `.webjs`,
 * `dist` and `public` are never walked. `resolvedPaths.ui` (default
 * `components/ui`) is skipped by default: a copied primitive legitimately owns
 * structural values no variant can express (`ring-[3px]`, `[&_svg]:size-4`)
 * and is what every other file's variants are measured against, so linting it
 * with the app's rules is backwards. An app widens the scope with a negated
 * ignore entry (`"!components/ui/**"`) or narrows it with more globs.
 *
 * @module lint
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { scanClassSites, collectHelperImports } from './scan.js';
import { readThemeTokens } from './theme-tokens.js';
import { extractHelperAxes } from '../registry/extract.js';
import { RULES, RULE_NAMES } from './rules/index.js';

const SCAN_DIRS = ['app', 'components', 'modules', 'lib'];
const EXTENSIONS = /\.(?:ts|tsx|js|jsx|mts|mjs)$/;
const NEVER_WALK = new Set(['node_modules', '.webjs', 'dist', 'public']);

/**
 * @typedef {{
 *   rule: string, severity: 'warn'|'error', file: string,
 *   line: number, column: number, class: string, message: string, fix?: string,
 * }} Violation
 */

/**
 * Normalize `config.lint.rules` into `{ name: { severity, allow } }` for the
 * rules that are on. A bare severity string and the object form both land
 * here; an absent rule is off.
 *
 * @param {any} lint the parsed `lint` block, or undefined
 * @returns {Record<string, { severity: 'warn'|'error', allow: string[] }>}
 */
export function enabledRules(lint) {
  /** @type {Record<string, { severity: 'warn'|'error', allow: string[] }>} */
  const out = {};
  const rules = lint?.rules ?? {};
  for (const name of RULE_NAMES) {
    const raw = rules[name];
    if (raw === undefined) continue;
    const severity = typeof raw === 'string' ? raw : raw.severity;
    if (severity === 'off') continue;
    out[name] = { severity, allow: typeof raw === 'string' ? [] : (raw.allow ?? []) };
  }
  return out;
}

/** A minimal glob (`**`, `*`, `?`) to RegExp over a posix relative path. */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function toPosix(p) {
  return p.split(sep).join('/');
}

/**
 * Walk the D7 scope and return every lintable file, relative to `cwd` (posix).
 * @param {string} cwd
 */
function collectFiles(cwd) {
  /** @type {string[]} */
  const files = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (NEVER_WALK.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && EXTENSIONS.test(e.name)) files.push(toPosix(relative(cwd, full)));
    }
  };
  for (const d of SCAN_DIRS) {
    const full = join(cwd, d);
    if (existsSync(full) && statSync(full).isDirectory()) walk(full);
  }
  return files.sort();
}

/**
 * Lint the app at `cwd` against the parsed `components.json` config.
 *
 * @param {string} cwd
 * @param {ReturnType<import('../utils/get-config.js').getConfig>} config
 * @returns {{ violations: Violation[], warnings: string[], configured: boolean }}
 *   `warnings` are non-violation notices (an unreadable theme path);
 *   `configured` is false when no rule is on, the opt-in guarantee.
 */
export function lintApp(cwd, config) {
  const root = resolve(cwd);
  const rules = enabledRules(config.lint);
  /** @type {string[]} */
  const warnings = [];
  if (Object.keys(rules).length === 0) return { violations: [], warnings, configured: false };

  // Ignore set: the ui dir by default, plus the app's entries. A `!` entry
  // un-ignores whatever it MATCHES, so `!components/ui/**` widens the scope
  // over the whole ui dir and `!components/ui/button.ts` over one file.
  const uiRel = toPosix(relative(root, config.resolvedPaths.ui));
  const ignore = [`${uiRel}/**`];
  const unignore = [];
  for (const entry of config.lint?.ignore ?? []) {
    if (entry.startsWith('!')) unignore.push(entry.slice(1));
    else ignore.push(entry);
  }
  const ignoreRes = ignore.map(globToRegExp);
  const unignoreRes = unignore.map(globToRegExp);
  const isIgnored = (rel) => ignoreRes.some((re) => re.test(rel)) && !unignoreRes.some((re) => re.test(rel));

  // Theme tokens, read once; no tokens disables no-raw-colors for the run.
  let tokens = [];
  let themePath = toPosix(relative(root, config.resolvedPaths.tailwindCss));
  if (rules['no-raw-colors']) {
    const theme = readThemeTokens(config.resolvedPaths.tailwindCss);
    tokens = theme.tokens;
    if (tokens.length === 0) {
      warnings.push(`no-raw-colors is off for this run: no --color-* tokens found in a @theme block of ${themePath} (tailwind.css in components.json)`);
      delete rules['no-raw-colors'];
      if (Object.keys(rules).length === 0) return { violations: [], warnings, configured: true };
    }
  }

  /** @type {Map<string, Record<string, Record<string, string[]>>>} axes per helper file */
  const axesCache = new Map();
  const axesForFile = (absPath) => {
    const candidates = [absPath, `${absPath}.ts`, `${absPath}.js`];
    for (const p of candidates) {
      if (axesCache.has(p)) return { axes: axesCache.get(p), file: toPosix(relative(root, p)) };
      let src;
      try { src = readFileSync(p, 'utf8'); } catch { continue; }
      const axes = extractHelperAxes(src);
      axesCache.set(p, axes);
      return { axes, file: toPosix(relative(root, p)) };
    }
    return { axes: {}, file: null };
  };

  /** @type {Violation[]} */
  const violations = [];
  for (const rel of collectFiles(root)) {
    if (isIgnored(rel)) continue;
    const abs = join(root, rel);
    let src;
    try { src = readFileSync(abs, 'utf8'); } catch { continue; }
    const imports = collectHelperImports(src, {
      filePath: abs,
      appRoot: root,
      uiDir: config.resolvedPaths.ui,
      utilsPath: config.resolvedPaths.utils,
    });
    // `cnNames` is passed even when empty ON PURPOSE: the scanner's own default
    // recognizes a bare `cn`, but here `cn` counts only when imported from the
    // configured utils alias, so an unrecognized `cn` never opens a call site.
    const sites = scanClassSites(src, { helpers: imports.helpers, cnNames: imports.cnNames });
    if (!sites.length) continue;
    const axesFor = (helper) => {
      const target = imports.helperFiles[helper];
      if (!target) return { axes: {}, file: null };
      const r = axesForFile(target);
      return { axes: r.axes[helper] ?? {}, file: r.file };
    };
    for (const site of sites) {
      for (const [name, conf] of Object.entries(rules)) {
        const ctx = { tokens, themePath, allow: conf.allow, axesFor };
        for (const v of RULES[name](site, ctx)) {
          violations.push({ rule: name, severity: conf.severity, file: rel, ...v });
        }
      }
    }
  }
  // Two rules can flag one token (an arbitrary colour beside a helper); keep both, ordered.
  violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule));
  return { violations, warnings, configured: true };
}
