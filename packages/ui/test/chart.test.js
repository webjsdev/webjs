/**
 * The chart's geometry and its server render (#1666, D10, D11).
 *
 * chart.ts ports the parts of Recharts the shadcn charts use, so the
 * expected values here are what Recharts 3.8 drew for the same input,
 * read off shadcn's own chart pages (chart-area-default, chart-bar-default,
 * chart-pie-donut-text, chart-radar-default, chart-radial-simple at 450 by
 * 253 and 250 square). A drift in any scale, curve or shape shows up as a
 * changed path string.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const c = await import(join(HERE, '..', 'packages', 'registry', 'components', 'chart.ts'));
const { renderToString } = await import('@webjsdev/core/server');
const ssr = (tpl) => renderToString(tpl, { ssr: false });

const MONTHS = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'June', desktop: 214, mobile: 140 },
];
const CONFIG = {
  desktop: { label: 'Desktop', color: 'var(--chart-1)' },
  mobile: { label: 'Mobile', theme: { light: 'oklch(0.5 0.1 250)', dark: 'oklch(0.8 0.1 250)' } },
};
const BROWSERS = [
  { browser: 'chrome', visitors: 275, fill: 'var(--color-chrome)' },
  { browser: 'safari', visitors: 200, fill: 'var(--color-safari)' },
  { browser: 'firefox', visitors: 287, fill: 'var(--color-firefox)' },
  { browser: 'edge', visitors: 173, fill: 'var(--color-edge)' },
  { browser: 'other', visitors: 190, fill: 'var(--color-other)' },
];
const BROWSER_CONFIG = { visitors: { label: 'Visitors' }, chrome: { label: 'Chrome', color: 'var(--chart-1)' } };

test('niceTicks matches Recharts getNiceTickValues', () => {
  assert.deepEqual(c.niceTicks(0, 305), [0, 80, 160, 240, 320], 'the area and bar charts\' y axis');
  assert.deepEqual(c.niceTicks(0, 950), [0, 250, 500, 750, 1000], 'a stacked total');
  assert.deepEqual(c.niceTicks(-123, 305), [-150, 0, 150, 300, 450], 'zero stays a tick across a negative range');
  assert.deepEqual(c.niceTicks(0, 1), [0, 0.25, 0.5, 0.75, 1], 'stackOffset expand, no float noise');
  assert.deepEqual(c.niceTicks(0, 454, 3), [0, 250, 500], 'tickCount 3');
  assert.deepEqual(c.niceTicks(5, 5), [3, 4, 5, 6, 7], 'a single value centres the ticks on it');
});

test('scales: linear, band and point', () => {
  const y = c.linearScale([0, 320], [223, 0]);
  assert.equal(y(160), 111.5);
  assert.equal(y(0), 223);
  const b = c.bandScale(6, 5, 445);
  assert.equal(b.bandwidth, 440 / 6);
  assert.equal(b.at(1), 5 + 440 / 6);
  const p = c.pointScale(6, 12, 438);
  assert.equal(p(0), 12);
  assert.equal(p(5), 438);
  assert.equal(c.pointScale(1, 0, 10)(0), 5, 'one point sits in the middle');
});

test('barPositions: a 10% category gap and Recharts\' truncated size', () => {
  assert.deepEqual(c.barPositions(440 / 6, [{}]), [{ offset: 44 / 6, size: 58 }]);
  assert.deepEqual(c.barPositions(100, [{}, {}]), [{ offset: 10, size: 38 }, { offset: 52, size: 38 }], 'two bars 4 apart');
  assert.deepEqual(c.barPositions(100, [{ barSize: 20 }]), [{ offset: 40, size: 20 }], 'a fixed bar size is centred');
});

test('curvePath: each curve type', () => {
  const pts = [[12, 93.3813], [97.2, 10.4531], [182.4, 57.8406], [267.6, 172.1281], [352.8, 77.3531], [438, 73.8688]];
  assert.equal(
    c.curvePath(pts, 'natural'),
    'M12,93.381C40.4,57.179,68.8,20.977,97.2,10.453C125.6,-0.071,154,15.082,182.4,57.841C210.8,100.599,239.2,170.962,267.6,172.128C296,173.294,324.4,105.263,352.8,77.353C381.2,49.444,409.6,61.656,438,73.869',
    'Recharts\' natural area on chart-area-default',
  );
  assert.equal(c.curvePath([[0, 0], [1, 1], [2, 0]], 'linear'), 'M0,0L1,1L2,0');
  assert.equal(c.curvePath([[0, 0], [1, 1], [2, 0]], 'monotone'), 'M0,0C0.333,0.5,0.667,1,1,1C1.333,1,1.667,0.5,2,0', 'a flat tangent at the peak');
  assert.equal(c.curvePath([[0, 0], [2, 1], [4, 0]], 'step'), 'M0,0L1,0L1,1L3,1L3,0L4,0');
  assert.equal(c.curvePath([[0, 0], [2, 1]], 'stepBefore'), 'M0,0L0,1L2,1');
  assert.equal(c.curvePath([[0, 0], [2, 1]], 'stepAfter'), 'M0,0L2,0L2,1');
  assert.equal(c.curvePath([[1, 2], [3, 4]], 'linear', 'L'), 'L1,2L3,4', 'an area baseline continues the path');
});

test('rectanglePath: a rounded bar, partial corners, and a plain one', () => {
  assert.equal(
    c.rectanglePath(5 + 44 / 6, 218 - (186 / 320) * 213, 58, (186 / 320) * 213, 8),
    'M12.3333,102.1938A 8,8,0,0,1,20.3333,94.1938L 62.3333,94.1938A 8,8,0,0,1,70.3333,102.1938L 70.3333,210A 8,8,0,0,1,62.3333,218L 20.3333,218A 8,8,0,0,1,12.3333,210Z',
    'chart-bar-default\'s January bar',
  );
  assert.match(c.rectanglePath(0, 0, 10, 20, [4, 4, 0, 0]), /^M0,4A 4,4,0,0,1,4,0L 6,0A 4,4,0,0,1,10,4L 10,20L 0,20Z$/, 'only the top corners round');
  assert.equal(c.rectanglePath(0, 0, 10, 20), 'M 0,0 h 10 v 20 h -10 Z');
  assert.match(c.rectanglePath(0, 0, 10, 4, 8), /A 2,2/, 'the radius is capped at half the short side');
});

test('sectorPath and polygonPath: pie, radial and radar geometry', () => {
  assert.equal(
    c.sectorPath({ cx: 125, cy: 125, innerRadius: 60, outerRadius: 96, startAngle: 0, endAngle: 360 * 275 / 1125 }),
    'M 221,125 A 96,96,0,0,0,128.3504,29.0585 L 127.094,65.0366 A 60,60,0,0,1,185,125 Z',
    'chart-pie-donut-text\'s first slice',
  );
  assert.equal(
    c.sectorPath({ cx: 125, cy: 125, innerRadius: 31.6, outerRadius: 43.6, startAngle: 0, endAngle: 360 }),
    'M 168.6,125 A 43.6,43.6,0,1,0,168.6,125.0008 L 156.6,125.0006 A 31.6,31.6,0,1,1,156.6,125 Z',
    'a full ring stops just short of closing, as Recharts\' does',
  );
  assert.match(c.sectorPath({ cx: 0, cy: 0, innerRadius: 0, outerRadius: 10, startAngle: 0, endAngle: 90 }), /L 0,0 Z$/, 'a pie slice closes on the centre');
  assert.match(c.sectorPath({ cx: 0, cy: 0, innerRadius: 5, outerRadius: 20, startAngle: 0, endAngle: 90, cornerRadius: 3 }), /A3,3/, 'rounded corners');
  const p = c.polarToCartesian(125, 125, 96, 90);
  assert.equal(Math.round(p.x * 1e4) / 1e4, 125);
  assert.equal(p.y, 29);
  assert.equal(c.polygonPath([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]), 'M0,0L1,0L0,1L0,0Z');
});

test('stackData: sums, sign and expand', () => {
  assert.deepEqual(c.stackData([{ a: 1, b: 3 }, { a: 2, b: 2 }], ['a', 'b']), { a: [[0, 1], [0, 2]], b: [[1, 4], [2, 4]] });
  assert.deepEqual(c.stackData([{ a: -2, b: 2 }], ['a', 'b'], 'sign'), { a: [[-2, 0]], b: [[0, 2]] }, 'a negative stacks down from zero');
  assert.deepEqual(c.stackData([{ a: 1, b: 3 }], ['a', 'b'], 'expand'), { a: [[0, 0.25]], b: [[0.25, 1]] });
});

test('visibleTicks keeps the last label and drops the crowded ones', () => {
  const ticks = Array.from({ length: 10 }, (_, i) => ({ value: i, label: `Apr ${i + 1}`, coord: 20 + i * 30 }));
  const shown = c.visibleTicks(ticks, () => 30, 0, 320, 5);
  assert.equal(shown.at(-1).value, 9, 'preserveEnd');
  assert.ok(shown.length < ticks.length && shown.length >= 4, `${shown.length} of 10 fit`);
  assert.deepEqual(c.visibleTicks(ticks, () => 1, 0, 320, 5, 2).map((t) => t.value), [0, 3, 6, 9], 'interval 2 keeps every third');
});

test('chartStyle: one variable per colour, a theme pair as light-dark()', () => {
  assert.equal(c.chartStyle(CONFIG), '--color-desktop: var(--chart-1); --color-mobile: light-dark(oklch(0.5 0.1 250), oklch(0.8 0.1 250));');
  assert.equal(c.chartStyle({ visitors: { label: 'Visitors' } }), '', 'a label-only entry adds nothing');
});

test('chartTooltipContent: label from the category, names from the config', async () => {
  const datum = MONTHS[1];
  const payload = [
    { dataKey: 'desktop', name: 'desktop', value: 305, color: 'var(--color-desktop)', payload: datum },
    { dataKey: 'mobile', name: 'mobile', value: 1200, color: 'var(--color-mobile)', payload: datum },
  ];
  const out = await ssr(c.chartTooltipContent(CONFIG, 'February', payload));
  assert.match(out, /cn-chart-tooltip/);
  assert.match(out, /<div class="font-medium">February<\/div>/);
  assert.match(out, /Desktop<\/span>/);
  assert.match(out, /1,200<\/span>/, 'a number is grouped');
  assert.match(out, /--color-bg: var\(--color-desktop\)/);
  const hidden = await ssr(c.chartTooltipContent(CONFIG, 'February', payload, { hideLabel: true, indicator: 'line' }));
  assert.doesNotMatch(hidden, /font-medium">February/);
  assert.match(hidden, /w-1/);
  const formatted = await ssr(c.chartTooltipContent(CONFIG, 'February', payload, { labelFormatter: (v) => `Month: ${v}` }));
  assert.match(formatted, /Month: February/);
});

test('barChart renders the bars, axis and grid, with the colours on the container', async () => {
  const out = await ssr(c.barChart({
    config: CONFIG, data: MONTHS, title: 'Visitors', grid: { vertical: false },
    xAxis: { dataKey: 'month', tickLine: false, axisLine: false, tickMargin: 10, tickFormatter: (v) => String(v).slice(0, 3) },
    tooltip: { cursor: false, hideLabel: true },
    bars: [{ dataKey: 'desktop', fill: 'var(--color-desktop)', radius: 8 }],
  }));
  assert.match(out, /^<ui-chart data-slot="chart"/);
  assert.match(out, /style="--color-desktop: var\(--chart-1\); --color-mobile: light-dark\(/);
  assert.match(out, /<svg class="ui-chart-surface[^"]*"[^>]*viewBox="0 0 450 253" role="img" aria-label="Visitors"/);
  assert.equal(out.match(/class="ui-chart-rectangle"/g).length, 6);
  assert.match(out, /d="M12.3333,102.1938A 8,8/, 'the first bar where Recharts draws it');
  assert.equal(out.match(/ui-chart-cartesian-axis-tick-value/g).length, 6);
  assert.match(out, /<text x="41.6667" y="234"[^>]*><tspan x="41.6667" dy="0.71em">Jan<\/tspan>/);
  assert.equal(out.match(/<line stroke="#ccc"/g).length, 5, 'five horizontal grid lines, no vertical');
  assert.equal(out.match(/data-slot="chart-tooltips" hidden/g).length, 1);
  assert.equal(out.match(/<div data-index="\d"[^>]*data-tip=/g).length, 6, 'one served tooltip per point, as data');
  assert.match(out, /data-slot="chart-tooltip"[^>]* hidden/, 'no tooltip showing without a defaultIndex');
});

test('barChart stacks, and a defaultIndex serves its tooltip visible', async () => {
  const out = await ssr(c.barChart({
    config: CONFIG, data: MONTHS, xAxis: { dataKey: 'month' }, tooltip: { cursor: false, defaultIndex: 1 },
    bars: [
      { dataKey: 'desktop', stackId: 'a', fill: 'var(--color-desktop)', radius: [0, 0, 4, 4] },
      { dataKey: 'mobile', stackId: 'a', fill: 'var(--color-mobile)', radius: [4, 4, 0, 0] },
    ],
  }));
  assert.equal(out.match(/class="ui-chart-rectangle"/g).length, 12);
  assert.match(out, /data-default-index="1"/);
  const tip = out.match(/<div data-slot="chart-tooltip"[^>]*>/)[0];
  assert.doesNotMatch(tip, / hidden/);
  assert.match(tip, /transform: translate\(/);
  assert.match(out, /data-slot="chart-tooltip"[^>]*><div class="cn-chart-tooltip/, 'the default point\'s content is in the first paint');
});

test('areaChart and lineChart: curves, dots and active dots per point', async () => {
  const area = await ssr(c.areaChart({
    config: CONFIG, data: MONTHS, margin: { left: 12, right: 12 }, grid: { vertical: false },
    xAxis: { dataKey: 'month', tickLine: false, axisLine: false, tickMargin: 8 },
    tooltip: { cursor: false, indicator: 'line' },
    areas: [{ dataKey: 'desktop', type: 'natural', fill: 'var(--color-desktop)', fillOpacity: 0.4, stroke: 'var(--color-desktop)' }],
  }));
  assert.match(area, /class="ui-chart-curve ui-chart-area-area" fill="var\(--color-desktop\)" fill-opacity="0.4"/);
  assert.match(area, /d="M12,93.381C40.4,57.179/, 'Recharts\' natural curve');
  assert.match(area, /L438,223C409.6,223/, 'the baseline continues the path back');
  assert.equal(area.match(/ui-chart-active-dot/g).length, 6, 'one hidden active dot per point');
  assert.equal(area.split('data-slot="chart-active"')[1].match(/visibility="hidden"/g).length, 6);
  assert.equal(area.match(/class="ui-chart-layer ui-chart-cartesian-axis-tick" data-coord=/g).length, 6, 'every tick is served, for the element to thin with real widths');
  assert.match(area, /data-axis="x" data-gap="5" data-interval="preserveEnd" data-extent="450"/);
  const line = await ssr(c.lineChart({
    config: CONFIG, data: MONTHS, xAxis: { dataKey: 'month' }, tooltip: {},
    lines: [{ dataKey: 'desktop', type: 'monotone', stroke: 'var(--color-desktop)', strokeWidth: 2, dot: { fill: 'var(--color-desktop)' } }],
  }));
  assert.match(line, /class="ui-chart-curve ui-chart-line-curve" fill="none" stroke="var\(--color-desktop\)" stroke-width="2"/);
  assert.equal(line.match(/ui-chart-line-dot/g).length, 6, 'dots on every point');
  assert.equal(line.match(/class="ui-chart-curve ui-chart-tooltip-cursor"/g).length, 6, 'a cursor line per point');
});

test('stackOffset expand puts every stack on 0..1', async () => {
  const out = await ssr(c.areaChart({
    config: CONFIG, data: MONTHS, stackOffset: 'expand', margin: { top: 0, left: 0, right: 0, bottom: 0 },
    areas: [{ dataKey: 'desktop', stackId: 'a' }, { dataKey: 'mobile', stackId: 'a' }],
  }));
  const tops = [...out.matchAll(/ui-chart-area-curve"[^>]*d="M[\d.]+,([\d.]+)/g)].map((m) => Number(m[1]));
  assert.equal(tops[1], 0, 'the top series reaches the top of the plot on every row');
});

test('pieChart: Recharts\' donut slices, a centre label and per-slice tooltips', async () => {
  const out = await ssr(c.pieChart({
    config: BROWSER_CONFIG, data: BROWSERS, tooltip: { hideLabel: true },
    pies: [{ dataKey: 'visitors', nameKey: 'browser', innerRadius: 60, strokeWidth: 5, center: ({ cx, cy }) => c.chartText(cx, cy, 'Total') }],
  }));
  assert.match(out, /viewBox="0 0 250 250"/);
  assert.equal(out.match(/class="ui-chart-sector"/g).length, 5);
  assert.match(out, /d="M 221,125 A 96,96,0,0,0,128.3504,29.0585 L 127.094,65.0366 A 60,60,0,0,1,185,125 Z"/);
  assert.match(out, /stroke="#fff" stroke-width="5"/);
  assert.match(out, /data-hit="target"/);
  assert.match(out, />Total<\/tspan>/);
  assert.match(out, /data-tip="\{&quot;label&quot;:&quot;&quot;,&quot;items&quot;:\[\{&quot;name&quot;:&quot;Chrome&quot;,&quot;value&quot;:&quot;275&quot;/, 'each point is served as data, the name from the config');
  assert.doesNotMatch(out.split('data-slot="chart-tooltips"')[1], /cn-chart-tooltip/, 'with no markup per point');
});

test('pieChart labels: outside text with a line, and a label list inside', async () => {
  const out = await ssr(c.pieChart({
    config: BROWSER_CONFIG, data: BROWSERS,
    pies: [{ dataKey: 'visitors', nameKey: 'browser', label: true, labels: [{ dataKey: 'browser', class: 'fill-background' }] }],
  }));
  assert.equal(out.match(/ui-chart-pie-label-text/g).length, 5);
  assert.equal(out.match(/ui-chart-pie-label-line/g).length, 5);
  assert.equal(out.match(/ui-chart-label fill-background/g).length, 5);
});

test('radarChart: polygon grid, angle labels and the radar shape', async () => {
  const data = MONTHS.map((m) => (m.month === 'April' ? { ...m, desktop: 273 } : m));
  const out = await ssr(c.radarChart({
    config: CONFIG, data, tooltip: {}, angleAxis: { dataKey: 'month' }, grid: {},
    radars: [{ dataKey: 'desktop', fill: 'var(--color-desktop)', fillOpacity: 0.6, dot: { r: 4 } }],
  }));
  assert.equal(out.match(/ui-chart-polar-grid-concentric-polygon/g).length, 5);
  assert.match(out, /d="M125,69.2L204.2413,79.25L186.5744,160.55L125,206.9L70.7002,156.35L69.4012,92.9L125,69.2Z"/, 'Recharts\' radar');
  assert.match(out, /<text x="125" y="21" text-anchor="middle"[^>]*><tspan x="125" dy="0em">January/);
  assert.match(out, /text-anchor="start"[^>]*><tspan x="215.0666" dy="0.355em">February/);
  assert.equal(out.match(/ui-chart-radar-dot"/g).length, 6);
  const circle = await ssr(c.radarChart({ config: CONFIG, data, grid: { gridType: 'circle', radialLines: false }, radars: [{ dataKey: 'desktop' }] }));
  assert.equal(circle.match(/ui-chart-polar-grid-concentric-circle/g).length, 5);
  assert.doesNotMatch(circle, /ui-chart-polar-grid-angle/);
});

test('radialBarChart: banded rings over a background', async () => {
  const data = BROWSERS.map((b, i) => ({ ...b, visitors: [275, 200, 187, 173, 90][i] }));
  const out = await ssr(c.radialBarChart({
    config: BROWSER_CONFIG, data, innerRadius: 30, outerRadius: 110, tooltip: { hideLabel: true, nameKey: 'browser' },
    bars: [{ dataKey: 'visitors', background: true, labels: [{ position: 'insideStart', dataKey: 'browser' }] }],
  }));
  assert.equal(out.match(/class="ui-chart-sector ui-chart-radial-bar-background-sector"/g).length, 5);
  assert.match(out, /d="M 232.6,125 A 107.6,107.6,0,0,0,74.7866,29.835 L 80.3866,40.4482 A 95.6,95.6,0,0,1,220.6,125 Z"/, 'the outer ring, 90 of 275');
  assert.equal(out.match(/<textPath/g).length, 5, 'insideStart labels follow the ring');
});

test('a legend renders the series from the config, as an HTML row over the chart', async () => {
  const out = await ssr(c.barChart({
    config: CONFIG, data: MONTHS, legend: {},
    bars: [{ dataKey: 'desktop', fill: 'var(--color-desktop)' }, { dataKey: 'mobile', fill: 'var(--color-mobile)' }],
  }));
  // An HTML row after the svg, anchored at the bottom margin (5px of 253).
  assert.match(out, /<\/svg><div class="ui-chart-legend-wrapper absolute" style="left: [\d.]+%; right: [\d.]+%; bottom: 1\.9763%">/);
  assert.doesNotMatch(out, /foreignObject/);
  assert.match(out, /background-color: var\(--color-desktop\)"><\/div>Desktop/);
  assert.match(out, />Mobile<\/div>/);
});

test('a reversed category axis runs the rows from the far end', async () => {
  const opts = (reversed) => ({
    config: CONFIG, data: MONTHS, xAxis: { dataKey: 'month', reversed },
    bars: [{ dataKey: 'desktop', fill: 'var(--color-desktop)' }],
  });
  const xs = (out) => [...out.matchAll(/data-coord="([\d.]+)"/g)].map((m) => Number(m[1]));
  const ltr = xs(await ssr(c.barChart(opts(false))));
  const rtl = xs(await ssr(c.barChart(opts(true))));
  assert.equal(rtl.length, MONTHS.length);
  assert.ok(ltr[0] < ltr[ltr.length - 1], 'January is on the left by default');
  assert.deepEqual(rtl, [...ltr].reverse(), 'reversed puts January on the right');
});

test('an authored aspect ratio replaces the default one', async () => {
  const out = await ssr(c.pieChart({ config: BROWSER_CONFIG, data: BROWSERS, class: 'mx-auto aspect-square', pies: [{ dataKey: 'visitors' }] }));
  assert.doesNotMatch(out, /aspect-video/);
  assert.match(out, /aspect-square/);
});

test('linearTicks steps by 1, 2 or 5 times a power of ten, as d3 does', () => {
  assert.deepEqual(c.linearTicks(0, 275), [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260], 'the radial grid spokes');
  assert.deepEqual(c.linearTicks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
});

test('a label takes its bar\'s colour, sizes in em of the chart text, and a tooltip opens where Recharts\' does', async () => {
  const data = MONTHS.map((m, i) => ({ ...m, fill: i % 2 ? 'red' : 'blue' }));
  const out = await ssr(c.barChart({
    config: CONFIG, data, xAxis: { dataKey: 'month' }, tooltip: { defaultIndex: 1 },
    bars: [{ dataKey: 'desktop', labels: [{ position: 'top', fontSize: 12 }, { position: 'center', fill: 'white', fontSize: 9 }] }],
  }));
  assert.match(out, /<text x="[\d.]+" y="[\d.]+" text-anchor="middle" fill="blue"[^>]*font-size="1em"/, 'the first label is the bar\'s colour at 12px');
  assert.match(out, /fill="white"[^>]*font-size="0.75em"/, 'a named colour wins');
  assert.match(out, /data-plot="5 5 440 213"/, 'the plot area the tooltip stays inside');
  assert.match(out, /<div data-index="1" data-x="115" data-y="129"/, 'the band centre, halfway down from the plot top to the chart bottom');
});

test('a tooltip with a custom row or an icon is served as markup', async () => {
  const out = await ssr(c.barChart({
    config: { ...CONFIG, mobile: { label: 'Mobile', icon: () => c.chartText(0, 0, 'i') } },
    data: MONTHS, tooltip: { formatter: (v) => `${v} kcal` },
    bars: [{ dataKey: 'desktop' }, { dataKey: 'mobile' }],
  }));
  assert.doesNotMatch(out, /data-tip=/);
  assert.match(out, /<div data-index="0"[^>]*><div class="cn-chart-tooltip/);
  assert.match(out, /186 kcal/);
});

test('add chart-area-interactive installs the block with its kit, and the page renders three ranges', async () => {
  const { mkdirSync, writeFileSync, existsSync, rmSync } = await import('node:fs');
  const { pathToFileURL } = await import('node:url');
  const { add } = await import('../src/commands/add.js');
  const d = join(HERE, '.baked', `chart-block-${process.pid}`);
  rmSync(d, { recursive: true, force: true });
  mkdirSync(join(d, 'styles'), { recursive: true });
  writeFileSync(join(d, 'components.json'), JSON.stringify({
    style: 'default',
    tailwind: { css: 'styles/globals.css', baseColor: 'neutral', cssVariables: true },
    aliases: { components: 'components', utils: 'lib/utils/cn', ui: 'components/ui', lib: 'lib' },
  }));
  const log = console.log;
  console.log = () => {};
  try {
    await add.parseAsync(['chart-area-interactive', '--yes', '--cwd', d], { from: 'user' });
  } finally {
    console.log = log;
  }
  try {
    const file = join(d, 'components', 'charts', 'chart-area-interactive.ts');
    assert.ok(existsSync(file), 'the block lands at its target');
    for (const dep of ['chart.ts', 'chart-geometry.ts', 'card.ts', 'select.ts']) assert.ok(existsSync(join(d, 'components', 'ui', dep)), `${dep} comes with it`);
    const mod = await import(pathToFileURL(file).href);
    const out = await ssr(mod.default());
    assert.equal(out.match(/<ui-chart data-slot="chart"/g).length, 3, 'one chart per range, all served');
    assert.match(out, /<option value="90d" selected(="")?>Last 3 months<\/option>/);
    assert.equal(out.match(/data-tip=/g).length, 91 + 31 + 8, 'every point of every range is served as data');
    assert.doesNotMatch(out, /class="[^"]*\bcn-[a-z]/, 'no base-form name reaches the page');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('add chart installs chart.ts, chart-element.ts and chart-geometry.ts, and the installed copy renders', async () => {
  const { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } = await import('node:fs');
  const { pathToFileURL } = await import('node:url');
  const { add } = await import('../src/commands/add.js');
  const d = join(HERE, '.baked', `chart-add-${process.pid}`);
  rmSync(d, { recursive: true, force: true });
  mkdirSync(join(d, 'styles'), { recursive: true });
  writeFileSync(join(d, 'components.json'), JSON.stringify({
    style: 'default',
    tailwind: { css: 'styles/globals.css', baseColor: 'neutral', cssVariables: true },
    aliases: { components: 'components', utils: 'lib/utils/cn', ui: 'components/ui', lib: 'lib' },
  }));
  const log = console.log;
  console.log = () => {};
  try {
    await add.parseAsync(['chart', '--yes', '--no-deps', '--cwd', d], { from: 'user' });
  } finally {
    console.log = log;
  }
  try {
    const chartFile = join(d, 'components', 'ui', 'chart.ts');
    assert.ok(existsSync(chartFile), 'chart.ts lands in components/ui');
    assert.ok(existsSync(join(d, 'components', 'ui', 'chart-geometry.ts')), 'and its geometry beside it');
    assert.ok(existsSync(join(d, 'components', 'ui', 'chart-element.ts')), 'and its element');
    assert.match(readFileSync(chartFile, 'utf8'), /from '\.\/chart-geometry\.ts'/, 'the sibling import still resolves');
    const installed = await import(pathToFileURL(chartFile).href);
    const out = await ssr(installed.barChart({ config: CONFIG, data: MONTHS, bars: [{ dataKey: 'desktop' }] }));
    assert.equal(out.match(/class="ui-chart-rectangle"/g).length, 6);
    assert.doesNotMatch(out, /\bcn-chart\b/, 'the bake replaced the base-form names');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
