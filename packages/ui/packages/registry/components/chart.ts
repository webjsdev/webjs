/**
 * Chart: shadcn's Chart, drawn as plain SVG by the server. Tier-2. shadcn's
 * is Recharts (D10: the kit takes no third-party runtime dependency), so
 * this file ports the parts of Recharts the shadcn charts use: the bar, area,
 * line, pie, radar and radial bar layouts, Recharts' default margins and axis
 * sizes, and shadcn's tooltip and legend markup. The maths (scales, nice
 * ticks, the d3 curves, the bar and sector paths) lives in
 * `chart-geometry.ts`, installed with it and re-exported here. Each chart function returns the whole `<ui-chart>`
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
import { WebComponent, html, svg, render } from '@webjsdev/core';
import { cn } from '../lib/utils.ts';
import {
  RADIAN, fmt, formatValue, num, percent, estimateTextWidth, niceTicks, linearScale, bandScale, pointScale,
  curvePath, rectanglePath, polarToCartesian, sectorPath, polygonPath, stackData, visibleTicks, barPositions,
  type CurveType, type Pt, type SectorGeometry, type Tick,
} from './chart-geometry.ts';

export {
  fmt, formatValue, estimateTextWidth, niceTicks, linearScale, bandScale, pointScale, curvePath,
  rectanglePath, polarToCartesian, sectorPath, polygonPath, stackData, visibleTicks, barPositions,
};
export type { CurveType, SectorGeometry, Tick };

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/** shadcn's ChartConfig: a label, and a colour or a light and dark pair, per key. */
export interface ChartConfigItem {
  label?: string;
  /** An icon for the tooltip and legend, a function returning an `html` / `svg` template. */
  icon?: () => unknown;
  color?: string;
  theme?: { light: string; dark: string };
}
export type ChartConfig = Record<string, ChartConfigItem>;

/** One row of chart data. */
export type ChartDatum = Record<string, unknown>;

export interface Margin { top: number; right: number; bottom: number; left: number }

/** One entry of a tooltip or legend payload, Recharts' shape. */
export interface ChartPayloadItem {
  dataKey: string;
  name: string;
  value: unknown;
  color: string;
  payload: ChartDatum;
  type?: 'none';
}

export interface ChartTooltipOptions {
  /** The hover cursor (a muted band behind bars, a line on lines and areas). Default true. */
  cursor?: boolean;
  /** A point shown from the first paint, Recharts' `defaultIndex`. */
  defaultIndex?: number;
  indicator?: 'dot' | 'line' | 'dashed';
  hideLabel?: boolean;
  hideIndicator?: boolean;
  nameKey?: string;
  labelKey?: string;
  labelFormatter?: (label: unknown, payload: ChartPayloadItem[]) => unknown;
  formatter?: (value: unknown, name: string, item: ChartPayloadItem, index: number, datum: ChartDatum) => unknown;
  /** One colour for every indicator, shadcn's `color`. */
  color?: string;
  class?: string;
  labelClass?: string;
}

export interface ChartLegendOptions {
  verticalAlign?: 'top' | 'bottom';
  nameKey?: string;
  hideIcon?: boolean;
  class?: string;
  /** The height the legend takes from the plot, in viewBox units. Default 28. */
  height?: number;
}

/** What every chart function takes. */
export interface ChartBaseOptions {
  config: ChartConfig;
  data: ChartDatum[];
  /** Classes for the container, shadcn's ChartContainer `className`. */
  class?: string;
  id?: string;
  /** The accessible name of the chart. */
  title?: string;
  /** Nominal size: the SVG's viewBox. */
  width?: number;
  height?: number;
  margin?: Partial<Margin>;
  tooltip?: ChartTooltipOptions | false;
  legend?: ChartLegendOptions | false;
  /** Recharts' accessibilityLayer: focus and the arrow keys. Default true. */
  accessibilityLayer?: boolean;
  /** SVG `<defs>` content, for gradients (`svg` template). */
  defs?: unknown;
}

/** The container's colour variables: `--color-<key>` per configured colour. */
export function chartStyle(config: ChartConfig): string {
  return Object.entries(config)
    .map(([key, item]) => {
      const color = item.theme ? `light-dark(${item.theme.light}, ${item.theme.dark})` : item.color;
      return color ? `--color-${key}: ${color};` : '';
    })
    .filter(Boolean)
    .join(' ');
}

// --------------------------------------------------------------------------
// Tooltip and legend content (shadcn's ChartTooltipContent / ChartLegendContent)
// --------------------------------------------------------------------------

/** shadcn's getPayloadConfigFromPayload: the config entry a payload item names. */
export function payloadConfig(config: ChartConfig, item: ChartPayloadItem | undefined, key: string): ChartConfigItem | undefined {
  if (!item) return undefined;
  let k = key;
  const own = (item as unknown as Record<string, unknown>)[key];
  if (typeof own === 'string') k = own;
  else if (typeof item.payload?.[key] === 'string') k = item.payload[key] as string;
  return k in config ? config[k] : config[key];
}

/**
 * A tooltip resolved for one point: its label and its rows, with every
 * formatter and config lookup already applied. When every part is a string
 * it is plain data, which is how the chart serves a point (see `frame`).
 */
export interface ChartTooltipView {
  label: unknown;
  items: Array<{ name: unknown; value: string | null; color: string; icon?: unknown; custom?: unknown }>;
}

/** The view options the browser needs to draw a served point. */
type TooltipLook = Pick<ChartTooltipOptions, 'indicator' | 'hideIndicator' | 'class' | 'labelClass'>;

/** Resolve a point's tooltip: shadcn's ChartTooltipContent logic, without the markup. */
export function chartTooltipView(config: ChartConfig, label: unknown, payload: ChartPayloadItem[], o: ChartTooltipOptions = {}): ChartTooltipView {
  let viewLabel: unknown = '';
  if (!o.hideLabel && payload.length) {
    const first = payload[0];
    const key = `${o.labelKey ?? first.dataKey ?? first.name ?? 'value'}`;
    const itemConfig = payloadConfig(config, first, key);
    const value = !o.labelKey && typeof label === 'string' ? (config[label]?.label ?? label) : itemConfig?.label;
    viewLabel = o.labelFormatter ? o.labelFormatter(value, payload) : (value ?? '');
  }
  const items = payload.filter((item) => item.type !== 'none').map((item, index) => {
    const key = `${o.nameKey ?? item.name ?? item.dataKey ?? 'value'}`;
    const itemConfig = payloadConfig(config, item, key);
    const color = o.color ?? (typeof item.payload?.fill === 'string' ? item.payload.fill : item.color);
    const custom = o.formatter && item.value !== undefined && item.name ? o.formatter(item.value, item.name, item, index, item.payload) : undefined;
    return {
      name: itemConfig?.label ?? item.name,
      value: item.value != null ? formatValue(item.value) : null,
      color,
      ...(itemConfig?.icon ? { icon: itemConfig.icon() } : {}),
      ...(custom !== undefined ? { custom } : {}),
    };
  });
  return { label: viewLabel, items };
}

/** A view that is all strings can be served as data and drawn in the browser. */
function isPlainView(v: ChartTooltipView): boolean {
  return typeof v.label === 'string' && v.items.every((i) => i.icon === undefined && i.custom === undefined && typeof i.name === 'string');
}

/** Draw a resolved tooltip: shadcn's ChartTooltipContent markup. */
export function chartTooltipMarkup(view: ChartTooltipView, o: TooltipLook = {}) {
  if (!view.items.length) return '';
  const indicator = o.indicator ?? 'dot';
  const tooltipLabel = view.label === '' || view.label == null ? '' : html`<div class=${cn('font-medium', o.labelClass)}>${view.label}</div>`;
  const nestLabel = view.items.length === 1 && indicator !== 'dot';
  return html`<div class=${cn('cn-chart-tooltip grid min-w-32 items-start', o.class)}>${nestLabel ? '' : tooltipLabel}<div class="grid gap-1.5">${view.items.map((item) => {
    const body = item.custom !== undefined
      ? item.custom
      : html`${item.icon !== undefined
        ? item.icon
        : o.hideIndicator
          ? ''
          : html`<div class=${cn('shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)', {
            'h-2.5 w-2.5': indicator === 'dot',
            'w-1': indicator === 'line',
            'w-0 border-[1.5px] border-dashed bg-transparent': indicator === 'dashed',
            'my-0.5': nestLabel && indicator === 'dashed',
          })} style=${`--color-bg: ${item.color}; --color-border: ${item.color}`}></div>`}<div class=${cn('flex flex-1 justify-between leading-none', nestLabel ? 'items-end' : 'items-center')}><div class="grid gap-1.5">${nestLabel ? tooltipLabel : ''}<span class="text-muted-foreground">${item.name}</span></div>${item.value != null ? html`<span class="font-mono font-medium text-foreground tabular-nums">${item.value}</span>` : ''}</div>`;
    return html`<div class=${cn('flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground', indicator === 'dot' && 'items-center')}>${body}</div>`;
  })}</div></div>`;
}

/**
 * The tooltip's content for one point: shadcn's ChartTooltipContent.
 * `label` is the point's category (a month, a date), `payload` its series.
 */
export function chartTooltipContent(config: ChartConfig, label: unknown, payload: ChartPayloadItem[], o: ChartTooltipOptions = {}) {
  return chartTooltipMarkup(chartTooltipView(config, label, payload, o), o);
}

/** The legend: shadcn's ChartLegendContent markup over a series payload. */
export function chartLegendContent(config: ChartConfig, payload: ChartPayloadItem[], o: ChartLegendOptions = {}) {
  if (!payload.length) return '';
  return html`<div class=${cn('flex items-center justify-center gap-4', o.verticalAlign === 'top' ? 'pb-3' : 'pt-3', o.class)}>${payload
    .filter((item) => item.type !== 'none')
    .map((item) => {
      const itemConfig = payloadConfig(config, item, `${o.nameKey ?? item.dataKey ?? 'value'}`);
      return html`<div class="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground">${itemConfig?.icon && !o.hideIcon
        ? itemConfig.icon()
        : html`<div class="h-2 w-2 shrink-0 rounded-[2px]" style=${`background-color: ${item.color}`}></div>`}${itemConfig?.label ?? ''}</div>`;
    })}</div>`;
}

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
  return svg`<text x=${fmt(x)} y=${fmt(y)} text-anchor=${o.anchor ?? 'middle'} fill=${o.fill ?? null} stroke=${o.stroke ?? null} font-size=${o.fontSize ?? null} alignment-baseline=${o.baseline ?? null} class=${cn('ui-chart-text', o.class)}><tspan x=${fmt(x)} dy=${DY[o.vAnchor ?? 'end']}>${value}</tspan></text>`;
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

function labelList(labels: ChartLabelOptions[] | undefined, seriesKey: string, items: Array<{ box: { x: number; y: number; width: number; height: number }; datum: ChartDatum; index: number }>, fallbackPosition: LabelPosition) {
  if (!labels?.length) return '';
  return labels.map((l) => svg`<g class="ui-chart-label-list">${items.map(({ box, datum, index }) => {
    const raw = datum[l.dataKey ?? seriesKey];
    const value = l.formatter ? l.formatter(raw, datum, index) : raw;
    if (l.content) return l.content({ ...box, value, datum, index });
    const a = cartesianLabelAttrs(box, l.position ?? fallbackPosition, l.offset ?? 5);
    return chartText(a.x, a.y, value, { anchor: a.anchor, vAnchor: a.vAnchor, class: cn('ui-chart-label', l.class), fill: l.fill, stroke: l.stroke, fontSize: l.fontSize });
  })}</g>`);
}

// --------------------------------------------------------------------------
// The container (shadcn's ChartContainer) and the tooltip layer
// --------------------------------------------------------------------------

/** shadcn's ChartContainer classes, its `[&_.recharts-*]` rules renamed to the `ui-chart-*` parts. */
export function chartContainerClass(): string {
  return "cn-chart flex aspect-video justify-center text-xs [&_.ui-chart-cartesian-axis-tick_text]:fill-muted-foreground [&_.ui-chart-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.ui-chart-curve.ui-chart-tooltip-cursor]:stroke-border [&_.ui-chart-dot[stroke='#fff']]:stroke-transparent [&_.ui-chart-layer]:outline-hidden [&_.ui-chart-polar-grid_[stroke='#ccc']]:stroke-border [&_.ui-chart-radial-bar-background-sector]:fill-muted [&_.ui-chart-rectangle.ui-chart-tooltip-cursor]:fill-muted [&_.ui-chart-reference-line_[stroke='#ccc']]:stroke-border [&_.ui-chart-sector]:outline-hidden [&_.ui-chart-sector[stroke='#fff']]:stroke-transparent [&_.ui-chart-surface]:outline-hidden";
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
}

function legendLayer(o: ChartBaseOptions, f: Frame) {
  if (!o.legend) return '';
  const h = o.legend.height ?? 28;
  const top = o.legend.verticalAlign === 'top';
  const y = top ? f.margin.top : f.height - f.margin.bottom - h;
  return svg`<foreignObject class="ui-chart-legend-wrapper" x=${fmt(f.margin.left)} y=${fmt(y)} width=${fmt(f.width - f.margin.left - f.margin.right)} height=${fmt(h)}>${chartLegendContent(o.config, f.legend, o.legend)}</foreignObject>`;
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
  return html`<ui-chart data-slot="chart" data-chart=${o.id ?? null} class=${cn(base, o.class)} style=${chartStyle(o.config) || null}><div class="ui-chart-wrapper relative h-full w-full min-w-0"><svg class="ui-chart-surface block h-full w-full" xmlns="http://www.w3.org/2000/svg" viewBox=${`0 0 ${fmt(f.width)} ${fmt(f.height)}`} role="img" aria-label=${o.title ?? null} data-hit=${t ? f.hit : null} data-keyboard=${t && a11y ? 'true' : null} data-default-index=${def ? String(t?.defaultIndex) : null}>${o.defs ? svg`<defs>${o.defs}</defs>` : ''}${f.body}${legendLayer(o, f)}</svg>${t ? html`<div data-slot="chart-tooltip" class="ui-chart-tooltip-wrapper pointer-events-none absolute top-0 left-0 z-10 [transition:transform_400ms]" ?hidden=${!def} style=${def ? `transform: translate(${fmt(def.x + 10)}px, ${fmt(def.y + 10)}px)` : null}>${def && t && t.defaultIndex != null ? chartTooltipMarkup(views[t.defaultIndex], look) : ''}</div><div data-slot="chart-tooltips" hidden data-look=${JSON.stringify(look)}>${views.map((v, i) => (isPlainView(v)
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
  class?: string;
}

export interface ChartDotOptions { r?: number; fill?: string; stroke?: string; strokeWidth?: number; fillOpacity?: number; class?: string }
export type ChartDotRender = (props: { cx: number; cy: number; r: number; fill: string; stroke: string; datum: ChartDatum; index: number; dataKey: string }) => unknown;

export interface ChartBarShapeProps {
  x: number; y: number; width: number; height: number;
  radius: number | number[]; fill: string; datum: ChartDatum; index: number; dataKey: string;
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
  const vScale = vertical ? linearScale(domain, [plot.x, plot.x + plot.w]) : linearScale(domain, [plot.y + plot.h, plot.y]);

  // Categories: bands under bars, points under lines and areas.
  const pad = catSpec?.padding ?? {};
  const c0 = vertical ? plot.y + (pad.top ?? 0) : plot.x + (pad.left ?? 0);
  const c1 = vertical ? plot.y + plot.h - (pad.bottom ?? 0) : plot.x + plot.w - (pad.right ?? 0);
  const band = bandScale(data.length, c0, c1);
  const point = pointScale(data.length, c0, c1);
  const catAt = (i: number) => (family === 'bar' ? band.at(i) + band.bandwidth / 2 : point(i));
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
        const a = band.at(i);
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
  const anchors: Array<{ x: number; y: number } | null> = data.map(() => null);

  const marks = series.map((s) => {
    const sb = bands[s.dataKey];
    if (family === 'bar') {
      const pos = positions[slotIds.indexOf(s.stackId != null ? `stack:${s.stackId}` : `bar:${s.dataKey}`)];
      const boxes = data.map((d, i) => {
        const [lo, hi] = sb[i];
        const a = band.at(i) + pos.offset;
        const box = vertical
          ? { x: vScale(lo), y: a, width: vScale(hi) - vScale(lo), height: pos.size }
          : { x: a, y: vScale(hi), width: pos.size, height: vScale(lo) - vScale(hi) };
        if (!anchors[i]) anchors[i] = vertical ? { x: box.x + box.width, y: catAt(i) } : { x: catAt(i), y: box.y };
        return { box, datum: d, index: i };
      });
      return svg`<g class=${cn('ui-chart-layer ui-chart-bar', s.class)}><g class="ui-chart-layer ui-chart-bar-rectangles">${boxes.map(({ box, datum, index }) => {
        const fill = typeof datum.fill === 'string' ? datum.fill : s.fill ?? '#808080';
        const active = s.activeIndex === index ? s.activeBar ?? {} : null;
        const shape = s.shape
          ? s.shape({ ...box, radius: s.radius ?? 0, fill, datum, index, dataKey: s.dataKey })
          : svg`<path class="ui-chart-rectangle" fill=${active?.fill ?? fill} fill-opacity=${active?.fillOpacity ?? s.fillOpacity ?? null} stroke=${active?.stroke ?? s.stroke ?? null} stroke-width=${active?.strokeWidth ?? s.strokeWidth ?? null} stroke-dasharray=${active?.strokeDasharray ?? null} stroke-dashoffset=${active?.strokeDashoffset ?? null} d=${rectanglePath(box.x, box.y, box.width, box.height, s.radius ?? 0)}></path>`;
        return svg`<g class="ui-chart-layer ui-chart-bar-rectangle" data-index=${String(index)}>${shape}</g>`;
      })}</g>${labelList(s.labels, s.dataKey, boxes, 'center')}</g>`;
    }
    const top = data.map((_, i): Pt => (vertical ? [vScale(sb[i][1]), catAt(i)] : [catAt(i), vScale(sb[i][1])]));
    top.forEach((p, i) => { if (!anchors[i]) anchors[i] = { x: p[0], y: p[1] }; });
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
    const shown = spec.tick === false ? [] : visibleTicks(ticks, size, which === 'x' ? 0 : 0, which === 'x' ? W : H, spec.minTickGap ?? 5, spec.interval ?? 'preserveEnd');
    const tickSize = spec.tickSize ?? 6;
    const margin2 = spec.tickMargin ?? 2;
    const edge = which === 'x' ? plot.y + plot.h : plot.x;
    const line = spec.axisLine === false ? '' : which === 'x'
      ? svg`<line class="ui-chart-cartesian-axis-line" stroke="#666" fill="none" x1=${fmt(plot.x)} y1=${fmt(edge)} x2=${fmt(plot.x + plot.w)} y2=${fmt(edge)}></line>`
      : svg`<line class="ui-chart-cartesian-axis-line" stroke="#666" fill="none" x1=${fmt(edge)} y1=${fmt(plot.y)} x2=${fmt(edge)} y2=${fmt(plot.y + plot.h)}></line>`;
    return svg`<g class=${cn('ui-chart-layer ui-chart-cartesian-axis', which === 'x' ? 'ui-chart-xAxis' : 'ui-chart-yAxis', spec.class)}>${line}<g class="ui-chart-cartesian-axis-ticks">${shown.map((t) => {
      const at = t.at ?? t.coord;
      const tl = spec.tickLine === false ? '' : which === 'x'
        ? svg`<line class="ui-chart-cartesian-axis-tick-line" stroke="#666" fill="none" x1=${fmt(at)} y1=${fmt(edge + tickSize)} x2=${fmt(at)} y2=${fmt(edge)}></line>`
        : svg`<line class="ui-chart-cartesian-axis-tick-line" stroke="#666" fill="none" x1=${fmt(edge - tickSize)} y1=${fmt(at)} x2=${fmt(edge)} y2=${fmt(at)}></line>`;
      const text = which === 'x'
        ? chartText(at, edge + tickSize + margin2, t.label, { anchor: 'middle', vAnchor: 'start', fill: '#666', class: 'ui-chart-cartesian-axis-tick-value' })
        : chartText(edge - tickSize - margin2, at, t.label, { anchor: 'end', vAnchor: 'middle', fill: '#666', class: 'ui-chart-cartesian-axis-tick-value' });
      return svg`<g class="ui-chart-layer ui-chart-cartesian-axis-tick">${tl}${text}</g>`;
    })}</g></g>`;
  };

  // Tooltip points: the series at each row, anchored on the first series' value.
  const points: ChartPoint[] = data.map((d, i) => ({
    label: categories[i],
    payload: series.map((s) => ({ dataKey: s.dataKey, name: s.name ?? s.dataKey, value: d[s.dataKey], color: color(s), payload: d })),
    x: anchors[i]?.x ?? catAt(i),
    y: anchors[i]?.y ?? plot.y + plot.h / 2,
  }));

  const body = svg`${grid}${overlay('chart-cursor', cursors, defaultIndex)}${marks}${axis('x')}${axis('y')}${actives.length ? overlay('chart-active', actives, defaultIndex) : ''}`;
  return frame(o, {
    width: W, height: H, hit: vertical ? 'y' : 'x', body, points, margin,
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
      if (p === o.pies[0]) legend.push(item);
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
  return frame(o, { width: W, height: H, hit: 'target', body: rings, points, legend, margin: plot.m });
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

function polarGrid(g: ChartPolarGridOptions | false | undefined, cx: number, cy: number, radii: number[], angles: number[], outer: number) {
  if (!g) return '';
  const ring = (r: number) => (g.gridType === 'circle'
    ? svg`<circle class=${cn('ui-chart-polar-grid-concentric-circle', g.class)} stroke=${g.stroke ?? '#ccc'} stroke-width=${g.strokeWidth ?? null} fill=${g.fill ?? 'none'} cx=${fmt(cx)} cy=${fmt(cy)} r=${fmt(r)}></circle>`
    : svg`<path class=${cn('ui-chart-polar-grid-concentric-polygon', g.class)} stroke=${g.stroke ?? '#ccc'} stroke-width=${g.strokeWidth ?? null} fill=${g.fill ?? 'none'} d=${polygonPath(angles.map((a) => polarToCartesian(cx, cy, r, a)))}></path>`);
  return svg`<g class="ui-chart-polar-grid"><g class="ui-chart-polar-grid-concentric">${radii.map(ring)}</g>${g.radialLines === false ? '' : svg`<g class="ui-chart-polar-grid-angle">${angles.map((a) => {
    const e = polarToCartesian(cx, cy, outer, a);
    return svg`<line class=${cn('ui-chart-polar-grid-angle-line', g.class)} stroke=${g.stroke ?? '#ccc'} x1=${fmt(cx)} y1=${fmt(cy)} x2=${fmt(e.x)} y2=${fmt(e.y)}></line>`;
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
  const cx = plot.x + percent(o.cx, plot.w, plot.w / 2);
  const cy = plot.y + percent(o.cy, plot.h, plot.h / 2);
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
  return frame(o, { width: W, height: H, hit: 'target', body, points, margin: plot.m, legend: o.radars.map((r) => ({ dataKey: r.dataKey, name: r.name ?? r.dataKey, value: r.name ?? r.dataKey, color: colorOf(r), payload: {} })) });
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
  const cx = plot.x + percent(o.cx, plot.w, plot.w / 2);
  const cy = plot.y + percent(o.cy, plot.h, plot.h / 2);
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
        let dir = pos2 === 'insideEnd' ? false : true;
        dir = sign <= 0 ? dir : !dir;
        const p0 = polarToCartesian(cx, cy, r, angle);
        const p1 = polarToCartesian(cx, cy, r, angle + (dir ? 1 : -1) * 359);
        const id = `ui-chart-radial-label-${seq}-${si}-${li}-${sec.index}`;
        return svg`<text dominant-baseline="central" fill=${l.fill ?? null} font-size=${l.fontSize ?? null} class=${cn('ui-chart-radial-bar-label', l.class)}><defs><path id=${id} d=${`M${fmt(p0.x)},${fmt(p0.y)} A${fmt(r)},${fmt(r)},0,1,${dir ? 0 : 1},${fmt(p1.x)},${fmt(p1.y)}`}></path></defs><textPath href=${`#${id}`}>${value}</textPath></text>`;
      }
      const q = polarToCartesian(cx, cy, r, (sec.startAngle + sec.endAngle) / 2);
      return chartText(q.x, q.y, value, { anchor: 'middle', vAnchor: 'middle', class: cn('ui-chart-label', l.class), fill: l.fill, fontSize: l.fontSize });
    })}</g>`);
    return svg`<g class=${cn('ui-chart-layer ui-chart-radial-bar', s.class)}><g class="ui-chart-layer ui-chart-radial-bar-sectors">${sectors.map((sec) => svg`<g class="ui-chart-layer" data-index=${String(sec.index)}>${chartSector(sec, 'ui-chart-radial-bar-sector')}</g>`)}</g>${labels}</g>`;
  });
  const grid = polarGrid(o.grid, cx, cy, o.grid && o.grid.polarRadius ? o.grid.polarRadius : data.map((_, i) => band.at(i) + band.bandwidth / 2), [], outer);
  const center = o.center ? o.center({ cx, cy, innerRadius: inner, outerRadius: outer }) : '';
  return frame(o, {
    width: W, height: H, hit: 'target', body: svg`${grid}<g class="ui-chart-layer ui-chart-radial-bar-background">${backgrounds}</g>${bars}${center}`, points, margin: plot.m,
    legend: data.map((d, i) => ({ dataKey: o.bars[0]?.dataKey ?? 'value', name: String(i), value: d[o.bars[0]?.dataKey ?? 'value'], color: typeof d.fill === 'string' ? d.fill : o.bars[0]?.fill ?? '#808080', payload: d })),
  });
}

// --------------------------------------------------------------------------
// The element adds the tooltip, cursor and active marks, by pointer and keyboard
// --------------------------------------------------------------------------

export class UiChart extends WebComponent {
  /** The point showing, or -1. */
  activeIndex = -1;

  connectedCallback(): void {
    super.connectedCallback?.();
    this.addEventListener('pointermove', this._onMove);
    this.addEventListener('pointerleave', this._onLeave);
    this.addEventListener('focusin', this._onFocus);
    this.addEventListener('focusout', this._onBlur);
    this.addEventListener('keydown', this._onKey);
  }

  firstUpdated(): void {
    // A chart rendered on the client commits its attributes after the
    // element connects, so a first attempt can find the SVG unfinished.
    if (!this._init()) requestAnimationFrame(() => this._init());
  }

  disconnectedCallback(): void {
    this.removeEventListener('pointermove', this._onMove);
    this.removeEventListener('pointerleave', this._onLeave);
    this.removeEventListener('focusin', this._onFocus);
    this.removeEventListener('focusout', this._onBlur);
    this.removeEventListener('keydown', this._onKey);
    super.disconnectedCallback?.();
  }

  render() {
    return html`<slot></slot>`;
  }

  _svg(): SVGSVGElement | null {
    return typeof this.querySelector === 'function' ? this.querySelector<SVGSVGElement>('svg.ui-chart-surface') : null;
  }

  _entries(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>('[data-slot="chart-tooltips"] > [data-index]'));
  }

  _look(): TooltipLook {
    const raw = this.querySelector<HTMLElement>('[data-slot="chart-tooltips"]')?.dataset.look;
    return raw ? (JSON.parse(raw) as TooltipLook) : {};
  }

  _init(): boolean {
    const s = this._svg();
    if (!s || !s.dataset.hit) return false;
    if (s.dataset.keyboard === 'true') {
      s.setAttribute('tabindex', '0');
      s.setAttribute('role', 'application');
      s.setAttribute('aria-roledescription', 'chart');
    }
    const d = s.dataset.defaultIndex;
    if (d != null) this.show(Number(d));
    return true;
  }

  /** Where a point's tooltip anchors, in pixels from the chart's wrapper. */
  _anchor(i: number): { x: number; y: number } | null {
    const s = this._svg();
    const e = this._entries()[i];
    const m = s?.getScreenCTM?.();
    const wrap = s?.parentElement;
    if (!s || !e || !m || !wrap) return null;
    const r = wrap.getBoundingClientRect();
    const x = Number(e.dataset.x);
    const y = Number(e.dataset.y);
    return { x: m.a * x + m.c * y + m.e - r.left, y: m.b * x + m.d * y + m.f - r.top };
  }

  /** Show point `i`, its tooltip at `at` (pixels from the wrapper) or at its anchor. */
  show(i: number, at?: { x: number; y: number }): void {
    const entry = this._entries()[i];
    const wrapper = this.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
    if (!entry || !wrapper) return;
    for (const g of this.querySelectorAll('[data-slot="chart-cursor"] > [data-index], [data-slot="chart-active"] > [data-index]')) {
      g.setAttribute('visibility', g.getAttribute('data-index') === String(i) ? 'visible' : 'hidden');
    }
    if (i !== this.activeIndex || wrapper.hidden || !wrapper.firstChild) {
      const tip = entry.dataset.tip;
      if (tip) {
        // A served point is data: draw it with the same markup the server uses.
        const box = document.createElement('div');
        render(chartTooltipMarkup(JSON.parse(tip) as ChartTooltipView, this._look()), box);
        wrapper.replaceChildren(...Array.from(box.childNodes));
      } else {
        wrapper.replaceChildren(...Array.from(entry.cloneNode(true).childNodes));
      }
    }
    this.activeIndex = i;
    wrapper.hidden = false;
    const p = at ?? this._anchor(i);
    if (!p) return;
    const box = wrapper.parentElement;
    const W = box?.clientWidth ?? 0;
    const H = box?.clientHeight ?? 0;
    let x = p.x + 10;
    let y = p.y + 10;
    if (x + wrapper.offsetWidth > W) x = Math.max(0, p.x - wrapper.offsetWidth - 10);
    if (y + wrapper.offsetHeight > H) y = Math.max(0, p.y - wrapper.offsetHeight - 10);
    wrapper.style.transform = `translate(${x}px, ${y}px)`;
  }

  /** Hide the tooltip and the marks. */
  hide(): void {
    const wrapper = this.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
    if (wrapper) wrapper.hidden = true;
    for (const g of this.querySelectorAll('[data-slot="chart-cursor"] > [data-index], [data-slot="chart-active"] > [data-index]')) g.setAttribute('visibility', 'hidden');
    this.activeIndex = -1;
  }

  _announce(i: number): void {
    const live = this.querySelector<HTMLElement>('[data-slot="chart-live"]');
    const entry = this._entries()[i];
    if (!live || !entry) return;
    const tip = entry.dataset.tip ? (JSON.parse(entry.dataset.tip) as ChartTooltipView) : null;
    const text = tip
      ? [tip.label, ...tip.items.map((it) => `${it.name} ${it.value ?? ''}`)].join(' ')
      : entry.textContent ?? '';
    live.textContent = text.replace(/\s+/g, ' ').trim();
  }

  _onMove = (e: PointerEvent): void => {
    const s = this._svg();
    if (!s || !s.dataset.hit || !s.parentElement) return;
    const wrap = s.parentElement.getBoundingClientRect();
    const at = { x: e.clientX - wrap.left, y: e.clientY - wrap.top };
    let index = -1;
    if (s.dataset.hit === 'target') {
      const t = (e.target as Element | null)?.closest?.('[data-index]');
      if (t && s.contains(t)) index = Number(t.getAttribute('data-index'));
    } else {
      const m = s.getScreenCTM?.();
      if (!m) return;
      const inv = m.inverse();
      const v = s.dataset.hit === 'y'
        ? inv.b * e.clientX + inv.d * e.clientY + inv.f
        : inv.a * e.clientX + inv.c * e.clientY + inv.e;
      const axis = s.dataset.hit === 'y' ? 'y' : 'x';
      let best = Infinity;
      this._entries().forEach((en, i) => {
        const d = Math.abs(Number(en.dataset[axis]) - v);
        if (d < best) { best = d; index = i; }
      });
    }
    if (index < 0) this.hide();
    else this.show(index, at);
  };

  _onLeave = (): void => {
    if (!this.contains(document.activeElement)) this.hide();
  };

  _onFocus = (e: FocusEvent): void => {
    if (e.target !== this._svg()) return;
    const i = this.activeIndex >= 0 ? this.activeIndex : 0;
    this.show(i);
    this._announce(i);
  };

  _onBlur = (e: FocusEvent): void => {
    if (e.target === this._svg()) this.hide();
  };

  _onKey = (e: KeyboardEvent): void => {
    if (e.target !== this._svg()) return;
    const n = this._entries().length;
    if (!n) return;
    const cur = this.activeIndex;
    let next = cur;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(n - 1, cur + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, cur - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (e.key === 'Escape') { this.hide(); return; }
    else return;
    e.preventDefault();
    this.show(next);
    this._announce(next);
  };
}
UiChart.register('ui-chart');
