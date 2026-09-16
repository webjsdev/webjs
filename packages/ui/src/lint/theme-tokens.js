/**
 * The theme-token READER behind `webjsui lint`: the `--color-<name>` tokens an
 * app's configured Tailwind CSS file declares, which is what a `no-raw-colors`
 * message names as the alternative to a raw palette utility.
 *
 * Distinct from `utils/theme.js`, which WRITES the token block for `init` and
 * `add`. The two are not merged and this one does not look for the
 * `THEME_MARKER`, because an app's theme file is its own and need not carry
 * the marker (the blog's `public/input.css` opens a plain `@theme {` and
 * declares tokens the kit does not ship).
 *
 * Both `@theme {` and `@theme inline {` are read: the kit's `themes/index.css`
 * uses the inline form, the blog the plain one.
 *
 * @module lint/theme-tokens
 */

import { readFileSync } from 'node:fs';

/**
 * Parse the `--color-<name>` declarations out of CSS text, inside `@theme` and
 * `@theme inline` blocks only. Pure over the text so it is testable without a
 * file.
 *
 * @param {string} css
 * @returns {string[]} token names without the `--color-` prefix, in declaration order, deduplicated
 */
export function parseThemeTokens(css) {
  /** @type {string[]} */
  const tokens = [];
  const re = /@theme\b[^{;]*\{/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let close = -1;
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') { depth--; if (depth === 0) { close = i; break; } }
    }
    if (close === -1) break;
    const body = css.slice(open + 1, close);
    const declRe = /--color-([A-Za-z0-9_-]+)\s*:/g;
    let d;
    while ((d = declRe.exec(body)) !== null) {
      if (!tokens.includes(d[1])) tokens.push(d[1]);
    }
    re.lastIndex = close;
  }
  return tokens;
}

/**
 * Read the theme tokens from a CSS file. A missing or unreadable file, or one
 * with no `--color-*` declaration inside a `@theme` block, yields an empty
 * `tokens` array rather than throwing; the caller then disables `no-raw-colors`
 * for the run and names the path, since a message that cannot offer an
 * alternative has no value.
 *
 * @param {string} cssPath
 * @returns {{ tokens: string[], path: string }}
 */
export function readThemeTokens(cssPath) {
  let css = '';
  try {
    css = readFileSync(cssPath, 'utf8');
  } catch {
    return { tokens: [], path: cssPath };
  }
  return { tokens: parseThemeTokens(css), path: cssPath };
}
