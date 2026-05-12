/**
 * Smoke tests for the v2 parity gaps closed across calendar / chart /
 * dropdown-menu / context-menu / menubar. We run the registry build first
 * (cheap — file IO + JSON.stringify) and then string-assert on the emitted
 * sources. That's enough to catch the obvious regressions (RTL flip
 * removed, gradient defs dropped, sibling-close handler reverted) without
 * spinning up a real DOM.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY = resolve(__dirname, '..', 'packages', 'registry');

/**
 * Read the component .ts source directly from `packages/registry/components/`.
 * The built `r/<name>.json` would also have these files inlined, but pointing
 * at the source avoids racing with other tests that rebuild the registry.
 */
function source(name) {
  return readFileSync(join(REGISTRY, 'components', `${name}.ts`), 'utf8');
}

/* -------------------- calendar — RTL -------------------- */

test('calendar: detects RTL via getComputedStyle + dir fallback', () => {
  const src = source('calendar');
  assert.match(src, /_isRtl\s*\(\s*\)/);
  assert.match(src, /getComputedStyle\(this\)\.direction/);
  assert.match(src, /getAttribute\('dir'\)\s*===\s*'rtl'/);
});

test('calendar: arrow keys swap horizontal direction in RTL', () => {
  const src = source('calendar');
  // Both ArrowLeft and ArrowRight branches consult the `rtl` flag.
  assert.match(src, /ArrowLeft[\s\S]*rtl\s*\?\s*1\s*:\s*-1/);
  assert.match(src, /ArrowRight[\s\S]*rtl\s*\?\s*-1\s*:\s*1/);
});

test('calendar: chevron buttons gain the rotate-180 flip class in RTL', () => {
  const src = source('calendar');
  // Header (year/decade view) renders chevronFlip = rtl ? 'rotate-180' : '';
  // and applies it to both prev + next buttons via cn(...).
  assert.match(src, /chevronFlip\s*=\s*rtl\s*\?\s*'rotate-180'\s*:\s*''/);
  assert.match(src, /data-chevron="prev"/);
  assert.match(src, /data-chevron="next"/);
});

/* -------------------- chart — gradients / brush / animation / axis -------------------- */

test('chart: gradient defs emitted via _renderDefs + linearGradient', () => {
  const src = source('chart');
  assert.match(src, /_renderDefs\s*\(\s*\)/);
  assert.match(src, /<linearGradient\s+id=\$\{id\}/);
  assert.match(src, /<defs>/);
  // Series-level `gradient: true` triggers a stop-opacity ramp.
  assert.match(src, /stop-opacity="0\.8"/);
  assert.match(src, /stop-opacity="0\.05"/);
});

test('chart: brush selection emits ui-chart-brush with start/end indices', () => {
  const src = source('chart');
  assert.match(src, /brush:\s*\{\s*type:\s*Boolean/);
  assert.match(src, /_renderBrush\s*\(\s*\)/);
  assert.match(src, /data-slot="chart-brush"/);
  assert.match(src, /new CustomEvent\('ui-chart-brush'/);
  // Drag handlers on left / right / window.
  assert.match(src, /data-brush-handle="left"/);
  assert.match(src, /data-brush-handle="right"/);
  assert.match(src, /_onBrushPointerDown/);
  assert.match(src, /startIndex.*endIndex/);
});

test('chart: visible-data subset drives axes + body when brush is active', () => {
  const src = source('chart');
  assert.match(src, /_visibleData\s*\(\s*\)/);
  // _yRange now reads from _visibleData() rather than this.data directly.
  assert.match(src, /const data = this\._visibleData\(\)/);
});

test('chart: animation transitions on data change (300ms ease)', () => {
  const src = source('chart');
  // Lines + areas transition path `d`; bars transition `y` + `height`.
  assert.match(src, /transition:\s*d\s+300ms\s+ease/);
  assert.match(src, /transition:\s*y\s+300ms\s+ease,\s*height\s+300ms\s+ease/);
  // Honour the `animate` prop (default true).
  assert.match(src, /animate:\s*\{\s*type:\s*Boolean/);
});

test('chart: secondary Y axis renders per-series axis pinning', () => {
  const src = source('chart');
  // Type sugar.
  assert.match(src, /axis\?:\s*'left'\s*\|\s*'right'/);
  assert.match(src, /_hasSecondaryAxis/);
  assert.match(src, /_yPosFor/);
  // Right-axis tick text class for visual identification.
  assert.match(src, /recharts-axis-right/);
  // Right-axis ticks rendered when present.
  assert.match(src, /recharts-cartesian-axis-y-right/);
});

/* -------------------- menus — cross-sibling submenu close -------------------- */

test('dropdown-menu: items + sub-triggers close sibling submenus on pointerenter', () => {
  const src = source('dropdown-menu');
  assert.match(src, /function closeSiblingSubmenus/);
  assert.match(src, /ui-dropdown-menu-sub\[open\]/);
  // Both Item and SubTrigger register the handler.
  const enterCount = (src.match(/closeSiblingSubmenus\(this\)/g) || []).length;
  assert.ok(enterCount >= 2, `expected ≥2 callers of closeSiblingSubmenus, got ${enterCount}`);
  assert.match(src, /'ui-dropdown-menu-sub-close'/);
});

test('context-menu: items + sub-triggers close sibling submenus on pointerenter', () => {
  const src = source('context-menu');
  assert.match(src, /function closeSiblingSubmenus/);
  assert.match(src, /ui-context-menu-sub\[open\]/);
  const enterCount = (src.match(/closeSiblingSubmenus\(this\)/g) || []).length;
  assert.ok(enterCount >= 2, `expected ≥2 callers of closeSiblingSubmenus, got ${enterCount}`);
  assert.match(src, /'ui-context-menu-sub-close'/);
});

test('menubar: items + sub-triggers close sibling submenus on pointerenter', () => {
  const src = source('menubar');
  assert.match(src, /function closeSiblingSubmenus/);
  assert.match(src, /ui-menubar-sub\[open\]/);
  const enterCount = (src.match(/closeSiblingSubmenus\(this\)/g) || []).length;
  assert.ok(enterCount >= 2, `expected ≥2 callers of closeSiblingSubmenus, got ${enterCount}`);
  assert.match(src, /'ui-menubar-sub-close'/);
});
