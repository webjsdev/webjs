import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';

/**
 * Spinner — an animated loading indicator. Renders the Lucide Loader2 SVG path
 * inline (no lucide dependency needed) with `animate-spin`.
 */
export class UiSpinner extends WebComponent {
  static properties = {
    size: { type: String },
  };
  declare size: string;

  constructor() {
    super();
    this.size = '';
  }

  render() {
    return html`<svg
      role="status"
      aria-label="Loading"
      data-slot="spinner"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class=${cn('size-4 animate-spin', this.size)}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>`;
  }
}
UiSpinner.register('ui-spinner');
