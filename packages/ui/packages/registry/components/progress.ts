import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';

/**
 * Linear progress bar. `value` is a number 0–100.
 */
export class UiProgress extends WebComponent {
  static properties = {
    value: { type: Number, reflect: true },
    max: { type: Number },
  };
  declare value: number;
  declare max: number;

  constructor() {
    super();
    this.value = 0;
    this.max = 100;
  }

  render() {
    const v = Math.max(0, Math.min(this.value || 0, this.max || 100));
    const offset = 100 - (v / (this.max || 100)) * 100;
    return html`<div
      data-slot="progress"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax=${this.max}
      aria-valuenow=${v}
      class=${cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20')}
    >
      <div
        data-slot="progress-indicator"
        class="h-full w-full flex-1 bg-primary transition-all"
        style="transform: translateX(-${offset}%);"
      ></div>
    </div>`;
  }
}
UiProgress.register('ui-progress');
