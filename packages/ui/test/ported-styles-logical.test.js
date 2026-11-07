/**
 * The ported shadcn styles are logical, as the kit is (#1666): port-styles
 * maps every `@apply` class through shadcn's RTL table on the way in, so a
 * `dir="rtl"` page flips the input-otp corners, the menu insets and the rest
 * with no build step. A class the table would still change means a style was
 * copied without the mapping.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logicalToken, rtlTwin, rtlClassList } from '../scripts/logical-classes.mjs';

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'registry', 'styles');
const PORTED = ['vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea'];

for (const name of PORTED) {
  test(`style-${name}: every @apply class is already logical`, () => {
    const css = readFileSync(join(STYLES, `style-${name}.css`), 'utf8');
    const physical = [];
    for (const [, classes] of css.matchAll(/@apply\s+([^;]+);/g)) {
      for (const t of classes.split(/\s+/).filter(Boolean)) if (logicalToken(t) !== t) physical.push(t);
    }
    assert.deepEqual([...new Set(physical)], [], `physical classes left in style-${name}.css`);
  });
}

// A horizontal translate has no logical form, so it carries an `rtl:` twin
// that negates it, as shadcn's transform adds. Without one a switch thumb,
// which starts at the right under `dir="rtl"`, slides out of its track.
for (const name of [...PORTED, 'new-york']) {
  test(`style-${name}: every horizontal translate has its rtl: twin`, () => {
    const css = readFileSync(join(STYLES, `style-${name}.css`), 'utf8');
    const missing = [];
    for (const [, classes] of css.matchAll(/@apply\s+([^;]+);/g)) {
      const tokens = new Set(classes.split(/\s+/).filter(Boolean));
      for (const t of tokens) {
        const twin = rtlTwin(t);
        if (twin && !tokens.has(twin)) missing.push(t);
      }
    }
    assert.deepEqual(missing, [], `style-${name}.css`);
  });
}

test('rtlTwin negates a horizontal translate, swaps a resize cursor, and leaves a centring translate alone', () => {
  assert.equal(rtlTwin('group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)]'), 'rtl:group-data-[size=sm]/switch:data-checked:-translate-x-[calc(100%-2px)]');
  assert.equal(rtlTwin('-translate-x-px'), 'rtl:translate-x-px');
  assert.equal(rtlTwin('cursor-w-resize'), 'rtl:cursor-e-resize');
  assert.equal(rtlTwin('translate-x-[-50%]'), null);
  assert.equal(rtlTwin('-translate-x-1/2'), null);
  assert.equal(rtlTwin('rtl:translate-x-px'), null);
  assert.equal(rtlClassList('ml-2 translate-x-px'), 'ms-2 translate-x-px rtl:-translate-x-px');
  assert.equal(rtlClassList('translate-x-px rtl:-translate-x-px'), 'translate-x-px rtl:-translate-x-px', 'idempotent');
});

test('style-nova: the input-otp slot joins its corners on the logical sides', () => {
  const css = readFileSync(join(STYLES, 'style-nova.css'), 'utf8');
  const rule = css.match(/\.cn-input-otp-slot\s*\{\s*@apply([^;]+);/)[1];
  for (const c of ['first:rounded-s-lg', 'first:border-s', 'last:rounded-e-lg', 'border-e']) {
    assert.ok(rule.split(/\s+/).includes(c), c);
  }
});
