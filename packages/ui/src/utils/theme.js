/**
 * Theme-token install, shared by `init` and `add` (#983).
 *
 * The class helpers render against CSS design tokens (`--background`,
 * `--foreground`, `--destructive`, ...) that the app must define. `init` plants
 * them; `add` self-heals if they are missing (an app that copied a component
 * without the tokens paints unstyled). Both go through {@link ensureTheme} so
 * the contract is one place: a token block is written exactly once, keyed by
 * the {@link THEME_MARKER}, and a genuine failure to write is reported (never
 * swallowed) so `init` can exit non-zero instead of leaving a clean exit code
 * on an unstyled install.
 *
 * @module utils/theme
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getRegistryItem } from '../registry/fetcher.js';

/** Idempotency marker at the top of the theme block. */
export const THEME_MARKER = '/* @webjsdev/ui theme */';

function ensureDir(d) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

/**
 * Ensure the theme tokens exist in the project's Tailwind CSS file. Idempotent:
 * if the marker is already present it is a no-op. Returns a status so the caller
 * decides how to react (`init` fails hard on `'failed'`; `add` warns).
 *
 * @param {string} cwd
 * @param {string} baseColor  one of the base-colour names (`neutral`, ...)
 * @param {string} cssPath    project-relative path to the Tailwind CSS file
 * @param {string} [registryUrl]
 * @returns {Promise<{ status: 'written'|'present'|'failed', cssPath: string, error?: string }>}
 */
export async function ensureTheme(cwd, baseColor, cssPath, registryUrl) {
  const target = join(cwd, cssPath);
  const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (existing.includes(THEME_MARKER)) {
    return { status: 'present', cssPath };
  }
  let item;
  try {
    item = await getRegistryItem(`theme-${baseColor}`, registryUrl);
  } catch (e) {
    return { status: 'failed', cssPath, error: e && e.message ? e.message : String(e) };
  }
  const themeBlock = item && item.files && item.files[0] ? item.files[0].content || '' : '';
  if (!themeBlock) {
    return { status: 'failed', cssPath, error: `theme-${baseColor} has no content` };
  }
  try {
    ensureDir(dirname(target));
    writeFileSync(
      target,
      existing + (existing && !existing.endsWith('\n') ? '\n' : '') + themeBlock,
      'utf8',
    );
  } catch (e) {
    return { status: 'failed', cssPath, error: e && e.message ? e.message : String(e) };
  }
  return { status: 'written', cssPath };
}
