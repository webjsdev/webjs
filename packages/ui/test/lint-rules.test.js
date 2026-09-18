/**
 * The three `webjsui lint` rules as pure functions (`src/lint/rules/*.js`):
 * a site in, violations out, no filesystem.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scanClassSites } from '../src/lint/scan.js';
import { extractHelperAxes } from '../src/registry/extract.js';
import { noRawColors } from '../src/lint/rules/no-raw-colors.js';
import { noArbitraryValues } from '../src/lint/rules/no-arbitrary-values.js';
import { noRestyle } from '../src/lint/rules/no-restyle.js';
import { RULES, RULE_NAMES } from '../src/lint/rules/index.js';

const TOKENS = ['background', 'foreground', 'primary', 'muted', 'muted-foreground', 'destructive', 'border'];
const site = (src, opts) => scanClassSites(src, opts)[0];
const attr = (classes) => site(`html\`<p class="${classes}">\``);
const KIT_BUTTON = readFileSync(new URL('../packages/registry/components/button.ts', import.meta.url), 'utf8');
const axesFor = (name) => ({ axes: extractHelperAxes(KIT_BUTTON)[name] ?? {}, file: 'components/ui/button.ts' });

test('no-raw-colors: fires on a palette utility, variants and opacity stripped', () => {
  const ctx = { tokens: TOKENS, themePath: 'public/input.css' };
  const v = noRawColors(attr('text-sm text-red-600'), ctx);
  assert.equal(v.length, 1);
  assert.equal(v[0].class, 'text-red-600');
  assert.equal(v[0].fix, 'text-destructive');
  const dark = noRawColors(attr('dark:text-red-600/50'), ctx);
  assert.equal(dark.length, 1);
  assert.equal(dark[0].class, 'dark:text-red-600/50');
  assert.match(dark[0].message, /^text-red-600 is a raw palette color/);
});

test('no-raw-colors: accepted colour names and theme tokens never fire', () => {
  const ctx = { tokens: TOKENS, themePath: 'public/input.css' };
  assert.deepEqual(noRawColors(attr('text-white text-black text-transparent text-current text-inherit text-destructive bg-primary'), ctx), []);
  // An arbitrary colour belongs to no-arbitrary-values, not here.
  assert.deepEqual(noRawColors(attr('bg-[#333]'), ctx), []);
});

test('no-raw-colors: the message names only declared tokens and the theme path', () => {
  const v = noRawColors(attr('text-red-600'), { tokens: TOKENS, themePath: 'public/input.css' })[0];
  assert.match(v.message, /text-destructive, text-muted-foreground, text-primary, text-foreground/);
  assert.match(v.message, /\(declared in public\/input\.css\)/);
  assert.match(v.message, /For error text, text-destructive is the role match, or use errorClass\(\) from the kit\./);
  for (const named of v.message.matchAll(/\btext-([a-z][a-z-]*[a-z])\b/g)) {
    if (named[1] === 'red') continue; // the offender itself
    assert.ok(TOKENS.includes(named[1]), `${named[0]} is not a declared token`);
  }
  // Without `destructive` in the theme, the role suggestion is omitted entirely.
  const none = noRawColors(attr('text-red-600'), { tokens: ['primary', 'foreground'], themePath: 'x.css' })[0];
  assert.doesNotMatch(none.message, /destructive|role match|errorClass/);
  assert.equal(none.fix, undefined);
  // A neutral family suggests muted-foreground for text and muted otherwise.
  assert.equal(noRawColors(attr('text-gray-500'), { tokens: TOKENS, themePath: 'x' })[0].fix, 'text-muted-foreground');
  assert.equal(noRawColors(attr('bg-zinc-100'), { tokens: TOKENS, themePath: 'x' })[0].fix, 'bg-muted');
});

test('no-arbitrary-values: fires on values, not on variants; padding is spacing under allow layout', () => {
  assert.deepEqual(noArbitraryValues(attr('p-[13px] ring-[3px]'), {}).map((v) => v.class), ['p-[13px]', 'ring-[3px]']);
  assert.deepEqual(noArbitraryValues(attr('[&_svg]:size-4 has-[>svg]:px-3 data-[state=open]:flex bg-(--brand)'), {}), []);
  const v = noArbitraryValues(attr('p-[13px] w-[13px]'), { allow: ['layout'] });
  assert.deepEqual(v.map((x) => x.class), ['p-[13px]']);
  assert.match(v[0].message, /arbitrary value \(spacing, group p\)/);
  assert.deepEqual(noArbitraryValues(attr('p-[13px]'), { allow: ['spacing'] }), []);
  assert.deepEqual(noArbitraryValues(attr('p-[13px]'), { allow: ['p'] }), []);
});

test('no-restyle: the skill sanctioned one-off passes under allow layout+rounded, fires once under layout alone', () => {
  const src = "html`<button class=${cn(buttonClass({ variant: 'secondary', size: 'none' }), 'w-9 h-9 rounded-full')}>`";
  const s = site(src, { helpers: ['buttonClass'] });
  assert.deepEqual(noRestyle(s, { allow: ['layout', 'rounded'], axesFor }), []);
  const v = noRestyle(s, { allow: ['layout'], axesFor });
  assert.equal(v.length, 1);
  assert.equal(v[0].class, 'rounded-full');
  assert.match(v[0].message, /^rounded-full overrides what buttonClass already sets\. Use a buttonClass size: default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg \(declared in components\/ui\/button\.ts\)\.$/);
});

test('no-restyle: both authored shapes fire, a site with no helper never does', () => {
  const quoted = site('html`<button class="${buttonClass()} bg-pink-500">`', { helpers: ['buttonClass'] });
  const v = noRestyle(quoted, { allow: ['layout'], axesFor });
  assert.equal(v.length, 1);
  assert.match(v[0].message, /Use a buttonClass variant: default, destructive, outline, secondary, ghost, link/);
  assert.deepEqual(noRestyle(attr('bg-pink-500'), { axesFor }), []);
  // A helper the projector cannot resolve yields a message with no invented list.
  const opaque = noRestyle(quoted, { allow: [], axesFor: () => ({ axes: {}, file: null }) });
  assert.doesNotMatch(opaque[0].message, /Use a buttonClass (variant|size):/);
  assert.match(opaque[0].message, /Pick a variant buttonClass exposes/);
});

test('rules table: the three rules are registered by their config names', () => {
  assert.deepEqual(RULE_NAMES, ['no-raw-colors', 'no-arbitrary-values', 'no-restyle']);
  assert.equal(RULES['no-restyle'], noRestyle);
});

test('no-raw-colors: the role sentence names the surface by prefix', () => {
  const ctx = { tokens: TOKENS, themePath: 'x.css' };
  assert.match(noRawColors(attr('border-red-500'), ctx)[0].message, /For error border colors, border-destructive is the role match\./);
  assert.match(noRawColors(attr('bg-red-500'), ctx)[0].message, /For error surfaces, bg-destructive is the role match\./);
  assert.match(noRawColors(attr('ring-gray-300'), ctx)[0].message, /For muted ring colors, ring-muted is the role match\./);
});

test('no-restyle: a site composed with two helpers names both and reads axes from the last', () => {
  const s = site("html`<span class=${cn(buttonClass(), badgeClass(), 'bg-pink-500')}>`", { helpers: ['buttonClass', 'badgeClass'] });
  const calls = [];
  const [v] = noRestyle(s, { allow: ['layout'], axesFor: (h) => { calls.push(h); return { axes: { variant: ['default', 'outline'] }, file: `components/ui/${h.replace('Class', '')}.ts` }; } });
  assert.match(v.message, /^bg-pink-500 overrides what buttonClass and badgeClass already set\. Use a badgeClass variant: default, outline \(declared in components\/ui\/badge\.ts\)\.$/);
  assert.deepEqual(calls, ['badgeClass']);
});

test('no-raw-colors: fix is a drop-in for the reported class (variants, opacity and ! survive)', () => {
  const ctx = { tokens: TOKENS, themePath: 'x' };
  for (const [cls, fix] of [
    ['hover:text-red-600/50', 'hover:text-destructive/50'],
    ['dark:md:bg-gray-100', 'dark:md:bg-muted'],
    ['!text-red-600', '!text-destructive'],
    ['[&.text-red-600]:text-red-600', '[&.text-red-600]:text-destructive'],
  ]) {
    const [v] = noRawColors(attr(cls), ctx);
    assert.equal(v.class, cls);
    assert.equal(v.fix, fix, cls);
  }
});

test('no-restyle: a weight or underline override names the variant axis, a font size the size axis', () => {
  const run = (cls) => noRestyle(
    site(`html\`<a class="\${buttonClass()} ${cls}">\``, { helpers: ['buttonClass'] }),
    { allow: ['layout'], axesFor: () => ({ axes: { variant: ['default', 'link'], size: ['default', 'sm'] }, file: null }) },
  )[0].message;
  assert.match(run('no-underline'), /Use a buttonClass variant: default, link/);
  assert.match(run('font-bold'), /Use a buttonClass variant:/);
  assert.match(run('text-lg'), /Use a buttonClass size: default, sm/);
  assert.match(run('px-8'), /Use a buttonClass size:/);
});
