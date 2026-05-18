/**
 * Verifies the per-base-colour override data + CSS merger.
 *
 * The 6 non-neutral themes are synthesized on demand by the website composer
 * (no committed JSON, no build step). This test pins the data shape +
 * merger semantics so a regression there doesn't silently ship broken themes
 * - the failure mode otherwise is `webjsui init --base-color stone` writing
 * neutral CSS, which is hard to spot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REGISTRY_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'registry');
const BASE_COLORS_PATH = join(REGISTRY_DIR, 'themes', 'base-colors.js');
const NEUTRAL_CSS_PATH = join(REGISTRY_DIR, 'themes', 'index.css');

const skip = !existsSync(BASE_COLORS_PATH);

test('exports the 7 shadcn base colours', { skip }, async () => {
  const m = await import(BASE_COLORS_PATH);
  assert.deepEqual(m.BASE_COLORS, ['neutral', 'stone', 'zinc', 'mauve', 'olive', 'mist', 'taupe']);
});

test('every base colour has a title + description + overrides entry', { skip }, async () => {
  const { BASE_COLORS, BASE_TITLES, BASE_DESCRIPTIONS, BASE_OVERRIDES } = await import(BASE_COLORS_PATH);
  for (const c of BASE_COLORS) {
    assert.ok(BASE_TITLES[c], `missing title for ${c}`);
    assert.ok(BASE_DESCRIPTIONS[c], `missing description for ${c}`);
    assert.ok(BASE_OVERRIDES[c], `missing overrides entry for ${c}`);
    assert.ok(BASE_OVERRIDES[c].light, `missing light overrides for ${c}`);
    assert.ok(BASE_OVERRIDES[c].dark, `missing dark overrides for ${c}`);
  }
});

test('mergeThemeCss returns neutral CSS verbatim when overrides are empty', { skip }, async () => {
  const { mergeThemeCss } = await import(BASE_COLORS_PATH);
  const neutral = readFileSync(NEUTRAL_CSS_PATH, 'utf8');
  const merged = mergeThemeCss(neutral, { light: {}, dark: {} });
  assert.equal(merged, neutral, 'empty overrides must be a no-op');
});

test('mergeThemeCss replaces only :root vars when given light overrides', { skip }, async () => {
  const { mergeThemeCss } = await import(BASE_COLORS_PATH);
  const neutral = readFileSync(NEUTRAL_CSS_PATH, 'utf8');
  const merged = mergeThemeCss(neutral, {
    light: { ring: 'oklch(0.709 0.01 56.259)' },
    dark: {},
  });
  // :root block now has stone ring.
  const rootBlock = merged.match(/:root\s*\{[\s\S]*?\n\}/)[0];
  assert.match(rootBlock, /--ring: oklch\(0\.709 0\.01 56\.259\)/);
  // .dark block still has neutral ring.
  const darkBlock = merged.match(/\.dark\s*\{[\s\S]*?\n\}/)[0];
  assert.match(darkBlock, /--ring: oklch\(0\.556 0 0\)/);
});

test('mergeThemeCss with stone overrides yields stone-specific values', { skip }, async () => {
  const { mergeThemeCss, BASE_OVERRIDES } = await import(BASE_COLORS_PATH);
  const neutral = readFileSync(NEUTRAL_CSS_PATH, 'utf8');
  const merged = mergeThemeCss(neutral, BASE_OVERRIDES.stone);

  // light :root values
  assert.match(merged, /--foreground: oklch\(0\.147 0\.004 49\.25\)/);
  assert.match(merged, /--ring: oklch\(0\.709 0\.01 56\.259\)/);
  // dark .dark values
  assert.match(merged, /--background: oklch\(0\.147 0\.004 49\.25\)/);
  assert.match(merged, /--ring: oklch\(0\.553 0\.013 58\.071\)/);

  // No leftover neutral ring values.
  assert.equal(/--ring: oklch\(0\.708 0 0\)/.test(merged), false);
  assert.equal(/--ring: oklch\(0\.556 0 0\)/.test(merged), false);

  // Keys NOT in stone overrides (e.g. --sidebar-foreground) keep neutral defaults.
  assert.match(merged, /--sidebar-foreground: oklch\(0\.145 0 0\)/);
});

test('mergeThemeCss preserves @theme block, custom variants, keyframes, @layer', { skip }, async () => {
  const { mergeThemeCss, BASE_OVERRIDES } = await import(BASE_COLORS_PATH);
  const neutral = readFileSync(NEUTRAL_CSS_PATH, 'utf8');
  const merged = mergeThemeCss(neutral, BASE_OVERRIDES.mauve);

  assert.match(merged, /@theme inline \{/);
  assert.match(merged, /@custom-variant data-open/);
  assert.match(merged, /@keyframes accordion-down/);
  assert.match(merged, /@layer base/);
});
