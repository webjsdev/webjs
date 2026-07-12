import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DESIGN_REMINDER, scaffoldShellTells, hasUiLayout } from '../../lib/design-bar.js';

test('hasUiLayout is true for a UI app and false for a layout-less (api) app', () => {
  const ui = mkdtempSync(join(tmpdir(), 'db-ui-'));
  const api = mkdtempSync(join(tmpdir(), 'db-api-'));
  try {
    mkdirSync(join(ui, 'app'), { recursive: true });
    writeFileSync(join(ui, 'app', 'layout.ts'), 'export default () => null;');
    mkdirSync(join(api, 'app', 'health'), { recursive: true });
    writeFileSync(join(api, 'app', 'health', 'route.ts'), 'export const GET = () => new Response();');
    assert.equal(hasUiLayout(ui), true);
    assert.equal(hasUiLayout(api), false, 'an api app with no app/layout is not a UI app');
  } finally {
    rmSync(ui, { recursive: true, force: true });
    rmSync(api, { recursive: true, force: true });
  }
});

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
