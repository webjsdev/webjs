/**
 * Progress — determinate progress bar.
 *
 * APG pattern: progressbar role + aria-valuenow.
 *
 * shadcn parity:
 *   `value` (number 0-100). Same visual: 2px track, animated fill.
 *
 * Usage:
 *   <ui-progress value="42"></ui-progress>
 *   <ui-progress value="100"></ui-progress>
 *
 * Attributes:
 *   `value` — number, 0–100. Defaults to 0.
 *   `max`   — number, default 100.
 *
 * The progress is implemented as a custom element because the fill width
 * is driven by a `transform: translateX(-${100 - value}%)` on a child div,
 * which is shadcn's exact approach. A pure class helper can't compute that.
 *
 * Design tokens used: --primary.
 */
import { cn, Base, defineElement } from '../lib/utils.ts';

const ROOT_CLASS = 'relative h-2 w-full overflow-hidden rounded-full bg-primary/20';
const INDICATOR_CLASS = 'h-full w-full flex-1 bg-primary transition-all';

const STYLES = `
ui-progress { display: block; }
`;

function installStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ui-progress-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-progress-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

export class UiProgress extends Base {
  static get observedAttributes(): string[] {
    return ['value', 'max'];
  }

  private _indicator: HTMLDivElement | null = null;

  connectedCallback(): void {
    installStyles();
    this.setAttribute('data-slot', 'progress');
    this.setAttribute('role', 'progressbar');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(ROOT_CLASS, userClass);
    if (!this._indicator) {
      this._indicator = document.createElement('div');
      this._indicator.setAttribute('data-slot', 'progress-indicator');
      this._indicator.className = INDICATOR_CLASS;
      this.appendChild(this._indicator);
    }
    this._reflect();
  }

  attributeChangedCallback(): void {
    this._reflect();
  }

  private _reflect(): void {
    const rawValue = this.getAttribute('value');
    const value = Number(rawValue ?? '0');
    const max = Number(this.getAttribute('max') ?? '100');
    const clamped = Math.max(0, Math.min(max, isFinite(value) ? value : 0));
    const pct = max > 0 ? (clamped / max) * 100 : 0;
    this.setAttribute('aria-valuenow', String(clamped));
    this.setAttribute('aria-valuemin', '0');
    this.setAttribute('aria-valuemax', String(max));
    // Radix/shadcn data-attribute portability — class strings like
    //   data-[state=loading]:animate-pulse
    //   data-[state=indeterminate]:bg-muted
    // can target our progress now. State = indeterminate when `value`
    // is absent/null (matches Radix), loading while strictly less than
    // max, complete on reach.
    const state =
      rawValue === null || rawValue === '' || !isFinite(value)
        ? 'indeterminate'
        : clamped >= max
          ? 'complete'
          : 'loading';
    this.setAttribute('data-state', state);
    this.setAttribute('data-value', String(clamped));
    this.setAttribute('data-max', String(max));
    if (this._indicator) {
      this._indicator.setAttribute('data-state', state);
      this._indicator.setAttribute('data-value', String(clamped));
      this._indicator.setAttribute('data-max', String(max));
      this._indicator.style.transform = `translateX(-${100 - pct}%)`;
    }
  }
}
defineElement('ui-progress', UiProgress);
