import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

/**
 * @typedef {import('../codes.js').DoctorResult} DoctorResult
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

/** CSS and JS block comments and line comments, so a commented-out token or hint does not count. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * The app's colour-token sources: the root layout (where the generated app
 * writes its palette) and the stylesheet sources under `public/` and `styles/`.
 * @param {string} appDir
 * @returns {Promise<Array<{ rel: string, content: string }>>}
 */
async function tokenSources(appDir) {
  /** @type {Array<{ rel: string, content: string }>} */
  const out = [];
  const read = async (rel) => {
    try { out.push({ rel, content: await readFile(join(appDir, rel), 'utf8') }); } catch { /* unreadable: not a source */ }
  };
  for (const ext of ['ts', 'js', 'mts', 'mjs']) {
    const rel = `app/layout.${ext}`;
    if (existsSync(join(appDir, rel))) { await read(rel); break; }
  }
  for (const dir of ['public', 'styles']) {
    const abs = join(appDir, dir);
    if (!existsSync(abs)) continue;
    for (const e of readdirSync(abs, { recursive: true, withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith('.css')) continue;
      const rel = relative(appDir, join(e.parentPath || abs, e.name)).split('\\').join('/');
      if (STYLE_SOURCE.test(rel) && !COMPILED_OR_VENDORED.test(rel)) await read(rel);
    }
  }
  return out;
}

/**
 * `DARK_THEME_UNREACHABLE` (#1628): the app defines colour tokens but nothing
 * applies a dark half. The scaffold's stylesheet keeps the ui kit's `.dark`
 * token block, and `AGENTS.md` asks for `light-dark()` tokens under
 * `color-scheme: light dark`; a layout that uses neither, has no
 * `prefers-color-scheme` rule and runs no theme script ships dead CSS and
 * ignores the OS setting, which no light-mode screenshot reveals. A design
 * convention rather than a runtime break, so it lives in doctor (WARN by
 * default) and the scaffold gates it `error` because its AGENTS.md mandates
 * the tokens. Silent when the app defines no colour tokens at all.
 * @param {string} appDir
 * @returns {Promise<DoctorResult>}
 */
export async function checkDarkTheme(appDir) {
  const name = 'dark-theme';
  if (!existsSync(join(appDir, 'app'))) {
    return { name, status: 'pass', message: 'no app/ directory to analyse' };
  }
  const sources = await tokenSources(appDir);
  const defining = sources.filter((s) => TOKEN_DEF.test(stripComments(s.content)));
  if (!defining.length) {
    return { name, status: 'pass', message: 'no colour tokens defined (nothing to reach)' };
  }
  const all = sources.map((s) => stripComments(s.content)).join('\n');
  const layout = sources.find((s) => ROOT_LAYOUT.test(s.rel));
  if (DUAL_TOKENS.test(all) || SCHEME_QUERY.test(all) || (layout && THEME_SCRIPT.test(layout.content))) {
    return { name, status: 'pass', message: 'the dark half of the colour tokens is reachable' };
  }
  const where = defining.map((s) => s.rel).join(' and ');
  return {
    name,
    status: 'warn',
    message:
      `colour tokens are defined in ${where} with a light value only: nothing applies a dark half (no light-dark(), no prefers-color-scheme rule, no theme script in the root layout), so the OS dark setting is ignored and any .dark block is dead CSS`,
    fix:
      'Write each colour token ONCE as light-dark(LIGHT, DARK) under `color-scheme: light dark` in the root layout (the block in .agents/skills/webjs/references/styling.md), or give the tokens an `@media (prefers-color-scheme: dark)` half, or add a head <script> that applies the saved theme (data-theme / the .dark class). Then check the app in a real browser with the OS in dark mode.',
  };
}
