/**
 * Write each kit style as a CSS @scope block that stops at any nested style
 * wrapper (#1666, D8), into node_modules/.cache/ui-styles/scoped/.
 *
 * The registry's style files are nested rules under one `.style-<name>`
 * selector, so as written a rule matches every descendant of the wrapper.
 * On this site a region in one style can sit inside a region in another (a
 * nova demo inside the new-york docs chrome), and then both styles' rules
 * apply to it. shadcn never has that problem, because it bakes each part into
 * one style at import time. Scoping each style from its wrapper down to the
 * next style wrapper gives the same answer at runtime: the nearest wrapper
 * wins, and nothing leaks across.
 *
 * The registry files stay byte-for-byte shadcn's (the CLI's bake reads them),
 * so the scoping is applied to copies. public/ui-input.css and
 * scripts/build-ui-styles.mjs compile these copies. copy-registry.mjs runs
 * this before every build of public/ui.css, and build-ui-styles.mjs runs it
 * itself.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
const styles = resolve(site, '../packages/ui/packages/registry/styles');

export const STYLE_NAMES = ['new-york', 'nova', 'vega', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea'];
export const SCOPED_DIR = join(site, 'node_modules', '.cache', 'ui-styles', 'scoped');

const LIMIT = `:is(${STYLE_NAMES.map((n) => `.style-${n}`).join(', ')})`;

/** One style file's text, each top-level `.style-<name> {` turned into a scope. */
export function scopeStyle(name, css) {
  const head = new RegExp(`^\\.style-${name.replace(/-/g, '\\-')} \\{$`, 'gm');
  const out = css.replace(head, `@scope (.style-${name}) to (${LIMIT}) {`);
  if (out === css) throw new Error(`style-${name}.css has no top-level .style-${name} block`);
  return out;
}

export function writeScopedStyles() {
  mkdirSync(SCOPED_DIR, { recursive: true });
  for (const name of STYLE_NAMES) {
    const css = readFileSync(join(styles, `style-${name}.css`), 'utf8');
    writeFileSync(join(SCOPED_DIR, `style-${name}.css`), scopeStyle(name, css));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeScopedStyles();
  console.log(`[scope-ui-styles] wrote ${STYLE_NAMES.length} scoped styles`);
}
