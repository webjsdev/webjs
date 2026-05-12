import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Empty-state family.
 *
 *   <ui-empty>
 *     <ui-empty-header>
 *       <ui-empty-media variant="icon"><svg .../></ui-empty-media>
 *       <ui-empty-title>No results</ui-empty-title>
 *       <ui-empty-description>Try a different search.</ui-empty-description>
 *     </ui-empty-header>
 *     <ui-empty-content>
 *       <ui-button>Reset</ui-button>
 *     </ui-empty-content>
 *   </ui-empty>
 */

function makeWrapper(tag: string, slot: string, classes: string) {
  class Wrap extends WebComponent {
    private _slot = '';
    connectedCallback() {
      if (!this._slot) this._slot = this.innerHTML;
      super.connectedCallback();
    }
    render() {
      return html`<div data-slot=${slot} class=${cn(classes)}>${unsafeHTML(this._slot)}</div>`;
    }
  }
  Wrap.register(tag);
  return Wrap;
}

export const UiEmpty = makeWrapper(
  'ui-empty',
  'empty',
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12',
);

export const UiEmptyHeader = makeWrapper(
  'ui-empty-header',
  'empty-header',
  'flex max-w-sm flex-col items-center gap-2 text-center',
);

const emptyMediaVariants = {
  default: 'bg-transparent',
  icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
} as const;

export type EmptyMediaVariant = keyof typeof emptyMediaVariants;

export class UiEmptyMedia extends WebComponent {
  static properties = {
    variant: { type: String, reflect: true },
  };
  declare variant: EmptyMediaVariant;

  private _slot = '';

  constructor() {
    super();
    this.variant = 'default';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    return html`<div
      data-slot="empty-icon"
      data-variant=${this.variant}
      class=${cn(
        'mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
        emptyMediaVariants[this.variant] || emptyMediaVariants.default,
      )}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiEmptyMedia.register('ui-empty-media');

export const UiEmptyTitle = makeWrapper(
  'ui-empty-title',
  'empty-title',
  'text-lg font-medium tracking-tight',
);

export const UiEmptyDescription = makeWrapper(
  'ui-empty-description',
  'empty-description',
  'text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
);

export const UiEmptyContent = makeWrapper(
  'ui-empty-content',
  'empty-content',
  'flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance',
);
