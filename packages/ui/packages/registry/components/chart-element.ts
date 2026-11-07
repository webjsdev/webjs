/**
 * The chart's browser half (#1666): the `<ui-chart>` element, and the
 * tooltip and legend markup it draws (shadcn's ChartTooltipContent and
 * ChartLegendContent), with the ChartConfig types they share. `chart.ts`
 * draws the charts on the server with the same markup, and imports and
 * re-exports everything here, so an app imports the chart module alone.
 *
 * A11y (handled by the element): once upgraded, a chart with a tooltip is a
 * focusable `role="application"` named by its `title`, the arrow keys and
 * Home / End step through its points, Escape hides the tooltip, and each
 * step is announced through a polite live region.
 */
import { WebComponent, html, render } from '@webjsdev/core';
import { cn } from '../lib/utils.ts';
import { formatValue, visibleTicks, type Tick } from './chart-geometry.ts';

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
export type TooltipLook = Pick<ChartTooltipOptions, 'indicator' | 'hideIndicator' | 'class' | 'labelClass'>;

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
export function isPlainView(v: ChartTooltipView): boolean {
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
// The element adds the tooltip, cursor and active marks, by pointer and keyboard
// --------------------------------------------------------------------------

export class UiChart extends WebComponent {
  /** The point showing, or -1. */
  activeIndex = -1;
  _resize: ResizeObserver | null = null;

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
    this._resize?.disconnect();
    this._resize = null;
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
    if (!s || !s.getAttribute('viewBox')) return false;
    this._watchSize(s);
    if (!s.dataset.hit) return true;
    if (s.dataset.keyboard === 'true') {
      s.setAttribute('tabindex', '0');
      s.setAttribute('role', 'application');
      s.setAttribute('aria-roledescription', 'chart');
    }
    const d = s.dataset.defaultIndex;
    if (d != null) this.show(Number(d));
    return true;
  }

  /**
   * Keep the labels at their font size. The SVG scales with its container,
   * and a 12px label in a chart drawn 340px wide on a 450 unit viewBox would
   * read as 9px; Recharts lays out at the real width, so its text never
   * scales. The SVG's font size, in em of its container's, undoes the scale.
   */
  _watchSize(s: SVGSVGElement): void {
    if (this._resize || typeof ResizeObserver !== 'function') return;
    const width = Number(s.getAttribute('viewBox')?.split(/\s+/)[2]);
    this._resize = new ResizeObserver(() => {
      const shown = s.getBoundingClientRect();
      const k = Math.max(width / shown.width, (Number(s.getAttribute('viewBox')?.split(/\s+/)[3]) || 0) / shown.height);
      if (Number.isFinite(k) && k > 0) s.style.fontSize = `${Math.round(k * 1000) / 1000}em`;
      this._fitTicks(s, Number.isFinite(k) && k > 0 ? k : 1);
    });
    this._resize.observe(s);
  }

  /**
   * Thin each axis's labels again with their real widths, the way Recharts'
   * getTicks does at render: the server could only estimate them, and the
   * labels keep their font size while the chart scales.
   */
  _fitTicks(s: SVGSVGElement, k: number): void {
    for (const axis of Array.from(s.querySelectorAll<SVGGElement>('[data-axis][data-interval]'))) {
      const interval = axis.dataset.interval ?? 'preserveEnd';
      const groups = Array.from(axis.querySelectorAll<SVGGElement>('[data-coord]'));
      const isX = axis.dataset.axis === 'x';
      const ticks: Tick[] = groups.map((g, i) => ({ value: i, label: '', coord: Number(g.dataset.coord) }));
      const size = (t: Tick) => {
        const text = groups[Number(t.value)].querySelector('text');
        if (!text) return 0;
        return isX ? text.getComputedTextLength() : text.getBBox().height;
      };
      // Recharts' edges are the chart's box, with its margins in pixels. Here
      // the margins scale with the chart while the labels do not, so the room
      // between the box and the outer ticks is widened back to its pixels.
      const extent = Number(axis.dataset.extent);
      const coords = ticks.map((t) => t.coord);
      const before = coords.length ? Math.min(...coords) : 0;
      const after = coords.length ? extent - Math.max(...coords) : 0;
      const kept = visibleTicks(ticks, size, -before * (k - 1), extent + after * (k - 1), Number(axis.dataset.gap), /^\d+$/.test(interval) ? Number(interval) : (interval as 'preserveEnd'));
      const at = new Map(kept.map((t) => [Number(t.value), t.at ?? t.coord]));
      groups.forEach((g, i) => {
        const pos = at.get(i);
        if (pos == null) {
          g.setAttribute('visibility', 'hidden');
          return;
        }
        g.removeAttribute('visibility');
        const v = String(Math.round(pos * 1e4) / 1e4);
        for (const el of Array.from(g.querySelectorAll('text, tspan'))) {
          if (isX) el.setAttribute('x', v);
          else if (el.tagName.toLowerCase() === 'text') el.setAttribute('y', v);
        }
        for (const line of Array.from(g.querySelectorAll('line'))) {
          if (isX) { line.setAttribute('x1', v); line.setAttribute('x2', v); } else { line.setAttribute('y1', v); line.setAttribute('y2', v); }
        }
      });
    }
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
    // Recharts' getTooltipTranslate: 10px right of and below the point, or
    // above and to its left when that would leave the plot area.
    const area = this._plot();
    const x = p.x + 10 + wrapper.offsetWidth > area.right ? Math.max(p.x - wrapper.offsetWidth - 10, area.left) : Math.max(p.x + 10, area.left);
    const y = p.y + 10 + wrapper.offsetHeight > area.bottom ? Math.max(p.y - wrapper.offsetHeight - 10, area.top) : Math.max(p.y + 10, area.top);
    wrapper.style.transform = `translate(${x}px, ${y}px)`;
  }

  /** The plot area in pixels from the chart's wrapper. */
  _plot(): { left: number; top: number; right: number; bottom: number } {
    const s = this._svg();
    const wrap = s?.parentElement;
    const m = s?.getScreenCTM?.();
    const [x, y, w, h] = (s?.dataset.plot ?? '').split(' ').map(Number);
    if (!s || !wrap || !m || !Number.isFinite(h)) {
      return { left: 0, top: 0, right: wrap?.clientWidth ?? 0, bottom: wrap?.clientHeight ?? 0 };
    }
    const r = wrap.getBoundingClientRect();
    return {
      left: m.a * x + m.e - r.left,
      top: m.d * y + m.f - r.top,
      right: m.a * (x + w) + m.e - r.left,
      bottom: m.d * (y + h) + m.f - r.top,
    };
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
