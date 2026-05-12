import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Chart primitives — STYLING + ACCESSIBILITY SCAFFOLD ONLY.
 *
 * v1 SCOPE: this component does NOT render charts itself. shadcn's
 * chart wrapper depends on recharts (a React-only renderer). For the
 * web-components port, we ship only the visual container, theme-driven
 * CSS variables for series colors, tooltip + legend primitives, and
 * accessibility hooks (`role`, `aria-label`).
 *
 * To actually plot data, drop your own SVG or chart-library output
 * inside <ui-chart-container>:
 *
 *   <ui-chart-container id="revenue" config='{"sales":{"color":"#22c55e","label":"Sales"}}'>
 *     <svg>...your chart marks...</svg>
 *     <ui-chart-tooltip>
 *       <ui-chart-tooltip-content></ui-chart-tooltip-content>
 *     </ui-chart-tooltip>
 *     <ui-chart-legend>
 *       <ui-chart-legend-content></ui-chart-legend-content>
 *     </ui-chart-legend>
 *   </ui-chart-container>
 *
 * The container injects CSS variables (`--color-<key>`) sourced from
 * `config` so your SVG marks can `fill: var(--color-sales)` etc.
 *
 * TODO(v2): an actual headless chart engine (D3, vega-lite, or a custom
 * SVG primitives layer) so a single component renders bars/lines without
 * each consumer wiring their own SVG. Out of scope for v1 — shadcn
 * itself outsources this to recharts.
 */

type ChartConfigEntry = {
  label?: string;
  icon?: string; // SVG markup
  color?: string;
  theme?: { light: string; dark: string };
};
export type ChartConfig = Record<string, ChartConfigEntry>;

let chartIdCounter = 0;

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
        )}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiChartContainer.register('ui-chart-container');

export class UiChartTooltip extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
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
  };
  declare payload: Array<{ name?: string; value?: number | string; color?: string }> | null;
  declare label: string;
  declare hideLabel: boolean;

  constructor() {
    super();
    this.payload = null;
    this.label = '';
    this.hideLabel = false;
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
                <div class="flex w-full flex-wrap items-stretch gap-2 [&>svg]:size-2.5">
                  <div class="size-2.5 shrink-0 rounded-[2px]" style="background:${it.color ?? 'currentColor'}"></div>
                  <span class="text-muted-foreground">${it.name ?? ''}</span>
                  <span class="ml-auto font-mono font-medium tabular-nums text-foreground">${it.value ?? ''}</span>
                </div>
              `)}
            </div>`
          : html``}
      </div>
    `;
  }
}
UiChartTooltipContent.register('ui-chart-tooltip-content');

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
  declare payload: Array<{ value?: string; color?: string }> | null;
  declare verticalAlign: 'top' | 'bottom';

  constructor() {
    super();
    this.payload = null;
    this.verticalAlign = 'bottom';
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
        ${items.map((it) => html`
          <div class="flex items-center gap-1.5 text-xs">
            <div class="size-2 shrink-0 rounded-[2px]" style="background:${it.color ?? 'currentColor'}"></div>
            <span>${it.value ?? ''}</span>
          </div>
        `)}
      </div>
    `;
  }
}
UiChartLegendContent.register('ui-chart-legend-content');
