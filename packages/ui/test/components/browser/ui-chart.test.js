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
