import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_REMINDER, scaffoldShellTells } from '../../lib/design-bar.js';

test('DESIGN_REMINDER states the bar and points at the convention', () => {
  assert.match(DESIGN_REMINDER, /TEACHING artifact/);
  assert.match(DESIGN_REMINDER, /OWN design/);
  assert.match(DESIGN_REMINDER, /render the app and look at it/);
  assert.match(DESIGN_REMINDER, /item 6/);
});

test('scaffoldShellTells detects the kept-shell signals', () => {
  const layout = `import '#components/theme-toggle.ts';
    <header class="fixed" style="--header-h:56px">
    <main class="max-w-[760px]"><theme-toggle></theme-toggle></main>
    <a href="https://webjs.dev">Built with</a>`;
  const tells = scaffoldShellTells(layout);
  assert.ok(tells.length >= 3, `expected multiple tells, got ${tells.length}`);
  assert.ok(tells.some((t) => /760px/.test(t)));
  assert.ok(tells.some((t) => /theme-toggle/.test(t)));
});

test('scaffoldShellTells returns nothing for a bespoke layout (counterfactual)', () => {
  const bespoke = `export default ({ children }) => html\`<div class="min-h-dvh grid place-items-center">\${children}</div>\``;
  assert.deepEqual(scaffoldShellTells(bespoke), []);
  assert.deepEqual(scaffoldShellTells(''), []);
  assert.deepEqual(scaffoldShellTells(undefined), []);
});
