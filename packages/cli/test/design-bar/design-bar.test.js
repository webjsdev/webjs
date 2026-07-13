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
  assert.match(DESIGN_REMINDER, /COLOR VALUES are yours/, 'says the token colors are the app\'s own');
  assert.match(DESIGN_REMINDER, /play through every state/, 'says to exercise every state, not just the first paint');
  assert.match(DESIGN_REMINDER, /item 6/);
});

test('scaffoldShellTells detects the kept-shell signals', () => {
  const layout = `<main class="max-w-[760px]">\${children}</main>
    <a href="https://webjs.dev">Built with webjs</a>`;
  const tells = scaffoldShellTells(layout);
  assert.ok(tells.length >= 2, `expected multiple tells, got ${tells.length}`);
  assert.ok(tells.some((t) => /760px/.test(t)));
  assert.ok(tells.some((t) => /attribution/.test(t)));
});

test('theme-toggle and --header-h are NOT tells (kept infrastructure, avoids nagging a finished app)', () => {
  // The minimal shell ships the theme apparatus (`--header-h`, the theme-toggle
  // import) in EVERY app, so counting them warned on every correctly-finished
  // app forever. A layout that recolored the palette and dropped the reading
  // column but kept the theme apparatus must score 0 tells.
  const finished = `import '#components/theme-toggle.ts';
    <style>:root { --header-h: 0px; --primary: oklch(0.55 0.2 265); --card: oklch(0.2 0.03 265); }</style>
    <main class="min-h-dvh"><theme-toggle></theme-toggle>\${children}</main>`;
  assert.deepEqual(scaffoldShellTells(finished), [], 'kept theme apparatus + own palette is not a tell');
});

test('scaffoldShellTells returns nothing for a bespoke layout (counterfactual)', () => {
  const bespoke = `export default ({ children }) => html\`<div class="min-h-dvh grid place-items-center">\${children}</div>\``;
  assert.deepEqual(scaffoldShellTells(bespoke), []);
  assert.deepEqual(scaffoldShellTells(''), []);
  assert.deepEqual(scaffoldShellTells(undefined), []);
});

test('the default scaffold palette values are a tell; a recolored palette is not', () => {
  // Keeping the scaffold's exact token colors is not owning the palette.
  const kept = `<style>:root { --primary: oklch(0.7 0.16 52); --card: oklch(0.18 0.01 55); }</style>`;
  const tells = scaffoldShellTells(kept);
  assert.ok(tells.some((t) => /primary color/.test(t)), 'default primary is a tell');
  assert.ok(tells.some((t) => /card color/.test(t)), 'default card is a tell');
  // A recolored palette (own values) is NOT flagged.
  const recolored = `<style>:root { --primary: oklch(0.55 0.2 265); --card: oklch(0.2 0.03 265); }</style>`;
  assert.deepEqual(scaffoldShellTells(recolored), [], 'an own palette is not a tell');
});

test('a bespoke "Built with X" footer is NOT an attribution tell (no false positive)', () => {
  // A redesigned dashboard that kept a dark-mode toggle and wrote its own footer
  // must score zero tells on a generic "Built with ..." string.
  const redesigned = `<theme-toggle></theme-toggle><footer>Built with care by Acme</footer>`;
  assert.deepEqual(scaffoldShellTells(redesigned), [], 'neither the toggle nor a generic footer is a tell');
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
