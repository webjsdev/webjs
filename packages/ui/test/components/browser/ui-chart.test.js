/**
 * Browser tests for `<ui-chart>` (#1666): the tooltip, cursor and active
 * dots the element adds over the server-rendered SVG, by pointer and by
 * keyboard. The suite loads no stylesheet, so these assert the tooltip's
 * `hidden` state and content, not its visibility on screen.
 */
import { render } from '../../../../core/src/render-client.js';

import { assert } from '../../../../../test/browser-assert.js';

const COMPONENTS_DIR = '/packages/ui/packages/registry/components';

const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

const MONTHS = [
  { month: 'January', desktop: 186 },
  { month: 'February', desktop: 305 },
  { month: 'March', desktop: 237 },
  { month: 'April', desktop: 73 },
];
const CONFIG = { desktop: { label: 'Desktop', color: 'red' } };

let chart;

async function mount(tpl) {
  const root = document.createElement('div');
  root.style.width = '450px';
  document.body.appendChild(root);
  render(tpl, root);
  await tick();
  return root;
}

/** Client coordinates of a viewBox point. */
function clientPoint(svg, x, y) {
  const m = svg.getScreenCTM();
  return { clientX: m.a * x + m.c * y + m.e, clientY: m.b * x + m.d * y + m.f };
}

function pointAt(root, i) {
  const svg = root.querySelector('svg.ui-chart-surface');
  const entry = root.querySelectorAll('[data-slot="chart-tooltips"] > [data-index]')[i];
  return { svg, ...clientPoint(svg, Number(entry.dataset.x), Number(entry.dataset.y)) };
}

const tooltip = (root) => root.querySelector('[data-slot="chart-tooltip"]');
const visibleGroups = (root, slot) => [...root.querySelectorAll(`[data-slot="${slot}"] > [data-index]`)]
  .filter((g) => g.getAttribute('visibility') === 'visible')
  .map((g) => g.getAttribute('data-index'));

suite('ui-chart', () => {
  suiteSetup(async () => {
    chart = await import(`${COMPONENTS_DIR}/chart.ts`);
  });

  test('a pointer move shows the nearest point\'s tooltip, cursor and dot; leaving hides them', async () => {
    const root = await mount(chart.lineChart({
      config: CONFIG, data: MONTHS, xAxis: { dataKey: 'month' }, tooltip: {},
      lines: [{ dataKey: 'desktop', stroke: 'var(--color-desktop)' }],
    }));
    const el = root.querySelector('ui-chart');
    assert.ok(tooltip(root).hidden, 'hidden before any interaction');
    const { svg, clientX, clientY } = pointAt(root, 2);
    svg.dispatchEvent(new PointerEvent('pointermove', { clientX: clientX + 3, clientY, bubbles: true }));
    await tick();
    assert.equal(tooltip(root).hidden, false);
    assert.ok(tooltip(root).textContent.includes('March'), 'the category is the label');
    assert.ok(tooltip(root).textContent.includes('Desktop'), 'the series is named from the config');
    assert.ok(tooltip(root).textContent.includes('237'));
    assert.equal(el.activeIndex, 2);
    assert.deepEqual(visibleGroups(root, 'chart-cursor'), ['2']);
    assert.deepEqual(visibleGroups(root, 'chart-active'), ['2']);
    assert.match(tooltip(root).style.transform, /^translate\(/);
    el.dispatchEvent(new PointerEvent('pointerleave'));
    await tick();
    assert.equal(tooltip(root).hidden, true);
    assert.deepEqual(visibleGroups(root, 'chart-active'), []);
    root.remove();
  });

  test('the chart takes focus and the arrow keys step through the points', async () => {
    const root = await mount(chart.barChart({
      config: CONFIG, data: MONTHS, xAxis: { dataKey: 'month' }, tooltip: { cursor: false },
      bars: [{ dataKey: 'desktop', fill: 'var(--color-desktop)' }],
    }));
    const svg = root.querySelector('svg.ui-chart-surface');
    assert.equal(svg.getAttribute('tabindex'), '0', 'focusable once upgraded');
    assert.equal(svg.getAttribute('role'), 'application');
    svg.focus();
    await tick();
    assert.equal(tooltip(root).hidden, false, 'focus shows the first point');
    assert.ok(tooltip(root).textContent.includes('January'));
    const live = root.querySelector('[data-slot="chart-live"]');
    assert.ok(live.textContent.includes('January') && live.textContent.includes('186'), 'announced');
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await tick();
    assert.ok(tooltip(root).textContent.includes('February'));
    assert.ok(live.textContent.includes('305'));
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await tick();
    assert.ok(tooltip(root).textContent.includes('April'));
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await tick();
    assert.ok(tooltip(root).textContent.includes('April'), 'stops at the last point');
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await tick();
    assert.equal(tooltip(root).hidden, true, 'Escape hides');
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    await tick();
    assert.equal(tooltip(root).hidden, false);
    svg.blur();
    await tick();
    assert.equal(tooltip(root).hidden, true, 'blur hides');
    root.remove();
  });

  test('a pie shows the hovered slice', async () => {
    const root = await mount(chart.pieChart({
      config: { chrome: { label: 'Chrome' }, safari: { label: 'Safari' } },
      data: [{ browser: 'chrome', visitors: 275, fill: 'red' }, { browser: 'safari', visitors: 200, fill: 'blue' }],
      tooltip: { hideLabel: true },
      pies: [{ dataKey: 'visitors', nameKey: 'browser' }],
    }));
    const sector = root.querySelectorAll('.ui-chart-pie-sector')[1].querySelector('path');
    const r = sector.getBoundingClientRect();
    sector.dispatchEvent(new PointerEvent('pointermove', { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true }));
    await tick();
    assert.equal(tooltip(root).hidden, false);
    assert.ok(tooltip(root).textContent.includes('Safari'));
    assert.ok(tooltip(root).textContent.includes('200'));
    root.remove();
  });

  test('the labels keep their size and the axis thins them by their real widths', async () => {
    const days = Array.from({ length: 30 }, (_, i) => ({ day: `April ${i + 1}`, v: i % 7 }));
    const root = await mount(chart.lineChart({
      config: CONFIG, data: days, xAxis: { dataKey: 'day', minTickGap: 8 },
      lines: [{ dataKey: 'v', dot: false }],
    }));
    root.style.width = '300px';
    await new Promise((r) => setTimeout(r, 120));
    const el = root.querySelector('ui-chart');
    const k = parseFloat(root.querySelector('svg').style.fontSize);
    assert.ok(k > 1.4, `the chart is drawn smaller than its viewBox, so the labels are counter-scaled (k ${k})`);
    const shown = [...root.querySelectorAll('.ui-chart-cartesian-axis-tick')].filter((g) => g.getAttribute('visibility') !== 'hidden');
    assert.ok(shown.length > 1 && shown.length < 30, `${shown.length} of 30 labels fit`);
    const boxes = shown.map((g) => g.querySelector('text').getBoundingClientRect()).sort((a, b) => a.left - b.left);
    for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i].left >= boxes[i - 1].right, 'no two shown labels overlap');
    // The suite loads no stylesheet, so the inherited size is the 16px default:
    // a label drawn at it, not shrunk with the chart, is about 16 to 20px tall.
    assert.ok(boxes[0].height >= 14 && boxes[0].height <= 24, `a label renders at its font size (${boxes[0].height}px)`);
    root.remove();
  });

  test('a wide chart in a narrow box of another shape fills it instead of letterboxing', async () => {
    const days = Array.from({ length: 90 }, (_, i) => ({ day: `Day ${i + 1}`, v: (i * 37) % 100 }));
    const root = await mount(chart.areaChart({
      config: CONFIG, data: days, width: 1260, height: 250, tooltip: {},
      xAxis: { dataKey: 'day', minTickGap: 32 },
      areas: [{ dataKey: 'v', fill: 'red', stroke: 'red' }],
    }));
    // The suite has no stylesheet: give the SVG the box `aspect-auto h-[250px] w-full` would.
    const svg = root.querySelector('svg.ui-chart-surface');
    svg.style.cssText += 'display:block;width:100%;height:250px';
    root.style.width = '300px';
    await new Promise((r) => setTimeout(r, 150));
    const [, , w, h] = svg.getAttribute('viewBox').split(' ').map(Number);
    assert.ok(Math.abs(w - 300) < 1 && h === 250, `the viewBox takes the box's shape (${w} by ${h})`);
    const box = svg.getBoundingClientRect();
    const area = svg.querySelector('.ui-chart-area').getBoundingClientRect();
    assert.ok(area.width > 250 && area.height > 100, `the marks fill the box (${Math.round(area.width)} by ${Math.round(area.height)})`);
    assert.ok(area.right <= box.right + 1, 'and stay inside it');
    const xs = [...root.querySelectorAll('[data-slot="chart-tooltips"] > [data-index]')].map((e) => Number(e.dataset.x));
    assert.ok(xs[0] >= 0 && xs[89] <= w, `the tooltip anchors move with the plot (${xs[0]} to ${xs[89]})`);
    const shown = [...root.querySelectorAll('[data-axis="x"] [data-coord]')].filter((g) => g.getAttribute('visibility') !== 'hidden');
    assert.ok(shown.length >= 2 && shown.length <= 6, `the x axis is thinned for the narrow width (${shown.length} labels)`);
    // A pointer at the right edge of the plot reaches the last point.
    const { clientX, clientY } = clientPoint(svg, xs[89], 120);
    svg.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, bubbles: true }));
    await tick();
    assert.equal(root.querySelector('ui-chart').activeIndex, 89);
    // Widening the box again restores the served layout.
    root.style.width = '1260px';
    await new Promise((r) => setTimeout(r, 150));
    assert.ok(Math.abs(Number(svg.getAttribute('viewBox').split(' ')[2]) - 1260) < 1, 'back at the nominal width');
    root.remove();
  });

  test('a dot keeps its radius in pixels however the chart scales', async () => {
    const root = await mount(chart.lineChart({
      config: CONFIG, data: MONTHS, xAxis: { dataKey: 'month' },
      lines: [{ dataKey: 'desktop', stroke: 'red', dot: { r: 4 } }],
    }));
    for (const width of ['225px', '900px']) {
      root.style.width = width;
      await new Promise((r) => setTimeout(r, 150));
      const d = root.querySelector('circle.ui-chart-dot').getBoundingClientRect();
      assert.ok(Math.abs(d.width - 8) < 1.5 && Math.abs(d.height - 8) < 1.5, `an r 4 dot is 8px across at ${width} (${d.width} by ${d.height})`);
    }
    root.remove();
  });

  test('a tooltip that would leave the plot area opens above and to the left of its point', async () => {
    const root = await mount(chart.barChart({
      config: CONFIG, data: MONTHS, xAxis: { dataKey: 'month' }, tooltip: {},
      bars: [{ dataKey: 'desktop', fill: 'var(--color-desktop)' }],
    }));
    const { svg, clientX } = pointAt(root, 3);
    const box = svg.getBoundingClientRect();
    svg.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY: box.bottom - 40, bubbles: true }));
    await tick();
    // The suite has no stylesheet, so read the translate the element chose
    // rather than where an unpositioned box lands.
    const el = tooltip(root);
    const [tx, ty] = el.style.transform.match(/-?[\d.]+/g).map(Number);
    const [x, y, w, h] = svg.dataset.plot.split(' ').map(Number);
    const m = svg.getScreenCTM();
    const wrap = svg.parentElement.getBoundingClientRect();
    const bottom = m.d * (y + h) + m.f - wrap.top;
    const pointerY = box.bottom - 40 - wrap.top;
    assert.ok(ty + el.offsetHeight <= bottom + 1, `stays above the plot bottom (${ty} + ${el.offsetHeight} vs ${bottom})`);
    assert.ok(ty < pointerY, 'so it opens above the pointer');
    // (Across is not checked: with no stylesheet the tooltip box is a full-width block.)
    assert.ok(tx >= m.a * x + m.e - wrap.left - 1, 'it never starts left of the plot');
    root.remove();
  });

  test('a defaultIndex is showing from the start', async () => {
    const root = await mount(chart.barChart({
      config: CONFIG, data: MONTHS, tooltip: { defaultIndex: 1 },
      bars: [{ dataKey: 'desktop', fill: 'var(--color-desktop)' }],
    }));
    await tick();
    assert.equal(tooltip(root).hidden, false);
    assert.ok(tooltip(root).textContent.includes('305'));
    assert.deepEqual(visibleGroups(root, 'chart-cursor'), ['1']);
    assert.equal(root.querySelector('ui-chart').activeIndex, 1);
    root.remove();
  });
});
