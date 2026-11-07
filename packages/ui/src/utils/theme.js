/**
 * Theme-token install, shared by `init` and `add` (#983).
 *
 * The class helpers render against CSS design tokens (`--background`,
 * `--foreground`, `--destructive`, ...) that the app must define. `init` plants
 * them; `add` self-heals if they are missing (an app that copied a component
 * without the tokens paints unstyled). Both go through {@link ensureTheme} so
 * the contract is one place: a token block is written once, keyed by the
 * {@link THEME_MARKER}, and a genuine failure to write is reported (never
 * swallowed) so `init` can exit non-zero instead of leaving a clean exit code
 * on an unstyled install.
 *
 * The block ends at {@link THEME_END_MARKER} (#1666), which is what lets
 * `init --preset` (or `--overwrite`) REPLACE it in place later: everything
 * from the start marker through the end marker is the kit's, and everything
 * around it is the app's. A block written before the end marker existed has
 * no such boundary, so it is never replaced, only reported, since guessing
 * where it stops would cut into the app's own CSS.
 *
 * @module utils/theme
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getRegistryItem } from '../registry/fetcher.js';
import { buildThemeVars } from '../../packages/registry/themes/themes.js';
import { presetFontVars } from '../../packages/registry/themes/preset.js';

/** The line that opens the theme block. */
export const THEME_MARKER = '/* @webjsdev/ui theme */';

/** The line that closes it (#1666). */
export const THEME_END_MARKER = '/* @webjsdev/ui theme end */';

function ensureDir(d) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Set CSS variables inside the first `<selector> {` block of `css`: a variable
 * the block declares has its value replaced where it stands, and one it does
 * not is appended at the end of the block. Comments and every other line are
 * left as they are.
 *
 * @param {string} css
 * @param {string} selector e.g. `:root`, `.dark`, `@theme inline`
 * @param {Record<string, string>} vars bare names (`primary`, not `--primary`)
 */
export function setBlockVars(css, selector, vars) {
  const entries = Object.entries(vars || {});
  if (!entries.length) return css;
  const re = new RegExp(`(${escapeRe(selector)}\\s*\\{)([\\s\\S]*?)(\\n\\})`);
  if (!re.test(css)) return css;
  return css.replace(re, (_m, open, body, close) => {
    let next = body;
    const missing = [];
    for (const [key, value] of entries) {
      const varRe = new RegExp(`(\\n\\s*--${escapeRe(key)}\\s*:\\s*)[^;\\n]+`);
      if (varRe.test(next)) next = next.replace(varRe, (_v, lead) => lead + value);
      else missing.push(`  --${key}: ${value};`);
    }
    return open + next + (missing.length ? '\n' + missing.join('\n') : '') + close;
  });
}

/**
 * The theme block for a design-system preset: the kit's theme file (the
 * neutral `themes/index.css`, so the `@theme inline` map, the variants and the
 * base rules stay the kit's) with every token set to the preset's values
 * (shadcn's palettes, see `themes/themes.js`) and the font tokens added to
 * `@theme inline`.
 *
 * @param {string} baseCss the `theme-neutral` file content
 * @param {import('../../packages/registry/themes/preset.js').PresetConfig} config a resolved preset
 */
export function presetThemeBlock(baseCss, config) {
  const { light, dark } = buildThemeVars(config);
  let css = setBlockVars(baseCss, ':root', light);
  css = setBlockVars(css, '.dark', dark);
  css = setBlockVars(css, '@theme inline', presetFontVars(config));
  return withEndMarker(css);
}

/** A block that does not already close with the end marker gets one. */
function withEndMarker(block) {
  if (block.includes(THEME_END_MARKER)) return block;
  return block.replace(/\s*$/, '\n') + '\n' + THEME_END_MARKER + '\n';
}

/**
 * Ensure the theme tokens exist in the project's Tailwind CSS file.
 *
 * With no block present it appends one. With a block present it is a no-op,
 * unless `opts.replace` is set, in which case a block carrying the end marker
 * is replaced in place and a block without one is left alone and reported as
 * `'legacy'`. The block written is `opts.block` when given (a preset's), else
 * the `theme-<baseColor>` registry item's file. Returns a status so the caller
 * decides how to react (`init` fails hard on `'failed'`; `add` warns).
 *
 * @param {string} cwd
 * @param {string} baseColor  one of the base-colour names (`neutral`, ...)
 * @param {string} cssPath    project-relative path to the Tailwind CSS file
 * @param {string} [registryUrl]
 * @param {{ replace?: boolean, block?: string }} [opts]
 * @returns {Promise<{ status: 'written'|'replaced'|'present'|'legacy'|'failed', cssPath: string, error?: string }>}
 */
export async function ensureTheme(cwd, baseColor, cssPath, registryUrl, opts = {}) {
  if (!cssPath || !baseColor) {
    return { status: 'failed', cssPath: cssPath || '', error: 'missing tailwind.css / tailwind.baseColor in components.json' };
  }
  const target = join(cwd, cssPath);
  const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const start = existing.indexOf(THEME_MARKER);
  if (start >= 0 && !opts.replace) {
    return { status: 'present', cssPath };
  }
  const end = start >= 0 ? existing.indexOf(THEME_END_MARKER, start) : -1;
  if (start >= 0 && end < 0) {
    return { status: 'legacy', cssPath };
  }

  let themeBlock = opts.block || '';
  if (!themeBlock) {
    let item;
    try {
      item = await getRegistryItem(`theme-${baseColor}`, registryUrl);
    } catch (e) {
      return { status: 'failed', cssPath, error: e && e.message ? e.message : String(e) };
    }
    themeBlock = item && item.files && item.files[0] ? item.files[0].content || '' : '';
    if (!themeBlock) {
      return { status: 'failed', cssPath, error: `theme-${baseColor} has no content` };
    }
  }
  themeBlock = withEndMarker(themeBlock);

  let next;
  if (start >= 0) {
    // Replace from the start marker through the end of the end-marker line.
    const lineEnd = existing.indexOf('\n', end);
    const after = lineEnd < 0 ? '' : existing.slice(lineEnd + 1);
    next = existing.slice(0, start) + themeBlock + after;
  } else {
    next = existing + (existing && !existing.endsWith('\n') ? '\n' : '') + themeBlock;
  }
  try {
    ensureDir(dirname(target));
    writeFileSync(target, next, 'utf8');
  } catch (e) {
    return { status: 'failed', cssPath, error: e && e.message ? e.message : String(e) };
  }
  return { status: start >= 0 ? 'replaced' : 'written', cssPath };
}
