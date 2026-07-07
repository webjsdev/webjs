import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Guards the #819 split: importing `cn` must NOT pin a page to the browser, so
// the registry `lib/utils.ts` (copied to a scaffold's `lib/utils/cn.ts`) must
// stay pure. Any client global (`document`, `HTMLElement`, `customElements`,
// `window`) in that file marks it client-effecting and re-pins every importer.
// The one client helper, `onBeforeCache`, lives in `lib/dom.ts` instead.

const REG = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'registry');

/** Remove line + block comments so we only test real code tokens. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('registry lib/utils.ts is pure (no client globals, so cn() does not pin a page) (#819)', () => {
  const code = stripComments(readFileSync(join(REG, 'lib', 'utils.ts'), 'utf8'));
  for (const g of ['document', 'HTMLElement', 'customElements', 'window', 'defineElement', 'ServerHTMLElementStub']) {
    assert.ok(!new RegExp(`\\b${g}\\b`).test(code), `utils.ts must not reference the client global \`${g}\` (it would pin every page importing cn)`);
  }
  assert.ok(/export function cn\b/.test(code), 'utils.ts still exports cn');
});

test('registry lib/dom.ts holds onBeforeCache (the client-only helper) (#819)', () => {
  const dom = join(REG, 'lib', 'dom.ts');
  assert.ok(existsSync(dom), 'lib/dom.ts exists');
  assert.ok(/export function onBeforeCache\b/.test(readFileSync(dom, 'utf8')), 'dom.ts exports onBeforeCache');
});

test('no registry component imports onBeforeCache from ../lib/utils.ts (#819)', () => {
  const dir = join(REG, 'components');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    assert.ok(
      !/import\s*\{[^}]*\bonBeforeCache\b[^}]*\}\s*from\s*['"]\.\.\/lib\/utils\.ts['"]/.test(src),
      `${f} must import onBeforeCache from ../lib/dom.ts, not ../lib/utils.ts`,
    );
  }
});
