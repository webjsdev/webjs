import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';

export class UiSkeleton extends WebComponent {
  static properties = { className: { type: String } };
  declare className: string;
  constructor() { super(); this.className = ''; }

  render() {
    return html`<div data-slot="skeleton" class=${cn('bg-accent animate-pulse rounded-md', this.className)}></div>`;
  }
}
UiSkeleton.register('ui-skeleton');
