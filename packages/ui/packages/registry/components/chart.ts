import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Chart — SVG-native shadcn-compatible chart primitives.
 *
 * Shadcn ships its chart on top of Recharts (React-only). The web-components
 * port hand-rolls equivalent SVG output so the same `chartConfig` API works
 * and the same Tailwind class names line up for user overrides.
 *
 * Public components:
 *   <ui-chart-container config="..." id="...">
 *     <ui-chart type="line|bar|area|pie|radial"
 *               data='[...]' data-key="month"
 *               series='[{"key":"sales"},{"key":"profit"}]'></ui-chart>
 *     <ui-chart-tooltip><ui-chart-tooltip-content/></ui-chart-tooltip>
 *     <ui-chart-legend><ui-chart-legend-content/></ui-chart-legend>
 *   </ui-chart-container>
 *
 * The container still injects `--color-<key>` CSS variables sourced from
 * `config`, so SVG marks can `fill: var(--color-sales)` etc. The new
 * <ui-chart> element renders the actual SVG using pure path/rect/line
 * primitives — no D3, no Recharts, no external chart library.
 *
 * Implemented in v2: gradient fills (per-series `gradient: true`),
 * brush selection (set `brush` on the chart — emits `ui-chart-brush`),
 * animation transitions on data change (path `d` / rect height/y via CSS
 * transitions, ~300ms), and secondary Y axis (per-series `secondaryYKey`
 * or shared `axis: 'right'`).
 *
 * Implemented in v2.1: pie/radial animation. Arc `d` strings aren't
 * linearly interpolable, so CSS transitions don't work. Instead we
 * hand-roll a 300ms requestAnimationFrame loop that tweens the
 * underlying angle values (pie) or pct values (radial) with an
 * ease-out cubic, rebuilding the `d` attribute every frame. Any
 * in-flight animation is cancelled when new data arrives.
 *
 * Deferred for v3: mixed series types in one chart, hierarchical / sankey,
 * treemap.
 */

type ChartConfigEntry = {
  label?: string;
  icon?: string; // SVG markup
  color?: string;
  theme?: { light: string; dark: string };
};
export type ChartConfig = Record<string, ChartConfigEntry>;

export type ChartSeries = {
  key: string;
  label?: string;
  color?: string;
  stackId?: string;
  /** Render area/bar fills as a top→transparent linear gradient. */
  gradient?: boolean;
  /** Pin series to the right (secondary) Y axis — gets its own scale. */
  axis?: 'left' | 'right';
};

export type ChartDatum = Record<string, number | string>;

let chartIdCounter = 0;

/* --------------------------------------------------------------------- *
 * <ui-chart-container>                                                  *
 * --------------------------------------------------------------------- */

export class UiChartContainer extends WebComponent {
  static properties = {
    chartId: { type: String, attribute: 'chart-id', reflect: true },
    config: { type: Object, converter: { fromAttribute: (s: string | null) => {
      if (!s) return {};
      try { return JSON.parse(s); } catch { return {}; }
    }, toAttribute: (v: unknown) => JSON.stringify(v ?? {}) } },
  };
  declare chartId: string;
  declare config: ChartConfig;

  private _slot = '';

  constructor() {
    super();
    this.chartId = `chart-${++chartIdCounter}`;
    this.config = {};
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  _styleBlock(): string {
    if (!this.config || !Object.keys(this.config).length) return '';
    const lightRules: string[] = [];
    const darkRules: string[] = [];
    for (const [key, v] of Object.entries(this.config)) {
      const lightColor = v.theme?.light ?? v.color;
      const darkColor = v.theme?.dark ?? v.color;
      if (lightColor) lightRules.push(`--color-${key}: ${lightColor};`);
      if (darkColor) darkRules.push(`--color-${key}: ${darkColor};`);
    }
    return `
[data-chart="${this.chartId}"] {
${lightRules.join('\n')}
}
.dark [data-chart="${this.chartId}"] {
${darkRules.join('\n')}
}`;
  }

  render() {
    return html`
      <style>${this._styleBlock()}</style>
      <div
        data-slot="chart"
        data-chart=${this.chartId}
        role="img"
        class=${cn(
          'flex aspect-video justify-center text-xs relative',
          '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
          '[&_.recharts-cartesian-grid_line]:stroke-border/50',
          '[&_.recharts-tooltip-cursor]:stroke-border',
          '[&_.recharts-radial-bar-background-sector]:fill-muted',
        )}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiChartContainer.register('ui-chart-container');

/* --------------------------------------------------------------------- *
 * <ui-chart> — pure SVG renderer                                        *
 * --------------------------------------------------------------------- */

const VB_W = 600;
const VB_H = 300;
const PAD_L = 40;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;
const PLOT_W = VB_W - PAD_L - PAD_R;
const PLOT_H = VB_H - PAD_T - PAD_B;
const BRUSH_H = 32;

function safeJSON<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function num(v: number | string): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(range / count)));
  const err = (range / count) / step;
  const niceStep = err >= 7.5 ? step * 10 : err >= 3 ? step * 5 : err >= 1.5 ? step * 2 : step;
  const ticks: number[] = [];
  const start = Math.floor(min / niceStep) * niceStep;
  const end = Math.ceil(max / niceStep) * niceStep;
  for (let v = start; v <= end + niceStep / 2; v += niceStep) ticks.push(+v.toFixed(10));
  return ticks;
}

function fmtTick(n: number): string {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Catmull-Rom → cubic Bezier path for smooth curves.
function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0][0]},${pts[0][1]} L ${pts[1][0]},${pts[1][1]}`;
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function linePath(pts: Array<[number, number]>): string {
  if (!pts.length) return '';
  return 'M ' + pts.map((p) => `${p[0]},${p[1]}`).join(' L ');
}

function seriesColor(s: ChartSeries): string {
  return s.color ?? `var(--color-${s.key})`;
}

type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'radial';

export class UiChart extends WebComponent {
  static properties = {
    type: { type: String, reflect: true },
    data: { type: Array, converter: { fromAttribute: (s: string | null) => safeJSON<ChartDatum[]>(s, []) , toAttribute: (v: unknown) => JSON.stringify(v ?? []) } },
    dataKey: { type: String, attribute: 'data-key' },
    series: { type: Array, converter: { fromAttribute: (s: string | null) => safeJSON<ChartSeries[]>(s, []), toAttribute: (v: unknown) => JSON.stringify(v ?? []) } },
    layout: { type: String }, // 'grouped' | 'stacked' for bar/area
    curve: { type: String },  // 'linear' | 'smooth' for line/area
    innerRadius: { type: Number, attribute: 'inner-radius' },
    brush: { type: Boolean, reflect: true },
    animate: { type: Boolean, reflect: true },
  };
  declare type: ChartType;
  declare data: ChartDatum[];
  declare dataKey: string;
  declare series: ChartSeries[];
  declare layout: 'grouped' | 'stacked';
  declare curve: 'linear' | 'smooth';
  declare innerRadius: number;
  declare brush: boolean;
  declare animate: boolean;

  state: {
    hovered: number | null;
    hidden: Record<string, boolean>;
    brushStart: number;
    brushEnd: number;
  } = { hovered: null, hidden: {}, brushStart: 0, brushEnd: 1 };
  private _raf = 0;
  private _uid = `c${++chartIdCounter}`;
  private _brushDrag: { handle: 'left' | 'right' | 'window'; pointerId: number; startX: number; startBS: number; startBE: number } | null = null;

  // ---- pie / radial animation state -----------------------------------
  // CSS `transition: d 300ms` doesn't tween correctly for arc paths
  // because path commands aren't linearly interpolable. Instead we
  // hand-roll a rAF loop that interpolates the angles per slice and
  // rebuilds the `d` attribute each frame.
  private _animRaf = 0;
  /** Previous arc snapshot, keyed by slice index. */
  private _prevPieArcs: Array<{ a0: number; a1: number }> | null = null;
  private _prevRadialArcs: Array<{ pct: number }> | null = null;
  /** Interpolated values used by the current frame's render(). */
  private _pieArcsFrame: Array<{ a0: number; a1: number }> | null = null;
  private _radialArcsFrame: Array<{ pct: number }> | null = null;

  constructor() {
    super();
    this.type = 'line';
    this.data = [];
    this.dataKey = 'name';
    this.series = [];
    this.layout = 'grouped';
    this.curve = 'linear';
    this.innerRadius = 0;
    this.brush = false;
    this.animate = true;
  }

  firstUpdated() {
    const svg = this.querySelector('svg[data-chart-svg]') as SVGSVGElement | null;
    if (!svg) return;
    svg.addEventListener('pointermove', (e) => this._onPointerMove(e));
    svg.addEventListener('pointerleave', () => this._onPointerLeave());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._animRaf) cancelAnimationFrame(this._animRaf);
    this._raf = 0;
    this._animRaf = 0;
  }

  _onPointerMove(e: PointerEvent) {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this._handleHover(e));
  }

  _onPointerLeave() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this.setState({ hovered: null });
    this.dispatchEvent(new CustomEvent('ui-chart-hover', {
      detail: { index: null, x: 0, y: 0, data: null }, bubbles: true, composed: true,
    }));
  }

  _handleHover(e: PointerEvent) {
    if (!this.data.length || this.type === 'pie' || this.type === 'radial') return;
    const data = this._visibleData();
    if (!data.length) return;
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VB_W;
    // Skip hover when the pointer is over the brush strip.
    if (this.brush && px > 0 && (((e.clientY - rect.top) / rect.height) * this._vbH()) > VB_H) return;
    const stepX = data.length > 1 ? PLOT_W / (data.length - 1) : 0;
    const xRel = px - PAD_L;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(xRel / (stepX || 1))));
    if (idx === this.state.hovered) return;
    this.setState({ hovered: idx });
    this.dispatchEvent(new CustomEvent('ui-chart-hover', {
      detail: { index: idx, x: e.clientX, y: e.clientY, data: data[idx] },
      bubbles: true, composed: true,
    }));
  }

  _toggleSeries(key: string) {
    const hidden = { ...this.state.hidden, [key]: !this.state.hidden[key] };
    this.setState({ hidden });
  }

  // ------- Scale helpers -------

  /** Data slice currently visible — when `brush` is on, this is a subset. */
  _visibleData(): ChartDatum[] {
    if (!this.brush || this.data.length < 2) return this.data;
    const n = this.data.length;
    const lo = Math.max(0, Math.min(n - 1, Math.floor(this.state.brushStart * (n - 1))));
    const hi = Math.max(lo + 1, Math.min(n, Math.ceil(this.state.brushEnd * (n - 1)) + 1));
    return this.data.slice(lo, hi);
  }

  _xPos(i: number, n: number): number {
    if (n <= 1) return PAD_L + PLOT_W / 2;
    return PAD_L + (i / (n - 1)) * PLOT_W;
  }

  _yRange(seriesFilter?: (s: ChartSeries) => boolean): { min: number; max: number; ticks: number[] } {
    const filter = seriesFilter ?? (() => true);
    const vals: number[] = [];
    const data = this._visibleData();
    const isStacked = this.layout === 'stacked' && (this.type === 'bar' || this.type === 'area');
    if (isStacked) {
      for (const row of data) {
        let sumPos = 0, sumNeg = 0;
        for (const s of this._activeSeries()) {
          if (!filter(s)) continue;
          const v = num(row[s.key]);
          if (v >= 0) sumPos += v; else sumNeg += v;
        }
        vals.push(sumPos, sumNeg);
      }
    } else {
      for (const row of data) for (const s of this._activeSeries()) {
        if (!filter(s)) continue;
        vals.push(num(row[s.key]));
      }
    }
    let min = vals.length ? Math.min(...vals) : 0;
    let max = vals.length ? Math.max(...vals) : 1;
    if (min > 0) min = 0;
    if (max < 0) max = 0;
    if (min === max) { min -= 1; max += 1; }
    const ticks = niceTicks(min, max, 5);
    return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
  }

  _hasSecondaryAxis(): boolean {
    return this._activeSeries().some((s) => s.axis === 'right');
  }

  _yPos(v: number, min: number, max: number): number {
    if (max === min) return PAD_T + PLOT_H / 2;
    return PAD_T + (1 - (v - min) / (max - min)) * PLOT_H;
  }

  _activeSeries(): ChartSeries[] {
    return this.series.filter((s) => !this.state.hidden[s.key]);
  }

  _activeSeriesFor(axis: 'left' | 'right'): ChartSeries[] {
    return this._activeSeries().filter((s) => (s.axis ?? 'left') === axis);
  }

  /** Y position for a series value — picks the series' own axis scale. */
  _yPosFor(s: ChartSeries, v: number, leftMin: number, leftMax: number, rightMin: number, rightMax: number): number {
    if ((s.axis ?? 'left') === 'right') return this._yPos(v, rightMin, rightMax);
    return this._yPos(v, leftMin, leftMax);
  }

  // ------- Axis + grid -------

  _renderAxes(yMin: number, yMax: number, ticks: number[], rightAxis?: { min: number; max: number; ticks: number[] }) {
    const data = this._visibleData();
    const yTickEls = ticks.map((t) => {
      const y = this._yPos(t, yMin, yMax);
      return html`
        <line x1=${PAD_L} y1=${y} x2=${PAD_L + PLOT_W} y2=${y}
              class="recharts-cartesian-grid_line" stroke="currentColor" stroke-opacity="0.15" stroke-dasharray="3 3" />
        <text x=${PAD_L - 8} y=${y + 4} text-anchor="end" class="recharts-cartesian-axis-tick_text fill-muted-foreground" font-size="11">${fmtTick(t)}</text>
      `;
    });
    const rightTickEls = rightAxis
      ? rightAxis.ticks.map((t) => {
          const y = this._yPos(t, rightAxis.min, rightAxis.max);
          return html`
            <text x=${PAD_L + PLOT_W + 8} y=${y + 4} text-anchor="start" class="recharts-cartesian-axis-tick_text fill-muted-foreground recharts-axis-right" font-size="11">${fmtTick(t)}</text>
          `;
        })
      : [];
    const xTickEls = data.map((row, i) => {
      const x = this._xPos(i, data.length);
      return html`
        <text x=${x} y=${PAD_T + PLOT_H + 18} text-anchor="middle" class="recharts-cartesian-axis-tick_text fill-muted-foreground" font-size="11">${String(row[this.dataKey] ?? '')}</text>
      `;
    });
    return html`
      <g class="recharts-cartesian-grid">${yTickEls}</g>
      ${rightAxis ? html`<g class="recharts-cartesian-axis recharts-cartesian-axis-y-right">${rightTickEls}</g>` : html``}
      <g class="recharts-cartesian-axis recharts-cartesian-axis-x">${xTickEls}</g>
    `;
  }

  // ------- Gradient defs -------

  _renderDefs() {
    const gradients = this._activeSeries()
      .filter((s) => s.gradient)
      .map((s) => {
        const id = `grad-${s.key}-${this._uid}`;
        const color = seriesColor(s);
        return html`
          <linearGradient id=${id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color=${color} stop-opacity="0.8" />
            <stop offset="100%" stop-color=${color} stop-opacity="0.05" />
          </linearGradient>
        `;
      });
    return html`<defs>${gradients}</defs>`;
  }

  /** Fill for a series — gradient URL when requested, else flat colour. */
  _seriesFill(s: ChartSeries): string {
    if (s.gradient) return `url(#grad-${s.key}-${this._uid})`;
    return seriesColor(s);
  }

  // ------- Line chart -------

  _renderLine(lMin: number, lMax: number, rMin: number, rMax: number) {
    const series = this._activeSeries();
    const data = this._visibleData();
    const transStyle = this.animate ? 'transition: d 300ms ease, stroke-dashoffset 300ms ease;' : '';
    const groups = series.map((s) => {
      const pts: Array<[number, number]> = data.map((row, i) => [
        this._xPos(i, data.length),
        this._yPosFor(s, num(row[s.key]), lMin, lMax, rMin, rMax),
      ]);
      const d = this.curve === 'smooth' ? smoothPath(pts) : linePath(pts);
      const dots = pts.map(([x, y]) => html`<circle cx=${x} cy=${y} r="3" fill=${seriesColor(s)} class="recharts-dot" style=${this.animate ? 'transition: cx 300ms ease, cy 300ms ease;' : ''} />`);
      return html`
        <g class="recharts-layer" data-series=${s.key} data-axis=${s.axis ?? 'left'}>
          <path d=${d} fill="none" stroke=${seriesColor(s)} stroke-width="2" class="recharts-curve" style=${transStyle} />
          ${dots}
        </g>
      `;
    });
    return html`<g>${groups}</g>`;
  }

  // ------- Area chart -------

  _renderArea(lMin: number, lMax: number, rMin: number, rMax: number) {
    const series = this._activeSeries();
    const data = this._visibleData();
    const stacked = this.layout === 'stacked';
    const stack: number[] = new Array(data.length).fill(0);
    const transStyle = this.animate ? 'transition: d 300ms ease;' : '';

    const groups = series.map((s, sIdx) => {
      const baseline = this._yPosFor(s, 0, lMin, lMax, rMin, rMax);
      const pts: Array<[number, number]> = data.map((row, i) => {
        const v = num(row[s.key]);
        const y = stacked
          ? this._yPosFor(s, stack[i] + v, lMin, lMax, rMin, rMax)
          : this._yPosFor(s, v, lMin, lMax, rMin, rMax);
        if (stacked) stack[i] += v;
        return [this._xPos(i, data.length), y];
      });
      const bottomPts: Array<[number, number]> = stacked && sIdx > 0
        ? data.map((row, i) => {
            // Recompute previous-cumulative for stacking baseline.
            let cum = 0;
            for (let k = 0; k < sIdx; k++) cum += num(data[i][series[k].key]);
            return [this._xPos(i, data.length), this._yPosFor(s, cum, lMin, lMax, rMin, rMax)];
          })
        : data.map((row, i) => [this._xPos(i, data.length), baseline]);

      const top = this.curve === 'smooth' ? smoothPath(pts) : linePath(pts);
      const rev = [...bottomPts].reverse();
      const bot = this.curve === 'smooth' ? smoothPath(rev) : linePath(rev);
      const close = `M ${pts[0][0]},${pts[0][1]} ${top.slice(2)} L ${rev[0][0]},${rev[0][1]} ${bot.slice(2)} Z`;
      const fill = this._seriesFill(s);
      const fillOpacity = s.gradient ? '1' : '0.3';
      return html`
        <g class="recharts-layer" data-series=${s.key} data-axis=${s.axis ?? 'left'}>
          <path d=${close} fill=${fill} fill-opacity=${fillOpacity} stroke="none" style=${transStyle} />
          <path d=${top} fill="none" stroke=${seriesColor(s)} stroke-width="2" class="recharts-curve" style=${transStyle} />
        </g>
      `;
    });
    return html`<g>${groups}</g>`;
  }

  // ------- Bar chart -------

  _renderBar(lMin: number, lMax: number, rMin: number, rMax: number) {
    const series = this._activeSeries();
    const data = this._visibleData();
    const n = data.length;
    if (!n || !series.length) return html``;
    const slot = PLOT_W / n;
    const groupPad = slot * 0.2;
    const innerW = slot - groupPad * 2;
    const stacked = this.layout === 'stacked';
    const transStyle = this.animate ? 'transition: y 300ms ease, height 300ms ease;' : '';

    const groups = data.map((row, i) => {
      const cx = this._xPos(i, n);
      const x0 = cx - slot / 2 + groupPad;
      if (stacked) {
        let cumPos = 0, cumNeg = 0;
        const bars = series.map((s) => {
          const v = num(row[s.key]);
          let topV: number, bottomV: number;
          if (v >= 0) { topV = cumPos + v; bottomV = cumPos; cumPos += v; }
          else { topV = cumNeg; bottomV = cumNeg + v; cumNeg += v; }
          const y1 = this._yPosFor(s, topV, lMin, lMax, rMin, rMax);
          const y2 = this._yPosFor(s, bottomV, lMin, lMax, rMin, rMax);
          const fill = this._seriesFill(s);
          return html`<rect x=${x0} y=${Math.min(y1, y2)} width=${innerW} height=${Math.abs(y2 - y1)} fill=${fill} class="recharts-rectangle" data-series=${s.key} style=${transStyle} />`;
        });
        return html`<g class="recharts-layer">${bars}</g>`;
      } else {
        const bw = innerW / series.length;
        const bars = series.map((s, sIdx) => {
          const v = num(row[s.key]);
          const y = this._yPosFor(s, v, lMin, lMax, rMin, rMax);
          const baseline = this._yPosFor(s, 0, lMin, lMax, rMin, rMax);
          const bx = x0 + sIdx * bw;
          const top = Math.min(y, baseline);
          const h = Math.abs(y - baseline);
          const fill = this._seriesFill(s);
          return html`<rect x=${bx + 1} y=${top} width=${Math.max(0, bw - 2)} height=${h} fill=${fill} class="recharts-rectangle" data-series=${s.key} style=${transStyle} />`;
        });
        return html`<g class="recharts-layer">${bars}</g>`;
      }
    });
    return html`<g>${groups}</g>`;
  }

  // ------- Pie chart -------

  /** Compute target pie arcs from current data. */
  _computePieArcs(): Array<{ a0: number; a1: number }> {
    const series = this._activeSeries();
    const key = series[0]?.key ?? this.series[0]?.key;
    if (!key) return [];
    const values = this.data.map((d) => num(d[key]));
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const arcs: Array<{ a0: number; a1: number }> = [];
    let angle = -Math.PI / 2;
    for (let i = 0; i < this.data.length; i++) {
      const slice = (values[i] / total) * Math.PI * 2;
      arcs.push({ a0: angle, a1: angle + slice });
      angle += slice;
    }
    return arcs;
  }

  _renderPie() {
    const series = this._activeSeries();
    const key = series[0]?.key ?? this.series[0]?.key;
    if (!key) return html``;
    const target = this._computePieArcs();
    // Use the in-flight frame snapshot when animating; otherwise the target.
    const arcs = this._pieArcsFrame ?? target;
    // Kick off an animation when the target diverges from the last
    // rendered arcs and animation is enabled.
    if (this.animate && this._pieArcsChanged(target)) {
      this._animatePie(target);
    }
    this._prevPieArcs = target;
    const cx = VB_W / 2, cy = VB_H / 2;
    const r = Math.min(PLOT_W, PLOT_H) / 2 - 8;
    const ir = Math.max(0, Math.min(r - 4, this.innerRadius || 0));
    const slices = this.data.map((row, i) => {
      const arc = arcs[i] || target[i] || { a0: 0, a1: 0 };
      const { a0, a1 } = arc;
      const slice = a1 - a0;
      const large = Math.abs(slice) > Math.PI ? 1 : 0;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const fill = `var(--color-${String(row[this.dataKey] ?? `s${i}`)})`;
      if (ir > 0) {
        const ix0 = cx + ir * Math.cos(a0), iy0 = cy + ir * Math.sin(a0);
        const ix1 = cx + ir * Math.cos(a1), iy1 = cy + ir * Math.sin(a1);
        const d = `M ${x0},${y0} A ${r},${r} 0 ${large} 1 ${x1},${y1} L ${ix1},${iy1} A ${ir},${ir} 0 ${large} 0 ${ix0},${iy0} Z`;
        return html`<path d=${d} fill=${fill} class="recharts-sector" stroke="var(--background, white)" stroke-width="2" />`;
      }
      const d = `M ${cx},${cy} L ${x0},${y0} A ${r},${r} 0 ${large} 1 ${x1},${y1} Z`;
      return html`<path d=${d} fill=${fill} class="recharts-sector" stroke="var(--background, white)" stroke-width="2" />`;
    });
    return html`<g>${slices}</g>`;
  }

  _pieArcsChanged(target: Array<{ a0: number; a1: number }>): boolean {
    const prev = this._prevPieArcs;
    if (!prev) return false; // first render — no anim needed
    if (prev.length !== target.length) return true;
    for (let i = 0; i < prev.length; i++) {
      if (Math.abs(prev[i].a0 - target[i].a0) > 1e-6) return true;
      if (Math.abs(prev[i].a1 - target[i].a1) > 1e-6) return true;
    }
    return false;
  }

  /** Animate pie arcs from `_prevPieArcs` → `target` over 300ms. */
  _animatePie(target: Array<{ a0: number; a1: number }>): void {
    if (typeof window === 'undefined') return;
    if (this._animRaf) cancelAnimationFrame(this._animRaf);
    const from = this._prevPieArcs
      ? this._prevPieArcs.map((a) => ({ ...a }))
      : target.map((_, i) => {
          // First-time render: animate from a collapsed wedge.
          const seed = target[0]?.a0 ?? -Math.PI / 2;
          return { a0: seed, a1: seed };
        });
    const start = performance.now();
    const dur = 300;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const len = Math.max(from.length, target.length);
      const frame: Array<{ a0: number; a1: number }> = [];
      for (let i = 0; i < len; i++) {
        const f = from[i] ?? from[from.length - 1] ?? { a0: 0, a1: 0 };
        const tt = target[i] ?? target[target.length - 1] ?? { a0: 0, a1: 0 };
        frame.push({
          a0: f.a0 + (tt.a0 - f.a0) * eased,
          a1: f.a1 + (tt.a1 - f.a1) * eased,
        });
      }
      this._pieArcsFrame = frame;
      this.requestUpdate();
      if (t < 1) {
        this._animRaf = requestAnimationFrame(tick);
      } else {
        this._pieArcsFrame = null;
        this._animRaf = 0;
      }
    };
    this._animRaf = requestAnimationFrame(tick);
  }

  // ------- Radial chart -------

  /** Flat list of slice pcts in (row, series) row-major order. */
  _computeRadialArcs(): Array<{ pct: number }> {
    const series = this._activeSeries();
    const allVals: number[] = [];
    for (const row of this.data) for (const s of series) allVals.push(num(row[s.key]));
    const max = Math.max(1, ...allVals);
    const out: Array<{ pct: number }> = [];
    for (const row of this.data) for (const s of series) {
      out.push({ pct: max ? num(row[s.key]) / max : 0 });
    }
    return out;
  }

  _radialArcsChanged(target: Array<{ pct: number }>): boolean {
    const prev = this._prevRadialArcs;
    if (!prev) return false;
    if (prev.length !== target.length) return true;
    for (let i = 0; i < prev.length; i++) {
      if (Math.abs(prev[i].pct - target[i].pct) > 1e-6) return true;
    }
    return false;
  }

  _animateRadial(target: Array<{ pct: number }>): void {
    if (typeof window === 'undefined') return;
    if (this._animRaf) cancelAnimationFrame(this._animRaf);
    const from = this._prevRadialArcs
      ? this._prevRadialArcs.map((a) => ({ ...a }))
      : target.map(() => ({ pct: 0 }));
    const start = performance.now();
    const dur = 300;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const len = Math.max(from.length, target.length);
      const frame: Array<{ pct: number }> = [];
      for (let i = 0; i < len; i++) {
        const f = from[i] ?? { pct: 0 };
        const tt = target[i] ?? { pct: 0 };
        frame.push({ pct: f.pct + (tt.pct - f.pct) * eased });
      }
      this._radialArcsFrame = frame;
      this.requestUpdate();
      if (t < 1) {
        this._animRaf = requestAnimationFrame(tick);
      } else {
        this._radialArcsFrame = null;
        this._animRaf = 0;
      }
    };
    this._animRaf = requestAnimationFrame(tick);
  }

  _renderRadial() {
    const series = this._activeSeries();
    const cx = VB_W / 2, cy = VB_H / 2;
    const rMax = Math.min(PLOT_W, PLOT_H) / 2 - 8;
    const target = this._computeRadialArcs();
    const arcs = this._radialArcsFrame ?? target;
    if (this.animate && this._radialArcsChanged(target)) {
      this._animateRadial(target);
    }
    this._prevRadialArcs = target;
    const rowCount = this.data.length || 1;
    const bandH = (rMax - 20) / rowCount;

    const groups = this.data.map((row, i) => {
      const rowR = rMax - i * bandH;
      const rowInner = rowR - bandH * 0.8;
      const seriesCount = series.length || 1;
      const arcsForRow = series.map((s, sIdx) => {
        const flatIdx = i * series.length + sIdx;
        const pct = arcs[flatIdx]?.pct ?? 0;
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + pct * Math.PI * 2 * 0.95;
        const subBand = (rowR - rowInner) / seriesCount;
        const r1 = rowR - sIdx * subBand;
        const r0 = r1 - subBand * 0.8;
        const large = (endAngle - startAngle) > Math.PI ? 1 : 0;
        const x0 = cx + r1 * Math.cos(startAngle), y0 = cy + r1 * Math.sin(startAngle);
        const x1 = cx + r1 * Math.cos(endAngle), y1 = cy + r1 * Math.sin(endAngle);
        const ix0 = cx + r0 * Math.cos(startAngle), iy0 = cy + r0 * Math.sin(startAngle);
        const ix1 = cx + r0 * Math.cos(endAngle), iy1 = cy + r0 * Math.sin(endAngle);
        // Background sector (faint, full circle for context).
        const bgX1 = cx + r1 * Math.cos(startAngle + Math.PI * 2 * 0.95 - 0.001);
        const bgY1 = cy + r1 * Math.sin(startAngle + Math.PI * 2 * 0.95 - 0.001);
        const bgIX1 = cx + r0 * Math.cos(startAngle + Math.PI * 2 * 0.95 - 0.001);
        const bgIY1 = cy + r0 * Math.sin(startAngle + Math.PI * 2 * 0.95 - 0.001);
        const bg = `M ${x0},${y0} A ${r1},${r1} 0 1 1 ${bgX1},${bgY1} L ${bgIX1},${bgIY1} A ${r0},${r0} 0 1 0 ${ix0},${iy0} Z`;
        const fg = pct > 0
          ? `M ${x0},${y0} A ${r1},${r1} 0 ${large} 1 ${x1},${y1} L ${ix1},${iy1} A ${r0},${r0} 0 ${large} 0 ${ix0},${iy0} Z`
          : '';
        return html`
          <path d=${bg} class="recharts-radial-bar-background-sector" fill="currentColor" fill-opacity="0.08" />
          ${fg ? html`<path d=${fg} fill=${seriesColor(s)} class="recharts-sector" />` : html``}
        `;
      });
      return html`<g class="recharts-layer">${arcsForRow}</g>`;
    });
    return html`<g>${groups}</g>`;
  }

  // ------- Hover cursor -------

  _renderCursor(_yMin: number, _yMax: number) {
    if (this.state.hovered == null) return html``;
    if (this.type === 'pie' || this.type === 'radial') return html``;
    const data = this._visibleData();
    const x = this._xPos(this.state.hovered, data.length);
    return html`<line x1=${x} y1=${PAD_T} x2=${x} y2=${PAD_T + PLOT_H} class="recharts-tooltip-cursor stroke-border" stroke="currentColor" stroke-opacity="0.5" stroke-dasharray="3 3" />`;
  }

  // ------- Brush selection -------

  /** Total SVG height when brush is enabled — adds a ~40px strip below. */
  _vbH(): number { return this.brush ? VB_H + BRUSH_H + 8 : VB_H; }

  _renderBrush() {
    if (!this.brush || this.data.length < 2) return html``;
    const y0 = VB_H + 4;
    const bg = `M ${PAD_L},${y0 + BRUSH_H} L ${PAD_L},${y0} L ${PAD_L + PLOT_W},${y0} L ${PAD_L + PLOT_W},${y0 + BRUSH_H} Z`;

    // Downsampled overview line using first series.
    const s = this.series[0];
    let overview = html``;
    if (s) {
      // Use full (un-brushed) dataset so the overview always shows the whole shape.
      const vals = this.data.map((row) => num(row[s.key]));
      const min = Math.min(...vals, 0);
      const max = Math.max(...vals, 1);
      const span = max - min || 1;
      const pts: Array<[number, number]> = this.data.map((_, i) => {
        const x = PAD_L + (i / (this.data.length - 1)) * PLOT_W;
        const y = y0 + BRUSH_H - ((vals[i] - min) / span) * (BRUSH_H - 4) - 2;
        return [x, y];
      });
      overview = html`<path d=${linePath(pts)} fill="none" stroke="currentColor" stroke-opacity="0.4" stroke-width="1" />`;
    }

    const xL = PAD_L + this.state.brushStart * PLOT_W;
    const xR = PAD_L + this.state.brushEnd * PLOT_W;
    return html`
      <g class="recharts-brush" data-slot="chart-brush"
         @pointerdown=${this._onBrushPointerDown}
         @pointermove=${this._onBrushPointerMove}
         @pointerup=${this._onBrushPointerUp}
         @pointercancel=${this._onBrushPointerUp}>
        <path d=${bg} fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.2" />
        ${overview}
        <rect data-brush-window="true" x=${xL} y=${y0} width=${Math.max(0, xR - xL)} height=${BRUSH_H}
              fill="currentColor" fill-opacity="0.10" stroke="currentColor" stroke-opacity="0.3" cursor="grab" />
        <rect data-brush-handle="left" x=${xL - 4} y=${y0 - 2} width="8" height=${BRUSH_H + 4}
              fill="var(--background, white)" stroke="currentColor" stroke-opacity="0.5" cursor="ew-resize" rx="2" />
        <rect data-brush-handle="right" x=${xR - 4} y=${y0 - 2} width="8" height=${BRUSH_H + 4}
              fill="var(--background, white)" stroke="currentColor" stroke-opacity="0.5" cursor="ew-resize" rx="2" />
      </g>
    `;
  }

  _brushSvgX(e: PointerEvent): number {
    const svg = (e.currentTarget as SVGGElement).ownerSVGElement!;
    const rect = svg.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * VB_W;
  }

  _onBrushPointerDown = (e: PointerEvent) => {
    const target = e.target as SVGElement;
    const handle = target.getAttribute('data-brush-handle');
    const isWindow = target.getAttribute('data-brush-window') === 'true';
    if (!handle && !isWindow) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    this._brushDrag = {
      handle: (handle as 'left' | 'right') ?? 'window',
      pointerId: e.pointerId,
      startX: this._brushSvgX(e),
      startBS: this.state.brushStart,
      startBE: this.state.brushEnd,
    };
  };

  _onBrushPointerMove = (e: PointerEvent) => {
    if (!this._brushDrag) return;
    const dx = (this._brushSvgX(e) - this._brushDrag.startX) / PLOT_W;
    let bs = this._brushDrag.startBS;
    let be = this._brushDrag.startBE;
    const minSpan = 1 / Math.max(this.data.length - 1, 1);
    if (this._brushDrag.handle === 'left') {
      bs = Math.max(0, Math.min(be - minSpan, this._brushDrag.startBS + dx));
    } else if (this._brushDrag.handle === 'right') {
      be = Math.min(1, Math.max(bs + minSpan, this._brushDrag.startBE + dx));
    } else {
      const w = be - bs;
      bs = Math.max(0, Math.min(1 - w, this._brushDrag.startBS + dx));
      be = bs + w;
    }
    if (bs === this.state.brushStart && be === this.state.brushEnd) return;
    this.setState({ brushStart: bs, brushEnd: be });
    const n = this.data.length;
    const startIndex = Math.max(0, Math.floor(bs * (n - 1)));
    const endIndex = Math.min(n - 1, Math.ceil(be * (n - 1)));
    this.dispatchEvent(new CustomEvent('ui-chart-brush', {
      detail: { startIndex, endIndex, start: bs, end: be },
      bubbles: true, composed: true,
    }));
  };

  _onBrushPointerUp = (e: PointerEvent) => {
    if (!this._brushDrag) return;
    (e.currentTarget as Element).releasePointerCapture?.(this._brushDrag.pointerId);
    this._brushDrag = null;
  };

  render() {
    const cartesian = this.type === 'line' || this.type === 'bar' || this.type === 'area';
    const left = cartesian ? this._yRange((s) => (s.axis ?? 'left') === 'left') : { min: 0, max: 0, ticks: [] };
    const hasRight = cartesian && this._hasSecondaryAxis();
    const right = hasRight ? this._yRange((s) => s.axis === 'right') : { min: 0, max: 0, ticks: [] };
    let body = html``;
    if (this.type === 'line') body = this._renderLine(left.min, left.max, right.min, right.max);
    else if (this.type === 'bar') body = this._renderBar(left.min, left.max, right.min, right.max);
    else if (this.type === 'area') body = this._renderArea(left.min, left.max, right.min, right.max);
    else if (this.type === 'pie') body = this._renderPie();
    else if (this.type === 'radial') body = this._renderRadial();

    return html`
      <div class="w-full h-full relative recharts-surface">
        <svg data-chart-svg viewBox="0 0 ${VB_W} ${this._vbH()}" preserveAspectRatio="xMidYMid meet" class="w-full h-full overflow-visible text-foreground">
          ${this._renderDefs()}
          ${cartesian ? this._renderAxes(left.min, left.max, left.ticks, hasRight ? right : undefined) : html``}
          ${body}
          ${cartesian ? this._renderCursor(left.min, left.max) : html``}
          ${this._renderBrush()}
        </svg>
      </div>
    `;
  }
}
UiChart.register('ui-chart');

/* --------------------------------------------------------------------- *
 * Tooltip                                                               *
 * --------------------------------------------------------------------- */

export class UiChartTooltip extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    // Listen for hover events from the sibling <ui-chart>.
    const root = this.closest('[data-chart]') ?? this.parentElement;
    if (root) {
      root.addEventListener('ui-chart-hover', (e: Event) => {
        const { detail } = e as CustomEvent;
        const content = this.querySelector('ui-chart-tooltip-content') as any;
        if (!content) return;
        if (detail.index == null || !detail.data) {
          content.removeAttribute('payload');
          this.style.display = 'none';
          return;
        }
        const chart = root.querySelector('ui-chart') as any;
        const series: ChartSeries[] = chart?.series ?? [];
        const payload = series.map((s) => ({
          name: s.label ?? s.key,
          value: detail.data[s.key],
          color: s.color ?? `var(--color-${s.key})`,
        }));
        content.payload = payload;
        const dataKey = chart?.dataKey ?? 'name';
        content.label = String(detail.data[dataKey] ?? '');
        const hostRect = (root as HTMLElement).getBoundingClientRect();
        this.style.position = 'absolute';
        this.style.left = `${detail.x - hostRect.left + 12}px`;
        this.style.top = `${detail.y - hostRect.top + 12}px`;
        this.style.pointerEvents = 'none';
        this.style.display = 'block';
        this.style.zIndex = '50';
      });
    }
  }
  render() {
    return html`<div data-slot="chart-tooltip">${unsafeHTML(this._slot)}</div>`;
  }
}
UiChartTooltip.register('ui-chart-tooltip');

export class UiChartTooltipContent extends WebComponent {
  static properties = {
    payload: { type: Object, converter: { fromAttribute: (s: string | null) => {
      if (!s) return null;
      try { return JSON.parse(s); } catch { return null; }
    }, toAttribute: (v: unknown) => JSON.stringify(v) } },
    label: { type: String },
    hideLabel: { type: Boolean, attribute: 'hide-label' },
    indicator: { type: String },
  };
  declare payload: Array<{ name?: string; value?: number | string; color?: string }> | null;
  declare label: string;
  declare hideLabel: boolean;
  declare indicator: 'dot' | 'line' | 'dashed';

  constructor() {
    super();
    this.payload = null;
    this.label = '';
    this.hideLabel = false;
    this.indicator = 'dot';
  }

  render() {
    const items = this.payload || [];
    return html`
      <div
        data-slot="chart-tooltip-content"
        class=${cn(
          'grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl',
        )}
      >
        ${!this.hideLabel && this.label
          ? html`<div class="font-medium">${this.label}</div>`
          : html``}
        ${items.length
          ? html`<div class="grid gap-1.5">
              ${items.map((it) => html`
                <div class="flex w-full flex-wrap items-stretch gap-2 [&>svg]:size-2.5 items-center">
                  <div class=${cn('shrink-0 rounded-[2px]',
                    this.indicator === 'line' ? 'w-1 h-3.5' :
                    this.indicator === 'dashed' ? 'w-0 h-3.5 border-[1.5px] border-dashed bg-transparent' :
                    'size-2.5'
                  )} style="background:${it.color ?? 'currentColor'};border-color:${it.color ?? 'currentColor'}"></div>
                  <span class="text-muted-foreground">${it.name ?? ''}</span>
                  <span class="ml-auto font-mono font-medium tabular-nums text-foreground">${typeof it.value === 'number' ? it.value.toLocaleString() : String(it.value ?? '')}</span>
                </div>
              `)}
            </div>`
          : html``}
      </div>
    `;
  }
}
UiChartTooltipContent.register('ui-chart-tooltip-content');

/* --------------------------------------------------------------------- *
 * Legend                                                                *
 * --------------------------------------------------------------------- */

export class UiChartLegend extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<div data-slot="chart-legend">${unsafeHTML(this._slot)}</div>`;
  }
}
UiChartLegend.register('ui-chart-legend');

export class UiChartLegendContent extends WebComponent {
  static properties = {
    payload: { type: Object, converter: { fromAttribute: (s: string | null) => {
      if (!s) return null;
      try { return JSON.parse(s); } catch { return null; }
    }, toAttribute: (v: unknown) => JSON.stringify(v) } },
    verticalAlign: { type: String, attribute: 'vertical-align' },
  };
  declare payload: Array<{ value?: string; color?: string; key?: string }> | null;
  declare verticalAlign: 'top' | 'bottom';

  state: { hidden: Record<string, boolean> } = { hidden: {} };

  constructor() {
    super();
    this.payload = null;
    this.verticalAlign = 'bottom';
  }

  connectedCallback() {
    super.connectedCallback();
    // Auto-populate payload from sibling <ui-chart> if none was set.
    if (!this.payload) {
      queueMicrotask(() => {
        const root = this.closest('[data-chart]');
        const chart = root?.querySelector('ui-chart') as any;
        if (!chart) return;
        const series: ChartSeries[] = chart.series ?? [];
        this.payload = series.map((s) => ({
          value: s.label ?? s.key,
          color: s.color ?? `var(--color-${s.key})`,
          key: s.key,
        }));
      });
    }
  }

  _toggle(key: string | undefined) {
    if (!key) return;
    const hidden = { ...this.state.hidden, [key]: !this.state.hidden[key] };
    this.setState({ hidden });
    const root = this.closest('[data-chart]');
    const chart = root?.querySelector('ui-chart') as any;
    if (chart && typeof chart._toggleSeries === 'function') chart._toggleSeries(key);
  }

  render() {
    const items = this.payload || [];
    return html`
      <div
        data-slot="chart-legend-content"
        class=${cn(
          'flex items-center justify-center gap-4',
          this.verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        )}
      >
        ${items.map((it) => {
          const hidden = it.key ? this.state.hidden[it.key] : false;
          return html`
            <button
              type="button"
              @click=${() => this._toggle(it.key)}
              class=${cn(
                'flex items-center gap-1.5 text-xs cursor-pointer bg-transparent border-0 p-0',
                hidden && 'opacity-40',
              )}
            >
              <span class="size-2 shrink-0 rounded-[2px] inline-block" style="background:${it.color ?? 'currentColor'}"></span>
              <span>${it.value ?? ''}</span>
            </button>
          `;
        })}
      </div>
    `;
  }
}
UiChartLegendContent.register('ui-chart-legend-content');
