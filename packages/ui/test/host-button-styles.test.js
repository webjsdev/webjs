/**
 * <ui-toggle-group-item> is a custom element whose HOST is the button
 * (role="button"), not a native <button>. A native button gets a non-text
 * cursor and unselectable text from the browser, and its `disabled:` variants
 * match the :disabled pseudo. The host gets none of that, so every style has
 * to give it explicitly or the item shows a text I-beam over its label, lets
 * the label be drag-selected, and draws a disabled item as an enabled one.
 *
 * new-york carries these on its own rules; the ported shadcn styles, written
 * for a native button, get them from the supplement (styles/supplement.json).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'registry', 'styles');
const ALL = ['new-york', 'vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea'];

/** Every class a style @applies to the given cn-* names, across all its rules. */
function applied(css, names) {
  const tokens = new Set();
  for (const name of names) {
    const re = new RegExp(`\\.${name}\\s*\\{\\s*@apply\\s+([^;]+);`, 'g');
    for (const [, classes] of css.matchAll(re)) {
      for (const t of classes.split(/\s+/).filter(Boolean)) tokens.add(t);
    }
  }
  return tokens;
}

for (const name of ALL) {
  test(`style-${name}: a toggle-group item host behaves like a native button`, () => {
    const css = readFileSync(join(STYLES, `style-${name}.css`), 'utf8');
    const tokens = applied(css, ['cn-toggle', 'cn-toggle-group-item']);
    assert.ok(
      tokens.has('cursor-default') || tokens.has('cursor-pointer'),
      `style-${name}.css sets no button cursor on the item, so its label shows a text I-beam`,
    );
    assert.ok(tokens.has('select-none'), `style-${name}.css leaves the item label selectable`);
    assert.ok(tokens.has('aria-disabled:pointer-events-none'), `style-${name}.css: a disabled item still takes the pointer`);
    assert.ok(tokens.has('aria-disabled:opacity-50'), `style-${name}.css: a disabled item is drawn as an enabled one`);
  });
}
