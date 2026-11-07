#!/usr/bin/env node
/**
 * Compile the kit styles, one stylesheet per style, into
 * public/ui-styles/<name>.css (#1666, D8).
 *
 * public/ui.css carries none of them. One style compiles to about 300 KB
 * (24 KB gzipped) and is full of :has() rules the browser re-checks on every
 * style recalculation, so a page links only the styles it renders
 * (lib/ui/style-links.ts): the chrome and the blocks new-york, the docs
 * previews nova, the home page's card grid rhea, and so on. nova and
 * new-york used to be compiled into ui.css, which made every /ui page carry
 * both, a dashboard frame that renders only new-york included.
 *
 * Each style is nested rules keyed on cn-* names and built from @apply under
 * `.style-<name>`. The input therefore needs the theme (to resolve @apply),
 * the shared variants (public/ui-theme.css), and the animation and variant
 * helpers, but emits no utilities of its own: `source(none)` with no @source
 * scans nothing. A page's utilities come from public/ui.css, and the tokens
 * are declared once, on `.ui-site`, in public/ui-input.css.
 *
 * The generated inputs go to node_modules/.cache, with absolute import paths,
 * so nothing but the outputs lands in the tree.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { writeScopedStyles, SCOPED_DIR, STYLE_NAMES } from './scope-ui-styles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
const styles = resolve(site, '../packages/ui/packages/registry/styles');

const cacheDir = join(site, 'node_modules', '.cache', 'ui-styles');
const outDir = join(site, 'public', 'ui-styles');
mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

writeScopedStyles();

const only = process.argv.slice(2);
const names = only.length ? STYLE_NAMES.filter((n) => only.includes(n)) : STYLE_NAMES;

for (const name of names) {
  const input = join(cacheDir, `${name}.input.css`);
  writeFileSync(input, [
    // The layer order ui.css declares, restated so a style sheet linked
    // without it still keeps its rules (layer base) below the utilities.
    '@layer theme, base, components, utilities;',
    '@import "tailwindcss/theme.css" layer(theme);',
    '@import "tailwindcss/utilities.css" layer(utilities) source(none);',
    `@import "${join(site, 'public', 'ui-theme.css')}";`,
    `@import "${join(styles, 'tw-animate.css')}";`,
    `@import "${join(styles, 'shadcn-tailwind.css')}";`,
    `@import "${join(SCOPED_DIR, `style-${name}.css`)}" layer(base);`,
    '',
  ].join('\n'));
  const out = join(outDir, `${name}.css`);
  const r = spawnSync('npx', ['tailwindcss', '-i', input, '-o', out, '--minify'], { cwd: site, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(r.stderr);
    process.exit(r.status ?? 1);
  }
}
console.log(`[build-ui-styles] wrote ${names.length} style${names.length === 1 ? '' : 's'} to public/ui-styles/`);
