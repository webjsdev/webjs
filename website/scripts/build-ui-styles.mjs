#!/usr/bin/env node
/**
 * Compile the kit styles that public/ui.css does not carry, one stylesheet
 * per style, into public/ui-styles/<name>.css (#1666, D8).
 *
 * public/ui.css holds nova (the docs) and new-york (blocks and charts). The
 * other seven are needed only by the pages that show them: the home page's
 * card grid (rhea), the configurator and its preview, Sera, typeset. One
 * style compiles to about 310 KB (24 KB gzipped) and all seven to about
 * 2 MB (154 KB gzipped), so each gets its own file and a page links only
 * the styles it renders (lib/ui/style-links.ts).
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

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
const styles = resolve(site, '../packages/ui/packages/registry/styles');

/** The styles public/ui.css does NOT carry. */
export const EXTRA_STYLES = ['luma', 'lyra', 'maia', 'mira', 'rhea', 'sera', 'vega'];

const cacheDir = join(site, 'node_modules', '.cache', 'ui-styles');
const outDir = join(site, 'public', 'ui-styles');
mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const only = process.argv.slice(2);
const names = only.length ? EXTRA_STYLES.filter((n) => only.includes(n)) : EXTRA_STYLES;

for (const name of names) {
  const input = join(cacheDir, `${name}.input.css`);
  writeFileSync(input, [
    '@import "tailwindcss/theme.css" layer(theme);',
    '@import "tailwindcss/utilities.css" layer(utilities) source(none);',
    `@import "${join(site, 'public', 'ui-theme.css')}";`,
    `@import "${join(styles, 'tw-animate.css')}";`,
    `@import "${join(styles, 'shadcn-tailwind.css')}";`,
    `@import "${join(styles, `style-${name}.css`)}" layer(base);`,
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
