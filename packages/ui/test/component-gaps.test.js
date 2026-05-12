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

/* -------------------- scroll-area — custom scrollbar UI -------------------- */

test('scroll-area: renders vertical + horizontal thumbs with scrollbar tracks', () => {
  const src = source('scroll-area');
  assert.match(src, /data-slot="scroll-area-scrollbar"/);
  assert.match(src, /data-slot="scroll-area-thumb"/);
  assert.match(src, /data-orientation="vertical"/);
  assert.match(src, /data-orientation="horizontal"/);
  // Native scrollbars hidden.
  assert.match(src, /\[scrollbar-width:none\]/);
  assert.match(src, /::-webkit-scrollbar/);
});

test('scroll-area: thumb size + position derived from viewport/content ratio', () => {
  const src = source('scroll-area');
  // Size = (viewport / content) * track; position = (scroll / maxScroll) * (track - thumb)
  assert.match(src, /ratio\s*=\s*v\.clientHeight\s*\/\s*Math\.max\(v\.scrollHeight/);
  assert.match(src, /ratio\s*\*\s*track/);
  assert.match(src, /maxScroll\s*=\s*v\.scrollHeight\s*-\s*v\.clientHeight/);
});

test('scroll-area: thumbs are pointer-draggable', () => {
  const src = source('scroll-area');
  assert.match(src, /_onThumbDown/);
  assert.match(src, /_onThumbMove/);
  assert.match(src, /pointermove/);
  assert.match(src, /pointerup/);
});

test('scroll-area: type prop controls visibility (hover / always / auto / scroll)', () => {
  const src = source('scroll-area');
  assert.match(src, /type:\s*\{\s*type:\s*String/);
  assert.match(src, /this\.type\s*===\s*'always'/);
  assert.match(src, /group-hover\/scroll-area:opacity-100/);
});

/* -------------------- tooltip — provider delayDuration + skipDelay -------------------- */

test('tooltip: provider exposes delay-duration + skip-delay-duration attrs', () => {
  const src = source('tooltip');
  assert.match(src, /delayDuration:\s*\{[^}]*attribute:\s*'delay-duration'/);
  assert.match(src, /skipDelayDuration:\s*\{[^}]*attribute:\s*'skip-delay-duration'/);
});

test('tooltip: root reads delayDuration from nearest provider on connect', () => {
  const src = source('tooltip');
  assert.match(src, /closest\('ui-tooltip-provider'\)/);
  assert.match(src, /this\._delay\s*=\s*Number\(this\._provider\.delayDuration/);
});

test('tooltip: skip-delay window opens next tooltip instantly', () => {
  const src = source('tooltip');
  // delay = sinceLastClose < skipDelay ? 0 : configured delay
  assert.match(src, /sinceLastClose\s*<\s*this\._skipDelay/);
  assert.match(src, /_lastClosedAt/);
});

/* -------------------- navigation-menu — viewport + indicator -------------------- */

test('navigation-menu: teleports active content into the viewport', () => {
  const src = source('navigation-menu');
  assert.match(src, /_syncViewport/);
  assert.match(src, /viewportEl\.appendChild\(content\)/);
  // Previously-active content is returned to its original parent.
  assert.match(src, /_contentHome/);
});

test('navigation-menu: indicator slides to the active trigger center', () => {
  const src = source('navigation-menu');
  assert.match(src, /_syncIndicator/);
  assert.match(src, /trigger\.getBoundingClientRect\(\)/);
  assert.match(src, /transform\s*=\s*`translateX/);
  assert.match(src, /transition\s*=\s*'transform 250ms/);
});

test('navigation-menu: setOpen drives both viewport + indicator updates', () => {
  const src = source('navigation-menu');
  // _setOpen calls _syncViewport(target) and _syncIndicator(target).
  assert.match(src, /_setOpen\([\s\S]*?_syncViewport\(target\)[\s\S]*?_syncIndicator\(target\)/);
});

/* -------------------- input-otp — paste-to-fill -------------------- */

test('input-otp: slot input wires a paste handler that dispatches ui-otp-paste', () => {
  const src = source('input-otp');
  assert.match(src, /@paste=\$\{this\._onPaste\}/);
  assert.match(src, /clipboardData\?\.getData\('text'\)/);
  assert.match(src, /'ui-otp-paste'/);
});

test('input-otp: root spreads pasted chars across subsequent slots', () => {
  const src = source('input-otp');
  assert.match(src, /_onSlotPaste/);
  // Loops through pasted chars, writing into chars[writeAt++].
  assert.match(src, /for \(const c of pasted\)[\s\S]*chars\[writeAt\+\+\]\s*=\s*c/);
  // Focuses min(index + written, max - 1).
  assert.match(src, /Math\.min\(index\s*\+\s*written,\s*max\s*-\s*1\)/);
});

test('input-otp: numeric-only slots strip non-digits from paste', () => {
  const src = source('input-otp');
  assert.match(src, /numericOnly/);
  assert.match(src, /pasted\.replace\(\/\\D\/g,\s*''\)/);
  // Numeric detection looks at inputmode="numeric".
  assert.match(src, /getAttribute\('inputmode'\)\s*===\s*'numeric'/);
});

/* -------------------- form — nested keys / async / submitCount -------------------- */

test('form: ships path helpers for nested keys (getPath / setPath)', () => {
  const src = source('form');
  assert.match(src, /function getPath\(/);
  assert.match(src, /function setPath\(/);
  // Numeric path segments mint arrays so `addresses.0.street` works.
  assert.match(src, /nextIsIndex\s*=\s*\/\^\\d\+\$\/\.test\(nextKey\)/);
});

test('form: register accepts asyncValidate with 200ms debounce', () => {
  const src = source('form');
  assert.match(src, /asyncValidate\?:\s*\(value:\s*any\)\s*=>\s*Promise<string\s*\|\s*null\s*\|\s*undefined>/);
  // Debounce timer fires _runFieldAsync after 200ms.
  assert.match(src, /_runFieldAsync\(name\)/);
  assert.match(src, /\}, 200\);/);
  // Pending flag toggled while in flight.
  assert.match(src, /this\.pending\[name\]\s*=\s*true/);
});

test('form: handleSubmit increments submitCount and exposes the getter', () => {
  const src = source('form');
  assert.match(src, /get submitCount\(\): number/);
  assert.match(src, /this\._submitCount\s*\+=\s*1/);
});

test('form: field renders data-state="pending" when async validator in flight', () => {
  const src = source('form');
  assert.match(src, /fieldPending\s*\?\s*'pending'/);
  // Pending state lookups go via ctrl.pending[name].
  assert.match(src, /ctrl\.pending\[this\.name\]/);
});

/* -------------------- chart — pie / radial animation -------------------- */

test('chart: pie animates arc angles via rAF + ease-out cubic', () => {
  const src = source('chart');
  assert.match(src, /_animatePie\(/);
  assert.match(src, /_computePieArcs\(/);
  // The 1 - (1 - t)^3 ease-out cubic curve.
  assert.match(src, /1\s*-\s*Math\.pow\(1\s*-\s*t,\s*3\)/);
  assert.match(src, /const dur = 300;/);
  // In-flight animation is cancelled on new data.
  assert.match(src, /cancelAnimationFrame\(this\._animRaf\)/);
});

test('chart: radial animates pct values via requestAnimationFrame', () => {
  const src = source('chart');
  assert.match(src, /_animateRadial\(/);
  assert.match(src, /_computeRadialArcs\(/);
  assert.match(src, /_radialArcsFrame/);
});

/* -------------------- sonner — swipe / action / undo / dismiss -------------------- */

test('sonner: swipe-to-dismiss tracks pointer drag past 40% threshold', () => {
  const src = source('sonner');
  assert.match(src, /SWIPE_THRESHOLD\s*=\s*0\.4/);
  assert.match(src, /_onPointerDown\s*=/);
  assert.match(src, /_onPointerMove\s*=/);
  assert.match(src, /_onPointerUp\s*=/);
  assert.match(src, /_swipeAxis\(\)/);
});

test('sonner: renders action + cancel buttons when provided', () => {
  const src = source('sonner');
  assert.match(src, /data-button="action"/);
  assert.match(src, /data-button="cancel"/);
  assert.match(src, /_invokeAction\(/);
  assert.match(src, /export interface ToastAction/);
});

test('sonner: toast.dismiss(id?), toast.success/error/info/warning/message helpers', () => {
  const src = source('sonner');
  assert.match(src, /toastImpl\.dismiss\s*=/);
  assert.match(src, /toastImpl\.success\s*=/);
  assert.match(src, /toastImpl\.error\s*=/);
  assert.match(src, /toastImpl\.info\s*=/);
  assert.match(src, /toastImpl\.warning\s*=/);
  assert.match(src, /toastImpl\.message\s*=/);
  // Dismiss-all path.
  assert.match(src, /detail:\s*\{\s*all:\s*true\s*\}/);
});

/* -------------------- resizable — keyboard support -------------------- */

test('resizable handle: focusable separator with valuenow/valuemin/valuemax', () => {
  const src = source('resizable');
  assert.match(src, /tabindex="0"/);
  assert.match(src, /role="separator"/);
  assert.match(src, /aria-valuenow=/);
  assert.match(src, /aria-valuemin=/);
  assert.match(src, /aria-valuemax=/);
});

test('resizable handle: arrow keys resize by 1% (10% with shift)', () => {
  const src = source('resizable');
  assert.match(src, /const step = e\.shiftKey \? 10 : 1;/);
  assert.match(src, /case 'ArrowLeft':/);
  assert.match(src, /case 'ArrowRight':/);
  assert.match(src, /case 'ArrowUp':/);
  assert.match(src, /case 'ArrowDown':/);
});

test('resizable handle: Home/End collapse adjacent panels; Enter toggles', () => {
  const src = source('resizable');
  assert.match(src, /case 'Home':/);
  assert.match(src, /case 'End':/);
  assert.match(src, /case 'Enter':/);
  assert.match(src, /_collapsedSnapshot/);
});
