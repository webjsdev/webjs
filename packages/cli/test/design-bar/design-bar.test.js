import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESIGN_REMINDER, scaffoldShellTells, hasUiLayout } from '../../lib/design-bar.js';

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'webjs.js');
const MARKER = 'webjs-scaffold-' + 'placeholder';

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

test('a bespoke "Built with X" footer is NOT an attribution tell (no false positive)', () => {
  // A redesigned dashboard that kept a dark-mode toggle and wrote its own footer
  // must not reach the 2-tell threshold on a generic "Built with ..." string.
  const redesigned = `<theme-toggle></theme-toggle><footer>Built with care by Acme</footer>`;
  const tells = scaffoldShellTells(redesigned);
  assert.deepEqual(tells, ['theme-toggle chrome'], 'only the toggle counts, not the generic footer');
  // The real scaffold footer (its own attribution) still counts.
  assert.ok(scaffoldShellTells(`<a href="https://webjs.dev">x</a>`).includes('attribution footer'));
});

// Integration: `webjs check --clear-placeholders` re-surfaces the design bar on
// a UI app, but stays quiet on a layout-less (api) app.
function clearIn(files) {
  const dir = mkdtempSync(join(tmpdir(), 'db-clear-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  const out = spawnSync(process.execPath, [CLI, 'check', '--clear-placeholders'], { cwd: dir, encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return (out.stdout || '') + (out.stderr || '');
}

test('--clear-placeholders surfaces the design bar on a UI app, quiet on api', () => {
  const uiOut = clearIn({
    'app/layout.ts': `// ${MARKER}. adapt this chrome. webjs check fails while the marker remains.\nexport default ({ children }) => children;\n`,
  });
  assert.match(uiOut, /TEACHING artifact/, 'UI app re-surfaces the design bar');

  const apiOut = clearIn({
    'app/health/route.ts': `// ${MARKER}. demo route. webjs check fails while the marker remains.\nexport const GET = () => new Response();\n`,
  });
  assert.doesNotMatch(apiOut, /TEACHING artifact/, 'api app (no layout) stays quiet');
});
