/**
 * Progress: determinate progress bar.
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
 *   `value`: number, 0–100. Defaults to 0.
 *   `max`:  number, default 100.
 *
 * The progress is implemented as a custom element because the fill width
 * is driven by a `transform: translateX(-${100 - value}%)` on a child div,
 * which is shadcn's exact approach. A pure class helper can't compute that.
 *
 * Design tokens used: --primary.
 */
import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';

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

export class UiProgress extends WebComponent {
  static properties = {
    value: { type: Number, reflect: true },
    max: { type: Number, reflect: true },
  };
  declare value: number;
  declare max: number;

  _userClass: string = '';

  constructor() {
    super();
    this.value = 0;
    this.max = 100;
  }

  connectedCallback(): void {
    installStyles();
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'progress');
    this.setAttribute('role', 'progressbar');
  }

  render() {
    // Treat a missing or non-finite `value` as indeterminate. The class
    // helper merges the author's authored class with our root class on
    // every render so a runtime class change is preserved.
    const rawValue = this.getAttribute('value');
    const valueIsMissing = rawValue === null || rawValue === '' || !isFinite(this.value);
    const max = isFinite(this.max) && this.max > 0 ? this.max : 100;
    const clamped = Math.max(0, Math.min(max, valueIsMissing ? 0 : this.value));
    const pct = max > 0 ? (clamped / max) * 100 : 0;
    const state = valueIsMissing
      ? 'indeterminate'
      : clamped >= max
        ? 'complete'
        : 'loading';

    this.className = cn(ROOT_CLASS, this._userClass);
    this.setAttribute('aria-valuenow', String(clamped));
    this.setAttribute('aria-valuemin', '0');
    this.setAttribute('aria-valuemax', String(max));
    this.setAttribute('data-state', state);
    this.setAttribute('data-value', String(clamped));
    this.setAttribute('data-max', String(max));

    return html`
      <div
        class=${INDICATOR_CLASS}
        data-slot="progress-indicator"
        data-state=${state}
        data-value=${String(clamped)}
        data-max=${String(max)}
        style=${`transform: translateX(-${100 - pct}%)`}></div>
    `;
  }
}
UiProgress.register('ui-progress');
