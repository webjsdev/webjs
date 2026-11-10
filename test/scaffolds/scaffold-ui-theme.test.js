/**
 * A fresh app wears the webjs.dev/ui theme: every colour token the scaffold
 * writes into styles/globals.css equals the `.ui-site` palette the site
 * declares in website/public/ui-input.css (light on :root, dark on .dark),
 * with the site's radius and Geist type. The site is the source; this test is
 * what keeps a palette change there from leaving new apps behind.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scaffoldApp } from '../../packages/cli/lib/create.js';

const REPO = join(import.meta.dirname, '..', '..');

/** The `.ui-site` tokens as { name: [light, dark] }, read off light-dark(LIGHT, DARK). */
function sitePalette() {
  const css = readFileSync(join(REPO, 'website', 'public', 'ui-input.css'), 'utf8');
  const block = css.slice(css.indexOf('.ui-site {'), css.indexOf('\n}', css.indexOf('.ui-site {')));
  /** @type {Record<string, [string, string]>} */
  const out = {};
  for (const m of block.matchAll(/--([\w-]+):\s*light-dark\((oklch\([^)]*\)),\s*(oklch\([^)]*\))\);/g)) out[m[1]] = [m[2], m[3]];
  const radius = /--radius:\s*([^;]+);/.exec(block);
  return { colours: out, radius: radius && radius[1].trim() };
}

/** The value of `--name` in the first `selector {` block of `css`. */
function tokenIn(css, selector, name) {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('\n}', start));
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(body);
  return m && m[1].trim();
}

test('a fresh app\'s theme is the webjs.dev/ui palette, radius and type', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'webjs-ui-theme-'));
  try {
    await scaffoldApp('my-app', cwd, { template: 'full-stack' });
    const theme = readFileSync(join(cwd, 'my-app', 'styles', 'globals.css'), 'utf8');
    const { colours, radius } = sitePalette();
    const names = ['background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground',
      'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
      'accent', 'accent-foreground', 'destructive', 'destructive-foreground', 'border', 'input', 'ring',
      'sidebar', 'sidebar-foreground', 'sidebar-primary', 'sidebar-primary-foreground', 'sidebar-accent',
      'sidebar-accent-foreground', 'sidebar-border', 'sidebar-ring'];
    for (const name of names) {
      assert.ok(colours[name], `the site declares --${name}`);
      assert.equal(tokenIn(theme, ':root', name), colours[name][0], `light --${name}`);
      assert.equal(tokenIn(theme, '.dark', name), colours[name][1], `dark --${name}`);
    }
    assert.equal(tokenIn(theme, ':root', 'radius'), radius, 'the site\'s radius');
    assert.match(tokenIn(theme, '@theme inline', 'font-sans'), /^'Geist'/, 'Geist for text');
    assert.match(tokenIn(theme, '@theme inline', 'font-mono'), /^'Geist Mono'/, 'Geist Mono for code');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('a fresh app\'s header shows the WebJs logo, the same files webjs.dev serves', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'webjs-ui-logo-'));
  try {
    await scaffoldApp('my-app', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'my-app');
    const layout = readFileSync(join(appDir, 'app', 'layout.ts'), 'utf8');
    const header = layout.slice(layout.indexOf('<header'), layout.indexOf('</header>'));
    assert.match(header, /<img src="\/brand\/webjs-lockup-on-light\.svg" alt="WebJs"[^>]*dark:hidden/, 'the light logo, hidden in dark');
    assert.match(header, /<img src="\/brand\/webjs-lockup-on-dark\.svg" alt="WebJs"[^>]*hidden[^>]*dark:block/, 'the dark logo, shown in dark');
    assert.doesNotMatch(header, />\s*My App\s*</, 'no app-name text in its place');
    for (const file of ['webjs-lockup-on-light.svg', 'webjs-lockup-on-dark.svg']) {
      assert.equal(
        readFileSync(join(appDir, 'public', 'brand', file), 'utf8'),
        readFileSync(join(REPO, 'website', 'public', 'brand', file), 'utf8'),
        `${file} is the site's file`,
      );
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
