/**
 * Styling rules: the colour-token sources an app ships and whether both halves
 * of the theme are reachable.
 */
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { walk } from '../fs-walk.js';

/**
 * @typedef {import('./rules.js').Violation} Violation
 * @typedef {{ abs: string, rel: string, content: string, scan: string }} ScannedFile
 */

const ROOT_LAYOUT = /^app\/layout\.(?:js|mjs|ts|mts)$/;
/** Stylesheet sources: the Tailwind input and any hand-written sheet; never the compiled output. */
const STYLE_SOURCE = /^(?:public|styles)\/(?:.+\/)?[^/]+\.css$/;
const COMPILED_OR_VENDORED = /(?:^|\/)(?:tailwind\.css|node_modules\/|\.webjs\/|dist\/)/;
/** A colour token definition: the two every palette starts from. */
const TOKEN_DEF = /--(?:background|foreground)\s*:/;
/** Any of these makes the dark half reachable. */
const DUAL_TOKENS = /light-dark\s*\(/;
const SCHEME_QUERY = /prefers-color-scheme/;
/** A head script that applies a saved or detected theme. */
const THEME_SCRIPT = /<script\b[^>]*>[\s\S]*?(?:prefers-color-scheme|localStorage|data-theme|classList\.(?:add|toggle)\(\s*['"`]dark['"`]|dataset\.theme)[\s\S]*?<\/script>/;

/**
 * Rule: `dark-theme-unreachable`.
 *
 * The scaffold's stylesheet ships a dark token set (a `.dark { ... }` block
 * from the ui kit, or whatever the app wrote), and `AGENTS.md` asks for
 * `light-dark()` tokens under `color-scheme: light dark`. An app that defines
 * colour tokens but never applies the dark half (no `light-dark()`, no
 * `prefers-color-scheme` rule, no head script that sets `.dark` or
 * `data-theme`) ships dead CSS and ignores the OS setting, and nothing else
 * reports it: the light screenshots look fine. Silent when the app defines no
 * colour tokens at all.
 *
 * @param {string} appDir
 * @param {ScannedFile[]} files  every JS/TS file in the app, raw and redacted
 * @param {Violation[]} violations  accumulator the rule pushes onto
 * @returns {Promise<void>}
 */
export async function checkDarkThemeUnreachable(appDir, files, violations) {
  // --- Rule: dark-theme-unreachable ---
  /** @type {{ rel: string, content: string }[]} */
  const sources = [];
  for (const { rel, content } of files) if (ROOT_LAYOUT.test(rel)) sources.push({ rel, content });
  for await (const abs of walk(appDir, (p) => p.endsWith('.css'))) {
    const rel = relative(appDir, abs).split('\\').join('/');
    if (!STYLE_SOURCE.test(rel) || COMPILED_OR_VENDORED.test(rel)) continue;
    try { sources.push({ rel, content: await readFile(abs, 'utf8') }); } catch { /* unreadable: not a source */ }
  }
  const defining = sources.filter((s) => TOKEN_DEF.test(stripCssComments(s.content)));
  if (!defining.length) return;
  const all = sources.map((s) => stripCssComments(s.content)).join('\n');
  if (DUAL_TOKENS.test(all) || SCHEME_QUERY.test(all)) return;
  const layout = sources.find((s) => ROOT_LAYOUT.test(s.rel));
  if (layout && THEME_SCRIPT.test(layout.content)) return;
  const where = defining.map((s) => s.rel);
  violations.push({
    rule: 'dark-theme-unreachable',
    file: where[0],
    message:
      `Colour tokens are defined in ${where.join(' and ')} with a light value only: nothing applies a dark half (no light-dark(), no prefers-color-scheme rule, no theme script in the root layout), so the OS dark setting is ignored and any .dark block is dead CSS.`,
    fix:
      'Write each colour token ONCE as light-dark(LIGHT, DARK) under `color-scheme: light dark` in the root layout (the block in .agents/skills/webjs/references/styling.md), or give the tokens an `@media (prefers-color-scheme: dark)` half, or add a head <script> that applies the saved theme (data-theme / the .dark class). Then check the app in a real browser with the OS in dark mode.',
  });
}

/** CSS and JS block comments and line comments, so a commented-out token or hint does not count. */
function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
