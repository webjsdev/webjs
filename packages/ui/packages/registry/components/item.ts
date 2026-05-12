import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Item family — list-style row composed of media + content + actions.
 *
 *   <ui-item-group>
 *     <ui-item>
 *       <ui-item-media variant="icon"><svg/></ui-item-media>
 *       <ui-item-content>
 *         <ui-item-title>Title</ui-item-title>
 *         <ui-item-description>Description</ui-item-description>
 *       </ui-item-content>
 *       <ui-item-actions><ui-button>Open</ui-button></ui-item-actions>
 *     </ui-item>
 *     <ui-item-separator></ui-item-separator>
 *     <ui-item>...</ui-item>
 *   </ui-item-group>
 */

function makeWrapper(tag: string, slot: string, element: string, classes: string, extraAttrs = '') {
  class Wrap extends WebComponent {
    private _slot = '';
    connectedCallback() {
      if (!this._slot) this._slot = this.getSourceChildren();
      super.connectedCallback();
    }
    render() {
      const open = `<${element} data-slot="${slot}" ${extraAttrs} class="${cn(classes)}">`;
      const close = `</${element}>`;
      return html`${unsafeHTML(open + this._slot + close)}`;
    }
  }
  Wrap.register(tag);
  return Wrap;
}

export const UiItemGroup = makeWrapper(
  'ui-item-group',
  'item-group',
  'div',
  'group/item-group flex flex-col',
  'role="list"',
);

const itemBase =
  'group/item flex flex-wrap items-center rounded-md border border-transparent text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-accent/50';

const itemVariants = {
  default: 'bg-transparent',
  outline: 'border-border',
  muted: 'bg-muted/50',
} as const;

const itemSizes = {
  default: 'gap-4 p-4',
  sm: 'gap-2.5 px-4 py-3',
} as const;

export type ItemVariant = keyof typeof itemVariants;
export type ItemSize = keyof typeof itemSizes;

export class UiItem extends WebComponent {
  static properties = {
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
  };
  declare variant: ItemVariant;
  declare size: ItemSize;

  private _slot = '';

  constructor() {
    super();
    this.variant = 'default';
    this.size = 'default';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }

  render() {
    return html`<div
      data-slot="item"
      data-variant=${this.variant}
      data-size=${this.size}
      class=${cn(itemBase, itemVariants[this.variant] || itemVariants.default, itemSizes[this.size] || itemSizes.default)}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiItem.register('ui-item');

const itemMediaBase =
  'flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:translate-y-0.5 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none';

const itemMediaVariants = {
  default: 'bg-transparent',
  icon: "size-8 rounded-sm border bg-muted [&_svg:not([class*='size-'])]:size-4",
  image: 'size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover',
} as const;

export type ItemMediaVariant = keyof typeof itemMediaVariants;

export class UiItemMedia extends WebComponent {
  static properties = {
    variant: { type: String, reflect: true },
  };
  declare variant: ItemMediaVariant;

  private _slot = '';

  constructor() {
    super();
    this.variant = 'default';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }

  render() {
    return html`<div
      data-slot="item-media"
      data-variant=${this.variant}
      class=${cn(itemMediaBase, itemMediaVariants[this.variant] || itemMediaVariants.default)}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiItemMedia.register('ui-item-media');

export const UiItemContent = makeWrapper(
  'ui-item-content',
  'item-content',
  'div',
  'flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none',
);

export const UiItemTitle = makeWrapper(
  'ui-item-title',
  'item-title',
  'div',
  'flex w-fit items-center gap-2 text-sm leading-snug font-medium',
);

export const UiItemDescription = makeWrapper(
  'ui-item-description',
  'item-description',
  'p',
  'line-clamp-2 text-sm leading-normal font-normal text-balance text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
);

export const UiItemActions = makeWrapper(
  'ui-item-actions',
  'item-actions',
  'div',
  'flex items-center gap-2',
);

export const UiItemHeader = makeWrapper(
  'ui-item-header',
  'item-header',
  'div',
  'flex basis-full items-center justify-between gap-2',
);

export const UiItemFooter = makeWrapper(
  'ui-item-footer',
  'item-footer',
  'div',
  'flex basis-full items-center justify-between gap-2',
);

/**
 * Horizontal separator between items. Pure styling — no <ui-separator>
 * dependency, so authors can use <ui-item> standalone.
 */
export class UiItemSeparator extends WebComponent {
  render() {
    return html`<div
      data-slot="item-separator"
      role="separator"
      aria-orientation="horizontal"
      class=${cn('my-0 shrink-0 bg-border h-px w-full')}
    ></div>`;
  }
}
UiItemSeparator.register('ui-item-separator');
