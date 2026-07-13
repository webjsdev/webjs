import { WebComponent, html } from '@webjsdev/core';

/**
 * `<muted-text>`: small all-caps mono rubric for timestamps and meta.
 * Use for everything that isn't prose: dates, authors, labels, statuses.
 *
 * Display-only WebComponent: projects children into a slot.
 * Tailwind utility classes are applied directly to the host in the constructor.
 */
export class MutedText extends WebComponent {
  constructor() {
    super();
    this.className = 'text-muted-foreground/70 font-mono text-[11px] font-medium leading-snug tracking-[0.12em] uppercase';
  }

  render() {
    return html`<slot></slot>`;
  }
}
MutedText.register('muted-text');
