/**
 * Chart: shadcn's Chart, drawn as plain SVG by the server. Tier-2. shadcn's
 * is Recharts (D10: the kit takes no third-party runtime dependency), so
 * this file ports the parts of Recharts the shadcn charts use: the bar, area,
 * line, pie, radar and radial bar layouts, Recharts' default margins and axis
 * sizes, and shadcn's tooltip and legend markup. Two files come with it and
 * are re-exported here: `chart-geometry.ts`, the maths (scales, nice ticks,
 * the d3 curves, the bar and sector paths), and `chart-element.ts`, the
 * `<ui-chart>` element with the tooltip and legend markup it draws. Each chart function returns the whole `<ui-chart>`
 * (shadcn's ChartContainer plus the chart inside it), so the first paint is
 * the complete chart and it reads with JavaScript off.
 *
 * shadcn parity:
 *   ChartContainer config className    → the chart function's `config` and `class`
 *   <BarChart> / <LineChart> / <AreaChart> → barChart({ ... }) / lineChart / areaChart
 *   <PieChart> / <RadarChart> / <RadialBarChart> → pieChart / radarChart / radialBarChart
 *   <Bar> / <Line> / <Area> children    → `bars` / `lines` / `areas` arrays (same prop names)
 *   <CartesianGrid> / <XAxis> / <YAxis> → `grid` / `xAxis` / `yAxis` (same prop names)
 *   <ChartTooltip content={<ChartTooltipContent … />} />
 *                                       → `tooltip: { indicator, hideLabel, nameKey, … }`
 *   <ChartLegend content={<ChartLegendContent />} /> → `legend: { … }`
 *   <LabelList> / <Label>               → `labels: [{ position, offset, class, … }]`, `center`
 *   shape / dot / label render props    → the same options as functions returning `svg` templates
 *   ChartConfig                         → ChartConfig (same shape; `icon` is a function returning a template)
 *
 * The series colours are custom properties in the container's `style`
 * (`--color-desktop: var(--chart-1)`, `light-dark(a, b)` for a `theme`
 * entry), so `fill: 'var(--color-desktop)'` reads exactly as in shadcn.
 * Every part carries a `ui-chart-*` class named after the `recharts-*` class
 * it replaces (`recharts-pie-label-text` → `ui-chart-pie-label-text`), so a
 * shadcn `className` such as `[&_.recharts-text]:fill-background` ports by
 * that one rename.
 *
 * Sizing: the SVG has a `viewBox` of the chart's nominal size (450 by 253 for
 * the default `aspect-video` container, 250 square for the polar charts) and
 * scales to its container. Give `width` / `height` when the container has
 * another shape (`class: 'aspect-auto h-[250px] w-full'` wants a wide box).
 *
 * The element: `<ui-chart>` adds what needs a pointer. Hovering shows the
 * tooltip, the cursor and the active dots for the nearest point; the chart
 * takes focus (Recharts' accessibilityLayer), the arrow keys step through the
 * points, Home / End jump, Escape hides. Every tooltip is resolved by the
 * server, one per point, so a `labelFormatter`, a `formatter` or an `icon`
 * runs once on the server and never ships. A point whose tooltip is all text
 * is served as data and drawn by the element; one with an icon or a custom
 * row is served as markup.
 *
 * Design tokens used: `--chart-1` to `--chart-5` through the config, plus
 * `border`, `muted`, `muted-foreground`, `background` and `foreground`.
 *
 * A11y (handled by the element, plus your part): the SVG is a `role="img"`
 * named by `title`; once the element upgrades and the chart has a tooltip it
 * becomes a focusable `role="application"` whose arrow keys move the tooltip,
 * and each step is announced through a polite live region. Your part: pass a
 * `title` that says what the chart shows, and keep the numbers available in
 * the text around it (the card's description or footer) for a reader who
 * cannot use the chart.
 *
 * @example
 * ```html
 * ${barChart({
 *   config: { desktop: { label: 'Desktop', color: 'var(--chart-1)' } },
 *   data: [{ month: 'January', desktop: 186 }, { month: 'February', desktop: 305 }],
 *   title: 'Desktop visitors by month',
 *   grid: { vertical: false },
 *   xAxis: { dataKey: 'month', tickLine: false, axisLine: false, tickMargin: 10, tickFormatter: (v) => String(v).slice(0, 3) },
 *   tooltip: { cursor: false, hideLabel: true },
 *   bars: [{ dataKey: 'desktop', fill: 'var(--color-desktop)', radius: 8 }],
 * })}
 * ```
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../lib/utils.ts';
import {
  RADIAN, fmt, formatValue, num, percent, estimateTextWidth, niceTicks, linearTicks, linearScale, bandScale, pointScale,
  curvePath, rectanglePath, polarToCartesian, sectorPath, polygonPath, stackData, visibleTicks, barPositions,
  type CurveType, type Pt, type SectorGeometry, type Tick,
} from './chart-geometry.ts';
import {
  UiChart, chartStyle, payloadConfig, chartTooltipView, chartTooltipMarkup, chartTooltipContent, chartLegendContent, isPlainView,
  type ChartConfig, type ChartConfigItem, type ChartDatum, type Margin, type ChartPayloadItem, type ChartTooltipOptions,
  type ChartLegendOptions, type ChartBaseOptions, type ChartTooltipView, type TooltipLook,
} from './chart-element.ts';

export {
  fmt, formatValue, estimateTextWidth, niceTicks, linearTicks, linearScale, bandScale, pointScale, curvePath,
  rectanglePath, polarToCartesian, sectorPath, polygonPath, stackData, visibleTicks, barPositions,
};
export type { CurveType, SectorGeometry, Tick };
export { UiChart, chartStyle, payloadConfig, chartTooltipView, chartTooltipMarkup, chartTooltipContent, chartLegendContent };
export type {
  ChartConfig, ChartConfigItem, ChartDatum, Margin, ChartPayloadItem, ChartTooltipOptions, ChartLegendOptions, ChartBaseOptions,
  ChartTooltipView,
};

// --------------------------------------------------------------------------
// Labels (Recharts' Label / LabelList positions)
// --------------------------------------------------------------------------

export type LabelPosition = 'top' | 'bottom' | 'left' | 'right' | 'inside' | 'insideLeft' | 'insideRight' | 'insideTop' | 'insideBottom' | 'center' | 'middle' | 'outside' | 'insideStart' | 'insideEnd' | 'end';

/** A LabelList: one label per data point of a series. */
export interface ChartLabelOptions {
  /** The value to print, a key of the datum. Defaults to the series' dataKey. */
  dataKey?: string;
  position?: LabelPosition;
  offset?: number;
  class?: string;
  fill?: string;
  stroke?: string;
  fontSize?: number;
  formatter?: (value: unknown, datum: ChartDatum, index: number) => unknown;
  /** A custom label: return an `svg` template. */
  content?: (props: { x: number; y: number; width: number; height: number; value: unknown; datum: ChartDatum; index: number }) => unknown;
}

type VAnchor = 'start' | 'middle' | 'end';
const DY: Record<VAnchor, string> = { start: '0.71em', middle: '0.355em', end: '0em' };

/** A text element as Recharts' `<Text>` writes one: the position on the text, the baseline shift on a tspan. */
export function chartText(x: number, y: number, value: unknown, o: { anchor?: 'start' | 'middle' | 'end'; vAnchor?: VAnchor; class?: string; fill?: string | null; stroke?: string; fontSize?: number; baseline?: string } = {}) {
  // A size in pixels, as Recharts takes it, written in em of the chart's
  // 12px text so it keeps its size when the chart scales (see `_watchSize`).
  const size = o.fontSize != null ? `${fmt(o.fontSize / 12)}em` : null;
  return svg`<text x=${fmt(x)} y=${fmt(y)} text-anchor=${o.anchor ?? 'middle'} fill=${o.fill ?? null} stroke=${o.stroke ?? null} font-size=${size} alignment-baseline=${o.baseline ?? null} class=${cn('ui-chart-text', o.class)}><tspan x=${fmt(x)} dy=${DY[o.vAnchor ?? 'end']}>${value}</tspan></text>`;
}

function cartesianLabelAttrs(box: { x: number; y: number; width: number; height: number }, position: LabelPosition, offset: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end'; vAnchor: VAnchor } {
  const { x, y, width, height } = box;
  const vs = height >= 0 ? 1 : -1;
  const hs = width >= 0 ? 1 : -1;
  switch (position) {
    case 'top': return { x: x + width / 2, y: y - vs * offset, anchor: 'middle', vAnchor: vs > 0 ? 'end' : 'start' };
    case 'bottom': return { x: x + width / 2, y: y + height + vs * offset, anchor: 'middle', vAnchor: vs > 0 ? 'start' : 'end' };
    case 'left': return { x: x - hs * offset, y: y + height / 2, anchor: hs > 0 ? 'end' : 'start', vAnchor: 'middle' };
    case 'right': return { x: x + width + hs * offset, y: y + height / 2, anchor: hs > 0 ? 'start' : 'end', vAnchor: 'middle' };
    case 'insideLeft': return { x: x + hs * offset, y: y + height / 2, anchor: hs > 0 ? 'start' : 'end', vAnchor: 'middle' };
    case 'insideRight': return { x: x + width - hs * offset, y: y + height / 2, anchor: hs > 0 ? 'end' : 'start', vAnchor: 'middle' };
    case 'insideTop': return { x: x + width / 2, y: y + vs * offset, anchor: 'middle', vAnchor: 'start' };
    case 'insideBottom': return { x: x + width / 2, y: y + height - vs * offset, anchor: 'middle', vAnchor: 'end' };
    default: return { x: x + width / 2, y: y + height / 2, anchor: 'middle', vAnchor: 'middle' };
  }
}

function labelList(labels: ChartLabelOptions[] | undefined, seriesKey: string, items: Array<{ box: { x: number; y: number; width: number; height: number }; datum: ChartDatum; index: number; fill?: string }>, fallbackPosition: LabelPosition) {
  if (!labels?.length) return '';
  return labels.map((l) => svg`<g class="ui-chart-label-list">${items.map(({ box, datum, index, fill }) => {
    const raw = datum[l.dataKey ?? seriesKey];
    const value = l.formatter ? l.formatter(raw, datum, index) : raw;
    if (l.content) return l.content({ ...box, value, datum, index });
    const a = cartesianLabelAttrs(box, l.position ?? fallbackPosition, l.offset ?? 5);
    // A label takes its mark's colour unless it names one, as Recharts' does.
    return chartText(a.x, a.y, value, { anchor: a.anchor, vAnchor: a.vAnchor, class: cn('ui-chart-label', l.class), fill: l.fill ?? fill, stroke: l.stroke, fontSize: l.fontSize });
  })}</g>`);
}

// --------------------------------------------------------------------------
// The container (shadcn's ChartContainer) and the tooltip layer
// --------------------------------------------------------------------------

/**
 * shadcn's ChartContainer classes, its `[&_.recharts-*]` rules renamed to the
 * `ui-chart-*` parts, plus one of the kit's own: strokes keep their width in
 * pixels when the chart scales, as Recharts draws them at the real size.
 */
export function chartContainerClass(): string {
  return "cn-chart flex aspect-video justify-center text-xs [&_.ui-chart-cartesian-axis-tick_text]:fill-muted-foreground [&_.ui-chart-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.ui-chart-curve.ui-chart-tooltip-cursor]:stroke-border [&_.ui-chart-dot[stroke='#fff']]:stroke-transparent [&_.ui-chart-layer]:outline-hidden [&_.ui-chart-polar-grid_[stroke='#ccc']]:stroke-border [&_.ui-chart-radial-bar-background-sector]:fill-muted [&_.ui-chart-rectangle.ui-chart-tooltip-cursor]:fill-muted [&_.ui-chart-reference-line_[stroke='#ccc']]:stroke-border [&_.ui-chart-sector]:outline-hidden [&_.ui-chart-sector[stroke='#fff']]:stroke-transparent [&_.ui-chart-surface]:outline-hidden [&_.ui-chart-surface_*]:[vector-effect:non-scaling-stroke]";
}

/** One tooltip point: its category, its series, and where the tooltip anchors (viewBox units). */
export interface ChartPoint {
  label: unknown;
  payload: ChartPayloadItem[];
  x: number;
  y: number;
}

interface Frame {
  width: number;
  height: number;
  /** How the element maps a pointer to a point: along x, along y, or by the hovered shape. */
  hit: 'x' | 'y' | 'target';
  body: unknown;
  points: ChartPoint[];
  legend: ChartPayloadItem[];
  margin: Margin;
  /** The plot area, the box Recharts keeps a tooltip inside. */
  plot: { x: number; y: number; w: number; h: number };
  /** The element may widen the plot to fill its box (a cartesian chart). */
  fit?: boolean;
}

// Recharts sorts a legend by each item's value (its `itemSorter` default),
// which for a series is its name: a stable sort, so equal names keep order.
function sortLegend(items: ChartPayloadItem[]): ChartPayloadItem[] {
  return [...items].sort((a, b) => {
    const x = String(a.value);
    const y = String(b.value);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

function legendLayer(o: ChartBaseOptions, f: Frame) {
  if (!o.legend) return '';
  // An HTML row over the chart rather than a foreignObject inside it, as
  // Recharts' legend wrapper is: anchored at the margin, as wide as the area
  // between the side margins, as tall as its content (a wrapping legend grows
  // away from the edge), and in real pixels, since WebKit misplaces the
  // content of a scaled foreignObject and Firefox does not scale its font.
  const pct = (v: number, of: number) => `${fmt((v / of) * 100)}%`;
  const edge = o.legend.verticalAlign === 'top' ? `top: ${pct(f.margin.top, f.height)}` : `bottom: ${pct(f.margin.bottom, f.height)}`;
  return html`<div class="ui-chart-legend-wrapper absolute" style=${`left: ${pct(f.margin.left, f.width)}; right: ${pct(f.margin.right, f.width)}; ${edge}`}>${chartLegendContent(o.config, sortLegend(f.legend), o.legend)}</div>`;
}

function frame(o: ChartBaseOptions, f: Frame) {
  const t = o.tooltip || null;
  const def = t && t.defaultIndex != null ? f.points[t.defaultIndex] : undefined;
  const a11y = o.accessibilityLayer !== false;
  // Each point's tooltip is resolved here, on the server, so a formatter never
  // ships. One that is all strings is served as data (a 90 point chart would
  // otherwise carry 90 copies of the markup); one with an icon or a custom
  // row is served as markup.
  const look: TooltipLook = t ? { indicator: t.indicator, hideIndicator: t.hideIndicator, class: t.class, labelClass: t.labelClass } : {};
  const views = t ? f.points.map((p) => chartTooltipView(o.config, p.label, p.payload, t)) : [];
  // cn() keeps both aspect utilities, so an authored one replaces the default here.
  const base = /(^|\s)aspect-/.test(o.class ?? '') ? chartContainerClass().replace(' aspect-video', '') : chartContainerClass();
  return html`<ui-chart data-slot="chart" data-chart=${o.id ?? null} class=${cn(base, o.class)} style=${chartStyle(o.config) || null}><div class="ui-chart-wrapper relative h-full w-full min-w-0"><svg class="ui-chart-surface block h-full w-full overflow-visible" xmlns="http://www.w3.org/2000/svg" viewBox=${`0 0 ${fmt(f.width)} ${fmt(f.height)}`} role="img" aria-label=${o.title ?? null} data-hit=${t ? f.hit : null} data-keyboard=${t && a11y ? 'true' : null} data-default-index=${def ? String(t?.defaultIndex) : null} data-fit=${f.fit ? 'x' : null} data-plot=${t || f.fit ? [f.plot.x, f.plot.y, f.plot.w, f.plot.h].map((v) => fmt(v)).join(' ') : null}>${o.defs ? svg`<defs>${o.defs}</defs>` : ''}${f.body}</svg>${legendLayer(o, f)}${t ? html`<div data-slot="chart-tooltip" class="ui-chart-tooltip-wrapper pointer-events-none absolute top-0 left-0 z-10 [transition:transform_400ms]" ?hidden=${!def} style=${def ? `transform: translate(${fmt(def.x + 10)}px, ${fmt(def.y + 10)}px)` : null}>${def && t && t.defaultIndex != null ? chartTooltipMarkup(views[t.defaultIndex], look) : ''}</div><div data-slot="chart-tooltips" hidden data-look=${JSON.stringify(look)}>${views.map((v, i) => (isPlainView(v)
      ? html`<div data-index=${String(i)} data-x=${fmt(f.points[i].x)} data-y=${fmt(f.points[i].y)} data-tip=${JSON.stringify(v)}></div>`
      : html`<div data-index=${String(i)} data-x=${fmt(f.points[i].x)} data-y=${fmt(f.points[i].y)}>${chartTooltipMarkup(v, look)}</div>`))}</div><span data-slot="chart-live" class="sr-only" aria-live="polite"></span>` : ''}</div></ui-chart>`;
}

/** The per-point overlay groups: hidden until their point is active (or it is the default). */
function overlay(slot: 'chart-cursor' | 'chart-active', parts: unknown[], defaultIndex: number | undefined) {
  return svg`<g data-slot=${slot}>${parts.map((p, i) => svg`<g data-index=${String(i)} visibility=${i === defaultIndex ? 'visible' : 'hidden'}>${p}</g>`)}</g>`;
}

function resolveMargin(m: Partial<Margin> | undefined): Margin {
  if (!m) return { top: 5, right: 5, bottom: 5, left: 5 };
  return { top: m.top ?? 0, right: m.right ?? 0, bottom: m.bottom ?? 0, left: m.left ?? 0 };
}

// --------------------------------------------------------------------------
// Cartesian charts: bar, line, area
// --------------------------------------------------------------------------

export interface ChartAxisOptions {
  dataKey?: string;
  type?: 'category' | 'number';
  hide?: boolean;
  tick?: boolean;
  tickLine?: boolean;
  axisLine?: boolean;
  tickMargin?: number;
  tickSize?: number;
  tickFormatter?: (value: unknown, index: number) => unknown;
  minTickGap?: number;
  tickCount?: number;
  interval?: number | 'preserveEnd' | 'preserveStart' | 'preserveStartEnd';
  /** The x axis's height, default 30. */
  height?: number;
  /** The y axis's width, default 60. */
  width?: number;
  domain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax'];
  allowDecimals?: boolean;
  padding?: { left?: number; right?: number; top?: number; bottom?: number };
  /** Run the axis the other way, Recharts' `reversed` (a right-to-left chart's x axis). */
  reversed?: boolean;
  class?: string;
}

export interface ChartDotOptions { r?: number; fill?: string; stroke?: string; strokeWidth?: number; fillOpacity?: number; class?: string }
export type ChartDotRender = (props: { cx: number; cy: number; r: number; fill: string; stroke: string; datum: ChartDatum; index: number; dataKey: string }) => unknown;

export interface ChartBarShapeProps {
  x: number; y: number; width: number; height: number;
  radius: number | number[]; fill: string; datum: ChartDatum; index: number; dataKey: string;
  stroke?: string; strokeWidth?: number; fillOpacity?: number;
}

/** A bar as the kit draws one (Recharts' `<Rectangle>`), for a custom `shape` to reuse. */
export function chartRectangle(p: Omit<ChartBarShapeProps, 'datum' | 'index' | 'dataKey'> & { strokeDasharray?: number | string; strokeDashoffset?: number; class?: string }) {
  return svg`<path class=${cn('ui-chart-rectangle', p.class)} fill=${p.fill} fill-opacity=${p.fillOpacity ?? null} stroke=${p.stroke ?? null} stroke-width=${p.strokeWidth ?? null} stroke-dasharray=${p.strokeDasharray ?? null} stroke-dashoffset=${p.strokeDashoffset ?? null} d=${rectanglePath(p.x, p.y, p.width, p.height, p.radius)}></path>`;
}

export interface ChartSeriesOptions {
  dataKey: string;
  name?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  strokeDasharray?: string;
  stackId?: string;
  /** Line and area curve, Recharts' `type`. */
  type?: CurveType;
  /** Bar corner radius, one number or `[tl, tr, br, bl]`. */
  radius?: number | number[];
  /** Line dots (default on for lines, off for areas), options or a render function. */
  dot?: boolean | ChartDotOptions | ChartDotRender;
  /** The hover dot (lines and areas), default on. */
  activeDot?: boolean | ChartDotOptions;
  labels?: ChartLabelOptions[];
  /** A bar drawn active from the first paint, and how (Recharts' `activeIndex` + `activeBar`). */
  activeIndex?: number;
  activeBar?: { fill?: string; fillOpacity?: number; stroke?: string; strokeWidth?: number; strokeDasharray?: string; strokeDashoffset?: number };
  /** A custom bar, Recharts' `shape`. */
  shape?: (props: ChartBarShapeProps) => unknown;
  barSize?: number;
  class?: string;
  hide?: boolean;
}

export interface CartesianChartOptions extends ChartBaseOptions {
  layout?: 'horizontal' | 'vertical';
  barCategoryGap?: number | string;
  barGap?: number | string;
  maxBarSize?: number;
  stackOffset?: 'none' | 'expand' | 'sign';
  grid?: false | { horizontal?: boolean; vertical?: boolean; strokeDasharray?: string; class?: string };
  xAxis?: ChartAxisOptions | false;
  yAxis?: ChartAxisOptions | false;
}

type Family = 'bar' | 'line' | 'area';

function valueDomain(spec: ChartAxisOptions | undefined, dataMin: number, dataMax: number, expand: boolean): { domain: [number, number]; ticks: number[] } {
  if (expand) return { domain: [0, 1], ticks: niceTicks(0, 1, spec?.tickCount ?? 5) };
  const d = spec?.domain;
  const pick = (v: unknown, auto: number, data: number): number => (typeof v === 'number' ? v : v === 'dataMin' || v === 'dataMax' ? data : auto);
  const lo = pick(d?.[0], Math.min(0, dataMin), dataMin);
  const hi = pick(d?.[1], dataMax, dataMax);
  const ticks = niceTicks(lo, hi, spec?.tickCount ?? 5, spec?.allowDecimals ?? true);
  const [d0, d1] = d ?? [];
  if (typeof d0 === 'number' && typeof d1 === 'number') return { domain: [d0, d1], ticks: ticks.filter((t) => t >= d0 && t <= d1) };
  return { domain: [Math.min(lo, ticks[0]), Math.max(hi, ticks[ticks.length - 1])], ticks };
}

function dotProps(spec: boolean | ChartDotOptions | ChartDotRender | undefined, fallback: boolean): ChartDotOptions | ChartDotRender | null {
  if (spec === undefined) return fallback ? {} : null;
  if (spec === false) return null;
  if (spec === true) return {};
  return spec;
}

function drawDot(spec: ChartDotOptions | ChartDotRender, base: { cx: number; cy: number; r: number; fill: string; stroke: string; strokeWidth: number }, datum: ChartDatum, index: number, dataKey: string, cls: string) {
  if (typeof spec === 'function') return spec({ cx: base.cx, cy: base.cy, r: base.r, fill: base.fill, stroke: base.stroke, datum, index, dataKey });
  return svg`<circle cx=${fmt(base.cx)} cy=${fmt(base.cy)} r=${fmt(spec.r ?? base.r)} fill=${spec.fill ?? base.fill} fill-opacity=${spec.fillOpacity ?? null} stroke=${spec.stroke ?? base.stroke} stroke-width=${spec.strokeWidth ?? base.strokeWidth} class=${cn('ui-chart-dot', cls, spec.class)}></circle>`;
}

function cartesian(o: CartesianChartOptions, family: Family, all: ChartSeriesOptions[]) {
  const W = o.width ?? 450;
  const H = o.height ?? Math.round((W * 9) / 16);
  const margin = resolveMargin(o.margin);
  const vertical = o.layout === 'vertical';
  const xSpec = o.xAxis || undefined;
  const ySpec = o.yAxis || undefined;
  const catSpec = vertical ? ySpec : xSpec;
  const valSpec = vertical ? xSpec : ySpec;
  const xShown = !!xSpec && !xSpec.hide;
  const yShown = !!ySpec && !ySpec.hide;
  const xH = xShown ? xSpec.height ?? 30 : 0;
  const yW = yShown ? ySpec.width ?? 60 : 0;
  const legendH = o.legend ? o.legend.height ?? 28 : 0;
  const legendTop = !!o.legend && o.legend.verticalAlign === 'top';
  const plot = {
    x: margin.left + yW,
    y: margin.top + (legendTop ? legendH : 0),
    w: W - margin.left - margin.right - yW,
    h: H - margin.top - margin.bottom - xH - legendH,
  };
  const data = o.data;
  const series = all.filter((s) => !s.hide);
  const catKey = catSpec?.dataKey;
  const categories = data.map((d, i) => (catKey ? d[catKey] : i));

  // Values: each series' [low, high] per row, stacked by stackId.
  const offsetMode = o.stackOffset ?? (family === 'bar' ? 'sign' : 'none');
  const bands: Record<string, Array<[number, number]>> = {};
  const stacks = new Map<string, string[]>();
  for (const s of series) if (s.stackId != null) stacks.set(s.stackId, [...(stacks.get(s.stackId) ?? []), s.dataKey]);
  for (const keys of stacks.values()) Object.assign(bands, stackData(data, keys, offsetMode === 'expand' ? 'expand' : offsetMode === 'sign' ? 'sign' : 'none'));
  for (const s of series) if (s.stackId == null) bands[s.dataKey] = data.map((d) => [0, num(d[s.dataKey])]);
  const flat = series.flatMap((s) => bands[s.dataKey].flat());
  const { domain, ticks: valueTicks } = valueDomain(valSpec, flat.length ? Math.min(...flat) : 0, flat.length ? Math.max(...flat) : 0, offsetMode === 'expand');
  const vRange: [number, number] = vertical ? [plot.x, plot.x + plot.w] : [plot.y + plot.h, plot.y];
  const vScale = linearScale(domain, valSpec?.reversed ? [vRange[1], vRange[0]] : vRange);

  // Categories: bands under bars, points under lines and areas.
  const pad = catSpec?.padding ?? {};
  const c0 = vertical ? plot.y + (pad.top ?? 0) : plot.x + (pad.left ?? 0);
  const c1 = vertical ? plot.y + plot.h - (pad.bottom ?? 0) : plot.x + plot.w - (pad.right ?? 0);
  // A reversed category axis lays the rows out from the far end.
  const slot = (i: number) => (catSpec?.reversed ? data.length - 1 - i : i);
  const band = bandScale(data.length, c0, c1);
  const point = pointScale(data.length, c0, c1);
  const catAt = (i: number) => (family === 'bar' ? band.at(slot(i)) + band.bandwidth / 2 : point(slot(i)));
  const color = (s: ChartSeriesOptions) => (family === 'bar' ? s.fill : s.stroke ?? s.fill) ?? '#808080';
  const defaultIndex = o.tooltip ? o.tooltip.defaultIndex : undefined;

  // Grid lines at the value ticks and the category ticks.
  const g = o.grid;
  const gridLine = (x1: number, y1: number, x2: number, y2: number) => svg`<line stroke="#ccc" fill="none" stroke-dasharray=${(g && g.strokeDasharray) || null} x1=${fmt(x1)} y1=${fmt(y1)} x2=${fmt(x2)} y2=${fmt(y2)}></line>`;
  const valueCoords = valueTicks.map((t) => vScale(t));
  const catCoords = data.map((_, i) => catAt(i));
  const hLines = vertical ? catCoords : valueCoords;
  const vLines = vertical ? valueCoords : catCoords;
  const grid = g === undefined || g === false ? '' : svg`<g class=${cn('ui-chart-cartesian-grid', g.class)}>${g.horizontal === false ? '' : svg`<g class="ui-chart-cartesian-grid-horizontal">${hLines.map((y) => gridLine(plot.x, y, plot.x + plot.w, y))}</g>`}${g.vertical === false ? '' : svg`<g class="ui-chart-cartesian-grid-vertical">${vLines.map((x) => gridLine(x, plot.y, x, plot.y + plot.h))}</g>`}</g>`;

  // The hover cursor per point.
  const cursorOn = !!o.tooltip && o.tooltip.cursor !== false;
  const cursors = cursorOn
    ? data.map((_, i) => {
      if (family === 'bar') {
        const a = band.at(slot(i));
        return vertical
          ? svg`<path class="ui-chart-rectangle ui-chart-tooltip-cursor" fill="#ccc" d=${rectanglePath(plot.x, a, plot.w, band.bandwidth)}></path>`
          : svg`<path class="ui-chart-rectangle ui-chart-tooltip-cursor" fill="#ccc" d=${rectanglePath(a, plot.y, band.bandwidth, plot.h)}></path>`;
      }
      const c = catAt(i);
      return vertical
        ? svg`<path class="ui-chart-curve ui-chart-tooltip-cursor" stroke="#ccc" fill="none" d=${`M${fmt(plot.x)},${fmt(c)}L${fmt(plot.x + plot.w)},${fmt(c)}`}></path>`
        : svg`<path class="ui-chart-curve ui-chart-tooltip-cursor" stroke="#ccc" fill="none" d=${`M${fmt(c)},${fmt(plot.y)}L${fmt(c)},${fmt(plot.y + plot.h)}`}></path>`;
    })
    : [];

  // Marks.
  const slotIds: string[] = [];
  for (const s of series) { const id = s.stackId != null ? `stack:${s.stackId}` : `bar:${s.dataKey}`; if (!slotIds.includes(id)) slotIds.push(id); }
  const slotSpecs = slotIds.map((id) => ({ barSize: series.find((s) => (s.stackId != null ? `stack:${s.stackId}` : `bar:${s.dataKey}`) === id)?.barSize }));
  const positions = family === 'bar' ? barPositions(band.bandwidth, slotSpecs, o.barGap, o.barCategoryGap, o.maxBarSize) : [];

  const marks = series.map((s) => {
    const sb = bands[s.dataKey];
    if (family === 'bar') {
      const pos = positions[slotIds.indexOf(s.stackId != null ? `stack:${s.stackId}` : `bar:${s.dataKey}`)];
      const boxes = data.map((d, i) => {
        const [lo, hi] = sb[i];
        const a = band.at(slot(i)) + pos.offset;
        const box = vertical
          ? { x: vScale(lo), y: a, width: vScale(hi) - vScale(lo), height: pos.size }
          : { x: a, y: vScale(hi), width: pos.size, height: vScale(lo) - vScale(hi) };
        return { box, datum: d, index: i, fill: typeof d.fill === 'string' ? d.fill : s.fill };
      });
      return svg`<g class=${cn('ui-chart-layer ui-chart-bar', s.class)}><g class="ui-chart-layer ui-chart-bar-rectangles">${boxes.map(({ box, datum, index }) => {
        const fill = typeof datum.fill === 'string' ? datum.fill : s.fill ?? '#808080';
        const active = s.activeIndex === index ? s.activeBar ?? {} : null;
        const shape = s.shape
          ? s.shape({ ...box, radius: s.radius ?? 0, fill, datum, index, dataKey: s.dataKey, stroke: s.stroke, strokeWidth: s.strokeWidth, fillOpacity: s.fillOpacity })
          : svg`<path class="ui-chart-rectangle" fill=${active?.fill ?? fill} fill-opacity=${active?.fillOpacity ?? s.fillOpacity ?? null} stroke=${active?.stroke ?? s.stroke ?? null} stroke-width=${active?.strokeWidth ?? s.strokeWidth ?? null} stroke-dasharray=${active?.strokeDasharray ?? null} stroke-dashoffset=${active?.strokeDashoffset ?? null} d=${rectanglePath(box.x, box.y, box.width, box.height, s.radius ?? 0)}></path>`;
        return svg`<g class="ui-chart-layer ui-chart-bar-rectangle" data-index=${String(index)}>${shape}</g>`;
      })}</g>${labelList(s.labels, s.dataKey, boxes, 'center')}</g>`;
    }
    const top = data.map((_, i): Pt => (vertical ? [vScale(sb[i][1]), catAt(i)] : [catAt(i), vScale(sb[i][1])]));
    const curve = s.type ?? 'linear';
    const stroke = s.stroke ?? '#3182bd';
    const pts = top.map((p, i) => ({ box: { x: p[0], y: p[1], width: 0, height: 0 }, datum: data[i], index: i }));
    const dot = dotProps(s.dot, family === 'line');
    const dots = dot
      ? svg`<g class="ui-chart-layer ui-chart-dots">${top.map((p, i) => drawDot(dot, { cx: p[0], cy: p[1], r: 3, fill: family === 'line' ? '#fff' : s.fill ?? stroke, stroke, strokeWidth: s.strokeWidth ?? 1 }, data[i], i, s.dataKey, family === 'line' ? 'ui-chart-line-dot' : 'ui-chart-area-dot'))}</g>`
      : '';
    if (family === 'line') {
      return svg`<g class=${cn('ui-chart-layer ui-chart-line', s.class)}><path class="ui-chart-curve ui-chart-line-curve" fill="none" stroke=${stroke} stroke-width=${s.strokeWidth ?? 1} stroke-dasharray=${s.strokeDasharray ?? null} d=${curvePath(top, curve)}></path>${dots}${labelList(s.labels, s.dataKey, pts, 'top')}</g>`;
    }
    const bottom = data.map((_, i): Pt => {
      const lo = s.stackId != null ? sb[i][0] : Math.max(domain[0], Math.min(0, domain[1]));
      return vertical ? [vScale(lo), catAt(i)] : [catAt(i), vScale(lo)];
    }).reverse();
    const area = `${curvePath(top, curve)}${curvePath(bottom, curve, 'L')}Z`;
    return svg`<g class=${cn('ui-chart-layer ui-chart-area', s.class)}><path class="ui-chart-curve ui-chart-area-area" fill=${s.fill ?? '#3182bd'} fill-opacity=${s.fillOpacity ?? 0.6} stroke="none" d=${area}></path><path class="ui-chart-curve ui-chart-area-curve" fill="none" stroke=${stroke} stroke-width=${s.strokeWidth ?? 1} stroke-dasharray=${s.strokeDasharray ?? null} d=${curvePath(top, curve)}></path>${dots}${labelList(s.labels, s.dataKey, pts, 'top')}</g>`;
  });

  // Active dots per point (lines and areas).
  const actives = family === 'bar' || !o.tooltip
    ? []
    : data.map((_, i) => series.map((s) => {
      if (s.activeDot === false) return '';
      const sb = bands[s.dataKey];
      const [cx, cy] = vertical ? [vScale(sb[i][1]), catAt(i)] : [catAt(i), vScale(sb[i][1])];
      const spec = typeof s.activeDot === 'object' ? s.activeDot : {};
      return drawDot(spec, { cx, cy, r: 4, fill: s.stroke ?? s.fill ?? '#3182bd', stroke: '#fff', strokeWidth: 2 }, data[i], i, s.dataKey, 'ui-chart-active-dot');
    }));

  // Axes.
  const axis = (which: 'x' | 'y') => {
    const spec = which === 'x' ? xSpec : ySpec;
    if (!spec || spec.hide) return '';
    const isCat = (which === 'x') !== vertical;
    const fmtTick = (v: unknown, i: number) => (spec.tickFormatter ? spec.tickFormatter(v, i) : v);
    const ticks: Tick[] = isCat
      ? categories.map((v, i) => ({ value: v, label: fmtTick(v, i), coord: catAt(i) }))
      : valueTicks.map((v, i) => ({ value: v, label: fmtTick(v, i), coord: vScale(v) }));
    const size = (t: Tick) => (which === 'x' ? estimateTextWidth(String(t.label ?? '')) : 14);
    const interval = spec.interval ?? 'preserveEnd';
    const minTickGap = spec.minTickGap ?? 5;
    // Every tick is served; the ones that do not fit are hidden. The server
    // can only estimate a label's width, so the element measures the real
    // text and thins the ticks again (see `_fitTicks`).
    const shown = new Map(visibleTicks(ticks, size, 0, which === 'x' ? W : H, minTickGap, interval).map((t) => [t.coord, t.at ?? t.coord]));
    const all = spec.tick === false ? [] : ticks;
    const tickSize = spec.tickSize ?? 6;
    const margin2 = spec.tickMargin ?? 2;
    const edge = which === 'x' ? plot.y + plot.h : plot.x;
    const line = spec.axisLine === false ? '' : which === 'x'
      ? svg`<line class="ui-chart-cartesian-axis-line" stroke="#666" fill="none" x1=${fmt(plot.x)} y1=${fmt(edge)} x2=${fmt(plot.x + plot.w)} y2=${fmt(edge)}></line>`
      : svg`<line class="ui-chart-cartesian-axis-line" stroke="#666" fill="none" x1=${fmt(edge)} y1=${fmt(plot.y)} x2=${fmt(edge)} y2=${fmt(plot.y + plot.h)}></line>`;
    return svg`<g class=${cn('ui-chart-layer ui-chart-cartesian-axis', which === 'x' ? 'ui-chart-xAxis' : 'ui-chart-yAxis', spec.class)} data-axis=${which} data-gap=${String(minTickGap)} data-interval=${String(interval)} data-extent=${fmt(which === 'x' ? W : H)}>${line}<g class="ui-chart-cartesian-axis-ticks">${all.map((t) => {
      const at = shown.get(t.coord) ?? t.coord;
      const tl = spec.tickLine === false ? '' : which === 'x'
        ? svg`<line class="ui-chart-cartesian-axis-tick-line" stroke="#666" fill="none" x1=${fmt(at)} y1=${fmt(edge + tickSize)} x2=${fmt(at)} y2=${fmt(edge)}></line>`
        : svg`<line class="ui-chart-cartesian-axis-tick-line" stroke="#666" fill="none" x1=${fmt(edge - tickSize)} y1=${fmt(at)} x2=${fmt(edge)} y2=${fmt(at)}></line>`;
      const text = which === 'x'
        ? chartText(at, edge + tickSize + margin2, t.label, { anchor: 'middle', vAnchor: 'start', fill: '#666', class: 'ui-chart-cartesian-axis-tick-value' })
        : chartText(edge - tickSize - margin2, at, t.label, { anchor: 'end', vAnchor: 'middle', fill: '#666', class: 'ui-chart-cartesian-axis-tick-value' });
      return svg`<g class="ui-chart-layer ui-chart-cartesian-axis-tick" data-coord=${fmt(t.coord)} visibility=${shown.has(t.coord) ? null : 'hidden'}>${tl}${text}</g>`;
    })}</g></g>`;
  };

  // Tooltip points: the series at each row, anchored where Recharts puts a
  // tooltip it opens without a pointer (combineCoordinateForDefaultIndex):
  // on the category, halfway between the plot's near edge and the chart's far one.
  const points: ChartPoint[] = data.map((d, i) => ({
    label: categories[i],
    payload: series.map((s) => ({ dataKey: s.dataKey, name: s.name ?? s.dataKey, value: d[s.dataKey], color: color(s), payload: d })),
    x: vertical ? (plot.x + W) / 2 : catAt(i),
    y: vertical ? catAt(i) : (plot.y + H) / 2,
  }));

  const body = svg`${grid}${overlay('chart-cursor', cursors, defaultIndex)}${marks}${axis('x')}${axis('y')}${actives.length ? overlay('chart-active', actives, defaultIndex) : ''}`;
  return frame(o, {
    width: W, height: H, hit: vertical ? 'y' : 'x', body, points, margin, plot, fit: true,
    legend: series.map((s) => ({ dataKey: s.dataKey, name: s.name ?? s.dataKey, value: s.name ?? s.dataKey, color: color(s), payload: {} })),
  });
}

/** A bar chart: Recharts' `<BarChart>` with its `<Bar>`s. */
export function barChart(o: CartesianChartOptions & { bars: ChartSeriesOptions[] }) {
  return cartesian(o, 'bar', o.bars);
}

/** A line chart: Recharts' `<LineChart>` with its `<Line>`s. */
export function lineChart(o: CartesianChartOptions & { lines: ChartSeriesOptions[] }) {
  return cartesian(o, 'line', o.lines);
}

/** An area chart: Recharts' `<AreaChart>` with its `<Area>`s. */
export function areaChart(o: CartesianChartOptions & { areas: ChartSeriesOptions[] }) {
  return cartesian(o, 'area', o.areas);
}

// --------------------------------------------------------------------------
// Polar charts: pie, radar, radial bar
// --------------------------------------------------------------------------

/** Where a polar chart sits: its centre and radii, what a `center` label receives. */
export interface ChartPolarBox { cx: number; cy: number; innerRadius: number; outerRadius: number }

export interface ChartSectorProps extends SectorGeometry {
  fill: string;
  stroke: string;
  strokeWidth: number;
  datum: ChartDatum;
  index: number;
  value: number;
  midAngle: number;
}

/** A sector as the kit draws one, for a custom `shape` / `activeShape` to reuse. */
export function chartSector(p: Partial<ChartSectorProps> & SectorGeometry, cls = '') {
  return svg`<path class=${cn('ui-chart-sector', cls)} fill=${p.fill ?? null} stroke=${p.stroke ?? null} stroke-width=${p.strokeWidth ?? null} d=${sectorPath(p)}></path>`;
}

export interface ChartPieOptions {
  dataKey: string;
  nameKey?: string;
  /** This ring's own rows (two rings of a stacked pie), else the chart's `data`. */
  data?: ChartDatum[];
  innerRadius?: number | string;
  outerRadius?: number | string;
  cx?: number | string;
  cy?: number | string;
  startAngle?: number;
  endAngle?: number;
  paddingAngle?: number;
  cornerRadius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Slice labels outside the pie: true, options, or a render function. */
  label?: boolean | { offsetRadius?: number; class?: string; fill?: string; fontSize?: number }
    | ((props: { x: number; y: number; cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; value: unknown; datum: ChartDatum; index: number; fill: string; textAnchor: 'start' | 'middle' | 'end' }) => unknown);
  labelLine?: boolean;
  /** LabelLists on the slices (`position` `inside` by default, or `outside`). */
  labels?: ChartLabelOptions[];
  activeIndex?: number;
  /** How the active slice draws: a render function, or a larger outer radius. */
  activeShape?: ((props: ChartSectorProps) => unknown) | { outerRadius?: number };
  shape?: (props: ChartSectorProps) => unknown;
  /** Content at the centre (a donut's total), shadcn's `<Label content>`. */
  center?: (box: ChartPolarBox) => unknown;
  class?: string;
}

function polarPlot(o: ChartBaseOptions, W: number, H: number) {
  const m = resolveMargin(o.margin);
  const legendH = o.legend ? o.legend.height ?? 28 : 0;
  const top = m.top + (o.legend && o.legend.verticalAlign === 'top' ? legendH : 0);
  return { m, x: m.left, y: top, w: W - m.left - m.right, h: H - m.top - m.bottom - legendH };
}

function anchorOf(x: number, cx: number): 'start' | 'middle' | 'end' {
  return x > cx ? 'start' : x < cx ? 'end' : 'middle';
}

/** A pie or donut chart: Recharts' `<PieChart>` with its `<Pie>`s. */
export function pieChart(o: ChartBaseOptions & { pies: ChartPieOptions[] }) {
  const W = o.width ?? 250;
  const H = o.height ?? W;
  const plot = polarPlot(o, W, H);
  const maxR = Math.min(plot.w, plot.h) / 2;
  const points: ChartPoint[] = [];
  const legend: ChartPayloadItem[] = [];
  const rings = o.pies.map((p) => {
    const rows = p.data ?? o.data;
    const cx = plot.x + percent(p.cx, plot.w, plot.w / 2);
    const cy = plot.y + percent(p.cy, plot.h, plot.h / 2);
    const innerRadius = percent(p.innerRadius, maxR, 0);
    const outerRadius = percent(p.outerRadius, maxR, maxR * 0.8);
    const start = p.startAngle ?? 0;
    const end = p.endAngle ?? 360;
    const delta = Math.sign(end - start) * Math.min(Math.abs(end - start), 360);
    const values = rows.map((d) => num(d[p.dataKey]));
    const nonZero = values.filter((v) => v !== 0).length;
    const padding = rows.length <= 1 ? 0 : p.paddingAngle ?? 0;
    const real = Math.abs(delta) - (Math.abs(delta) >= 360 ? nonZero : nonZero - 1) * padding;
    const sum = values.reduce((s, v) => s + v, 0);
    let prevEnd = start;
    const sectors = rows.map((d, i) => {
      const v = values[i];
      const s0 = i ? prevEnd + Math.sign(delta) * padding * (v !== 0 ? 1 : 0) : start;
      const s1 = s0 + Math.sign(delta) * (sum > 0 ? (v / sum) * real : 0);
      prevEnd = s1;
      const fill = typeof d.fill === 'string' ? d.fill : p.fill ?? '#808080';
      return { cx, cy, innerRadius, outerRadius, startAngle: s0, endAngle: s1, cornerRadius: p.cornerRadius, fill, stroke: p.stroke ?? '#fff', strokeWidth: p.strokeWidth ?? 1, datum: d, index: i, value: v, midAngle: (s0 + s1) / 2 };
    });
    const base = points.length;
    sectors.forEach((s) => {
      const name = String(p.nameKey ? s.datum[p.nameKey] ?? s.index : s.index);
      const item = { dataKey: p.dataKey, name, value: s.datum[p.dataKey], color: s.fill, payload: s.datum };
      const at = polarToCartesian(s.cx, s.cy, (s.innerRadius + s.outerRadius) / 2, s.midAngle);
      points.push({ label: name, payload: [item], x: at.x, y: at.y });
      if (p === o.pies[0]) legend.push({ ...item, value: name });
    });
    const drawn = sectors.map((s) => {
      const isActive = p.activeIndex === s.index && p.activeShape;
      let shape: unknown;
      if (isActive && typeof p.activeShape === 'function') shape = p.activeShape(s);
      else if (isActive && typeof p.activeShape === 'object') shape = chartSector({ ...s, outerRadius: p.activeShape.outerRadius ?? s.outerRadius });
      else shape = p.shape ? p.shape(s) : chartSector(s);
      return svg`<g class="ui-chart-layer ui-chart-pie-sector" data-index=${String(base + s.index)}>${shape}</g>`;
    });
    let labels: unknown = '';
    if (p.label) {
      const lo = typeof p.label === 'object' ? p.label : {};
      const offsetR = lo.offsetRadius ?? 20;
      labels = svg`<g class="ui-chart-layer ui-chart-pie-labels">${sectors.map((s) => {
        const e = polarToCartesian(s.cx, s.cy, s.outerRadius + offsetR, s.midAngle);
        const a = polarToCartesian(s.cx, s.cy, s.outerRadius, s.midAngle);
        const anchor = anchorOf(e.x, s.cx);
        const line = p.labelLine === false ? '' : svg`<path class="ui-chart-curve ui-chart-pie-label-line" fill="none" stroke=${s.fill} d=${`M${fmt(a.x, 3)},${fmt(a.y, 3)}L${fmt(e.x, 3)},${fmt(e.y, 3)}`}></path>`;
        const text = typeof p.label === 'function'
          ? p.label({ x: e.x, y: e.y, cx: s.cx, cy: s.cy, midAngle: s.midAngle, innerRadius: s.innerRadius, outerRadius: s.outerRadius, value: s.datum[p.dataKey], datum: s.datum, index: s.index, fill: s.fill, textAnchor: anchor })
          : chartText(e.x, e.y, s.datum[p.dataKey], { anchor, fill: lo.fill ?? s.fill, stroke: 'none', fontSize: lo.fontSize, baseline: 'middle', class: cn('ui-chart-pie-label-text', lo.class) });
        return svg`<g class="ui-chart-layer">${line}${text}</g>`;
      })}</g>`;
    }
    const lists = (p.labels ?? []).map((l) => svg`<g class="ui-chart-label-list">${sectors.map((s) => {
      const raw = s.datum[l.dataKey ?? p.dataKey];
      const value = l.formatter ? l.formatter(raw, s.datum, s.index) : raw;
      const outside = l.position === 'outside';
      const at = polarToCartesian(s.cx, s.cy, outside ? s.outerRadius + (l.offset ?? 5) : (s.innerRadius + s.outerRadius) / 2, s.midAngle);
      if (l.content) return l.content({ x: at.x, y: at.y, width: 0, height: 0, value, datum: s.datum, index: s.index });
      return chartText(at.x, at.y, value, { anchor: outside ? (at.x >= s.cx ? 'start' : 'end') : 'middle', vAnchor: 'middle', class: cn('ui-chart-label', l.class), fill: l.fill, stroke: l.stroke, fontSize: l.fontSize });
    })}</g>`);
    const center = p.center ? p.center({ cx, cy, innerRadius, outerRadius }) : '';
    return svg`<g class=${cn('ui-chart-layer ui-chart-pie', p.class)}><g class="ui-chart-layer">${drawn}</g>${labels}${lists}${center}</g>`;
  });
  return frame(o, { width: W, height: H, hit: 'target', body: rings, points, legend, margin: plot.m, plot });
}

export interface ChartRadarOptions {
  dataKey: string;
  name?: string;
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  dot?: boolean | ChartDotOptions | ChartDotRender;
  activeDot?: boolean | ChartDotOptions;
  labels?: ChartLabelOptions[];
  class?: string;
}

export interface ChartPolarGridOptions {
  gridType?: 'polygon' | 'circle';
  radialLines?: boolean;
  /** The ring radii, else the radius axis ticks. */
  polarRadius?: number[];
  class?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface ChartPolarAngleAxisOptions {
  dataKey?: string;
  tickFormatter?: (value: unknown, index: number) => unknown;
  /** false hides the labels; a function draws each one. */
  tick?: boolean | ((props: { x: number; y: number; textAnchor: 'start' | 'middle' | 'end'; value: unknown; label: unknown; index: number; datum: ChartDatum }) => unknown);
  class?: string;
}

export interface ChartPolarRadiusAxisOptions {
  angle?: number;
  orientation?: 'left' | 'right' | 'middle';
  tickCount?: number;
  domain?: [number, number];
  tick?: boolean;
  tickFormatter?: (value: unknown, index: number) => unknown;
  class?: string;
  stroke?: string;
}

function polarGrid(g: ChartPolarGridOptions | false | undefined, cx: number, cy: number, radii: number[], angles: number[], outer: number, inner = 0) {
  if (!g) return '';
  const ring = (r: number) => (g.gridType === 'circle'
    ? svg`<circle class=${cn('ui-chart-polar-grid-concentric-circle', g.class)} stroke=${g.stroke ?? '#ccc'} stroke-width=${g.strokeWidth ?? null} fill=${g.fill ?? 'none'} cx=${fmt(cx)} cy=${fmt(cy)} r=${fmt(r)}></circle>`
    : svg`<path class=${cn('ui-chart-polar-grid-concentric-polygon', g.class)} stroke=${g.stroke ?? '#ccc'} stroke-width=${g.strokeWidth ?? null} fill=${g.fill ?? 'none'} d=${polygonPath(angles.map((a) => polarToCartesian(cx, cy, r, a)))}></path>`);
  return svg`<g class="ui-chart-polar-grid"><g class="ui-chart-polar-grid-concentric">${radii.map(ring)}</g>${g.radialLines === false ? '' : svg`<g class="ui-chart-polar-grid-angle">${angles.map((a) => {
    const b = polarToCartesian(cx, cy, inner, a);
    const e = polarToCartesian(cx, cy, outer, a);
    return svg`<line class=${cn('ui-chart-polar-grid-angle-line', g.class)} stroke=${g.stroke ?? '#ccc'} x1=${fmt(b.x)} y1=${fmt(b.y)} x2=${fmt(e.x)} y2=${fmt(e.y)}></line>`;
  })}</g>`}</g>`;
}

/** A radar chart: Recharts' `<RadarChart>` with its `<Radar>`s, grid and axes. */
export function radarChart(o: ChartBaseOptions & {
  radars: ChartRadarOptions[];
  cx?: number | string;
  cy?: number | string;
  innerRadius?: number | string;
  outerRadius?: number | string;
  startAngle?: number;
  endAngle?: number;
  grid?: ChartPolarGridOptions | false;
  angleAxis?: ChartPolarAngleAxisOptions | false;
  radiusAxis?: ChartPolarRadiusAxisOptions | false;
}) {
  const W = o.width ?? 250;
  const H = o.height ?? W;
  const plot = polarPlot(o, W, H);
  const maxR = Math.min(plot.w, plot.h) / 2;
  // The centre is a share of the whole chart (Recharts' selectPolarViewBox),
  // while the radius comes from the plot inside the margins.
  const cx = percent(o.cx, W, W / 2);
  const cy = percent(o.cy, H, H / 2);
  const inner = percent(o.innerRadius, maxR, 0);
  const outer = percent(o.outerRadius, maxR, maxR * 0.8);
  const data = o.data;
  const n = data.length;
  const start = o.startAngle ?? 90;
  const end = o.endAngle ?? -270;
  const angles = data.map((_, i) => start + (i * (end - start)) / (n || 1));
  const aSpec = o.angleAxis || undefined;
  const rSpec = o.radiusAxis || undefined;
  const all = o.radars.flatMap((r) => data.map((d) => num(d[r.dataKey])));
  const ticks = rSpec?.domain ? niceTicks(rSpec.domain[0], rSpec.domain[1], rSpec.tickCount ?? 5).filter((t) => t >= rSpec.domain![0] && t <= rSpec.domain![1]) : niceTicks(Math.min(0, ...all), Math.max(...all, 0), rSpec?.tickCount ?? 5);
  const domain: [number, number] = rSpec?.domain ?? [ticks[0], ticks[ticks.length - 1]];
  const rScale = linearScale(domain, [inner, outer]);
  const defaultIndex = o.tooltip ? o.tooltip.defaultIndex : undefined;
  const at = (r: ChartRadarOptions, i: number) => polarToCartesian(cx, cy, rScale(num(data[i][r.dataKey])), angles[i]);
  const colorOf = (r: ChartRadarOptions) => r.stroke ?? r.fill ?? '#808080';
  const grid = polarGrid(o.grid, cx, cy, o.grid && o.grid.polarRadius ? o.grid.polarRadius : ticks.map(rScale), angles, outer);
  const radars = o.radars.map((r) => {
    const pts = data.map((_, i) => at(r, i));
    const dot = dotProps(r.dot, false);
    return svg`<g class=${cn('ui-chart-layer ui-chart-radar', r.class)}><g class="ui-chart-layer ui-chart-radar-polygon"><path class="ui-chart-polygon" fill=${r.fill ?? null} fill-opacity=${r.fillOpacity ?? null} stroke=${r.stroke ?? null} stroke-width=${r.strokeWidth ?? null} d=${polygonPath(pts)}></path></g>${dot ? svg`<g class="ui-chart-layer ui-chart-radar-dots">${pts.map((q, i) => drawDot(dot, { cx: q.x, cy: q.y, r: 3, fill: r.fill ?? '#808080', stroke: r.stroke ?? 'none', strokeWidth: r.strokeWidth ?? 1 }, data[i], i, r.dataKey, 'ui-chart-radar-dot'))}</g>` : ''}${labelList(r.labels, r.dataKey, pts.map((q, i) => ({ box: { x: q.x, y: q.y, width: 0, height: 0 }, datum: data[i], index: i })), 'top')}</g>`;
  });
  const angleAxis = aSpec ? svg`<g class=${cn('ui-chart-layer ui-chart-polar-angle-axis', aSpec.class)}>${aSpec.tick === false ? '' : data.map((d, i) => {
    const value = aSpec.dataKey ? d[aSpec.dataKey] : i;
    const label = aSpec.tickFormatter ? aSpec.tickFormatter(value, i) : value;
    const p = polarToCartesian(cx, cy, outer + 8, angles[i]);
    const cos = Math.cos(-RADIAN * angles[i]);
    const anchor = cos > 1e-5 ? 'start' : cos < -1e-5 ? 'end' : 'middle';
    if (typeof aSpec.tick === 'function') return aSpec.tick({ x: p.x, y: p.y, textAnchor: anchor, value, label, index: i, datum: d });
    const sin = Math.sin(-RADIAN * angles[i]);
    const vAnchor: VAnchor = anchor !== 'middle' ? 'middle' : sin < 0 ? 'end' : 'start';
    return svg`<g class="ui-chart-layer ui-chart-polar-angle-axis-tick">${chartText(p.x, p.y, label, { anchor, vAnchor, fill: '#808080', class: 'ui-chart-polar-angle-axis-tick-value' })}</g>`;
  })}</g>` : '';
  const radiusAxis = rSpec && rSpec.tick !== false ? svg`<g class=${cn('ui-chart-layer ui-chart-polar-radius-axis', rSpec.class)}>${ticks.map((t, i) => {
    const p = polarToCartesian(cx, cy, rScale(t), rSpec.angle ?? 0);
    const anchor = rSpec.orientation === 'left' ? 'end' : rSpec.orientation === 'middle' ? 'middle' : 'start';
    return chartText(p.x, p.y, rSpec.tickFormatter ? rSpec.tickFormatter(t, i) : t, { anchor, vAnchor: 'middle', fill: rSpec.stroke ?? '#808080', class: 'ui-chart-polar-radius-axis-tick-value' });
  })}</g>` : '';
  const cursors = o.tooltip && o.tooltip.cursor !== false
    ? angles.map((a) => { const e = polarToCartesian(cx, cy, outer, a); return svg`<path class="ui-chart-curve ui-chart-tooltip-cursor" stroke="#ccc" fill="none" d=${`M${fmt(cx)},${fmt(cy)}L${fmt(e.x)},${fmt(e.y)}`}></path>`; })
    : [];
  const actives = o.tooltip
    ? data.map((_, i) => o.radars.map((r) => {
      if (r.activeDot === false) return '';
      const q = at(r, i);
      return drawDot(typeof r.activeDot === 'object' ? r.activeDot : {}, { cx: q.x, cy: q.y, r: 4, fill: colorOf(r), stroke: '#fff', strokeWidth: 2 }, data[i], i, r.dataKey, 'ui-chart-active-dot');
    }))
    : [];
  // Hit wedges: each point owns the angles nearer to it than to its neighbours.
  const step = n ? (end - start) / n : 0;
  const hits = o.tooltip ? svg`<g data-slot="chart-hit">${angles.map((a, i) => svg`<path data-index=${String(i)} fill="transparent" d=${sectorPath({ cx, cy, innerRadius: 0, outerRadius: outer + 8, startAngle: a - step / 2, endAngle: a + step / 2 })}></path>`)}</g>` : '';
  const points: ChartPoint[] = data.map((d, i) => {
    const q = o.radars.length ? at(o.radars[0], i) : { x: cx, y: cy };
    return { label: aSpec && aSpec.dataKey ? d[aSpec.dataKey] : i, payload: o.radars.map((r) => ({ dataKey: r.dataKey, name: r.name ?? r.dataKey, value: d[r.dataKey], color: colorOf(r), payload: d })), x: q.x, y: q.y };
  });
  const body = svg`${grid}${overlay('chart-cursor', cursors, defaultIndex)}${radars}${angleAxis}${radiusAxis}${actives.length ? overlay('chart-active', actives, defaultIndex) : ''}${hits}`;
  return frame(o, { width: W, height: H, hit: 'target', body, points, margin: plot.m, plot, legend: o.radars.map((r) => ({ dataKey: r.dataKey, name: r.name ?? r.dataKey, value: r.name ?? r.dataKey, color: colorOf(r), payload: {} })) });
}

export interface ChartRadialBarOptions {
  dataKey: string;
  name?: string;
  fill?: string;
  stackId?: string;
  cornerRadius?: number;
  /** The track behind each bar: true, or its fill and classes. */
  background?: boolean | { fill?: string; class?: string };
  /** LabelLists along the bars (`insideStart`, `insideEnd`, `end`, or a cartesian position at the bar's middle). */
  labels?: ChartLabelOptions[];
  class?: string;
}

let radialLabelSeq = 0;

/** A radial bar chart: Recharts' `<RadialBarChart>` with its `<RadialBar>`s. */
export function radialBarChart(o: ChartBaseOptions & {
  bars: ChartRadialBarOptions[];
  cx?: number | string;
  cy?: number | string;
  innerRadius?: number | string;
  outerRadius?: number | string;
  startAngle?: number;
  endAngle?: number;
  barSize?: number;
  barGap?: number | string;
  barCategoryGap?: number | string;
  /** The value axis's extent, default `[0, largest value]`. */
  domain?: [number, number];
  grid?: ChartPolarGridOptions | false;
  center?: (box: ChartPolarBox) => unknown;
}) {
  const W = o.width ?? 250;
  const H = o.height ?? W;
  const plot = polarPlot(o, W, H);
  const maxR = Math.min(plot.w, plot.h) / 2;
  // The centre is a share of the whole chart (Recharts' selectPolarViewBox),
  // while the radius comes from the plot inside the margins.
  const cx = percent(o.cx, W, W / 2);
  const cy = percent(o.cy, H, H / 2);
  const inner = percent(o.innerRadius, maxR, 0);
  const outer = percent(o.outerRadius, maxR, maxR * 0.8);
  const start = o.startAngle ?? 0;
  const end = o.endAngle ?? 360;
  const data = o.data;
  const stacks = new Map<string, string[]>();
  for (const s of o.bars) if (s.stackId != null) stacks.set(s.stackId, [...(stacks.get(s.stackId) ?? []), s.dataKey]);
  const bands: Record<string, Array<[number, number]>> = {};
  for (const keys of stacks.values()) Object.assign(bands, stackData(data, keys));
  for (const s of o.bars) if (s.stackId == null) bands[s.dataKey] = data.map((d) => [0, num(d[s.dataKey])]);
  const max = Math.max(0, ...o.bars.flatMap((s) => bands[s.dataKey].map((b) => b[1])));
  const aScale = linearScale(o.domain ?? [0, max], [start, end]);
  const band = bandScale(data.length, inner, outer);
  const slotIds: string[] = [];
  for (const s of o.bars) { const id = s.stackId != null ? `stack:${s.stackId}` : `bar:${s.dataKey}`; if (!slotIds.includes(id)) slotIds.push(id); }
  const positions = barPositions(band.bandwidth, slotIds.map(() => ({ barSize: o.barSize })), o.barGap, o.barCategoryGap);
  const seq = ++radialLabelSeq;
  const points: ChartPoint[] = data.map((d, i) => ({ label: i, payload: [], x: cx, y: cy }));
  const backgrounds: unknown[] = [];
  const bars = o.bars.map((s, si) => {
    const pos = positions[slotIds.indexOf(s.stackId != null ? `stack:${s.stackId}` : `bar:${s.dataKey}`)];
    const sectors = data.map((d, i) => {
      const r0 = band.at(i) + pos.offset;
      const [lo, hi] = bands[s.dataKey][i];
      const fill = typeof d.fill === 'string' ? d.fill : s.fill ?? '#808080';
      const sec = { cx, cy, innerRadius: r0, outerRadius: r0 + pos.size, startAngle: aScale(lo), endAngle: aScale(hi), cornerRadius: s.cornerRadius, fill, datum: d, index: i };
      points[i].payload.push({ dataKey: s.dataKey, name: s.name ?? s.dataKey, value: d[s.dataKey], color: fill, payload: d });
      if (si === 0) {
        const q = polarToCartesian(cx, cy, r0 + pos.size / 2, (sec.startAngle + sec.endAngle) / 2);
        points[i].x = q.x;
        points[i].y = q.y;
      }
      if (s.background) {
        const bg = typeof s.background === 'object' ? s.background : {};
        backgrounds.push(svg`<g class="ui-chart-layer" data-index=${String(i)}><path class=${cn('ui-chart-sector ui-chart-radial-bar-background-sector', bg.class)} fill=${bg.fill ?? '#eee'} d=${sectorPath({ ...sec, startAngle: start, endAngle: end })}></path></g>`);
      }
      return sec;
    });
    const labels = (s.labels ?? []).map((l, li) => svg`<g class="ui-chart-label-list">${sectors.map((sec) => {
      const raw = sec.datum[l.dataKey ?? s.dataKey];
      const value = l.formatter ? l.formatter(raw, sec.datum, sec.index) : raw;
      const pos2 = l.position ?? 'insideStart';
      const offset = l.offset ?? 5;
      const r = (sec.innerRadius + sec.outerRadius) / 2;
      if (pos2 === 'insideStart' || pos2 === 'insideEnd' || pos2 === 'end') {
        const sign = sec.endAngle - sec.startAngle >= 0 ? 1 : -1;
        const angle = pos2 === 'insideStart' ? sec.startAngle + sign * offset : pos2 === 'insideEnd' ? sec.endAngle - sign * offset : sec.endAngle + sign * offset;
        let dir = pos2 === 'insideEnd';
        dir = sign <= 0 ? dir : !dir;
        const p0 = polarToCartesian(cx, cy, r, angle);
        const p1 = polarToCartesian(cx, cy, r, angle + (dir ? 1 : -1) * 359);
        const id = `ui-chart-radial-label-${seq}-${si}-${li}-${sec.index}`;
        return svg`<text dominant-baseline="central" fill=${l.fill ?? null} font-size=${l.fontSize != null ? `${fmt(l.fontSize / 12)}em` : null} class=${cn('ui-chart-radial-bar-label', l.class)}><defs><path id=${id} d=${`M${fmt(p0.x)},${fmt(p0.y)} A${fmt(r)},${fmt(r)},0,1,${dir ? 0 : 1},${fmt(p1.x)},${fmt(p1.y)}`}></path></defs><textPath href=${`#${id}`}>${value}</textPath></text>`;
      }
      const q = polarToCartesian(cx, cy, r, (sec.startAngle + sec.endAngle) / 2);
      return chartText(q.x, q.y, value, { anchor: 'middle', vAnchor: 'middle', class: cn('ui-chart-label', l.class), fill: l.fill, fontSize: l.fontSize });
    })}</g>`);
    return svg`<g class=${cn('ui-chart-layer ui-chart-radial-bar', s.class)}><g class="ui-chart-layer ui-chart-radial-bar-sectors">${sectors.map((sec) => svg`<g class="ui-chart-layer" data-index=${String(sec.index)}>${chartSector(sec, 'ui-chart-radial-bar-sector')}</g>`)}</g>${labels}</g>`;
  });
  // The rings sit on the bands, the spokes on the value axis's d3 ticks.
  const spokes = linearTicks(...(o.domain ?? [0, max])).map((t) => aScale(t));
  const grid = polarGrid(o.grid, cx, cy, o.grid && o.grid.polarRadius ? o.grid.polarRadius : data.map((_, i) => band.at(i) + band.bandwidth / 2), spokes, outer, inner);
  const center = o.center ? o.center({ cx, cy, innerRadius: inner, outerRadius: outer }) : '';
  return frame(o, {
    width: W, height: H, hit: 'target', body: svg`${grid}<g class="ui-chart-layer ui-chart-radial-bar-background">${backgrounds}</g>${bars}${center}`, points, margin: plot.m, plot,
    legend: data.map((d, i) => ({ dataKey: o.bars[0]?.dataKey ?? 'value', name: String(i), value: String(i), color: typeof d.fill === 'string' ? d.fill : o.bars[0]?.fill ?? '#808080', payload: d })),
  });
}
