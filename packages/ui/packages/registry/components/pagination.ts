import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Pagination. Composition:
 *
 *   <ui-pagination>
 *     <ui-pagination-content>
 *       <ui-pagination-item><ui-pagination-previous href="?page=1"></ui-pagination-previous></ui-pagination-item>
 *       <ui-pagination-item><ui-pagination-link href="?page=1">1</ui-pagination-link></ui-pagination-item>
 *       <ui-pagination-item><ui-pagination-link href="?page=2" active>2</ui-pagination-link></ui-pagination-item>
 *       <ui-pagination-item><ui-pagination-ellipsis></ui-pagination-ellipsis></ui-pagination-item>
 *       <ui-pagination-item><ui-pagination-next href="?page=3"></ui-pagination-next></ui-pagination-item>
 *     </ui-pagination-content>
 *   </ui-pagination>
 */

// Inline button class fragments (matching button.ts variants) so we don't
// have to depend on its private internals at runtime.
const buttonBase =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const buttonVariantClasses = {
  outline:
    'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
  ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
};

const buttonSizeClasses = {
  default: 'h-9 px-4 py-2 has-[>svg]:px-3',
  icon: 'size-9',
};

function linkClasses(isActive: boolean, size: 'icon' | 'default') {
  return cn(
    buttonBase,
    isActive ? buttonVariantClasses.outline : buttonVariantClasses.ghost,
    buttonSizeClasses[size],
  );
}

export class UiPagination extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      class=${cn('mx-auto flex w-full justify-center')}
    >${unsafeHTML(this._slot)}</nav>`;
  }
}
UiPagination.register('ui-pagination');

export class UiPaginationContent extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<ul
      data-slot="pagination-content"
      class=${cn('flex flex-row items-center gap-1')}
    >${unsafeHTML(this._slot)}</ul>`;
  }
}
UiPaginationContent.register('ui-pagination-content');

export class UiPaginationItem extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<li data-slot="pagination-item">${unsafeHTML(this._slot)}</li>`;
  }
}
UiPaginationItem.register('ui-pagination-item');

export class UiPaginationLink extends WebComponent {
  static properties = {
    href: { type: String, reflect: true },
    active: { type: Boolean, reflect: true },
    size: { type: String, reflect: true },
  };
  declare href: string;
  declare active: boolean;
  declare size: 'icon' | 'default';

  private _slot = '';

  constructor() {
    super();
    this.href = '';
    this.active = false;
    this.size = 'icon';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    return html`<a
      href=${this.href || '#'}
      aria-current=${this.active ? 'page' : null}
      data-slot="pagination-link"
      data-active=${this.active ? 'true' : 'false'}
      class=${linkClasses(this.active, this.size)}
    >${unsafeHTML(this._slot)}</a>`;
  }
}
UiPaginationLink.register('ui-pagination-link');

export class UiPaginationPrevious extends WebComponent {
  static properties = {
    href: { type: String, reflect: true },
  };
  declare href: string;

  constructor() {
    super();
    this.href = '';
  }

  render() {
    return html`<a
      href=${this.href || '#'}
      aria-label="Go to previous page"
      data-slot="pagination-link"
      data-active="false"
      class=${cn(linkClasses(false, 'default'), 'gap-1 px-2.5 sm:pl-2.5')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      ><path d="m15 18-6-6 6-6"/></svg>
      <span class="hidden sm:block">Previous</span>
    </a>`;
  }
}
UiPaginationPrevious.register('ui-pagination-previous');

export class UiPaginationNext extends WebComponent {
  static properties = {
    href: { type: String, reflect: true },
  };
  declare href: string;

  constructor() {
    super();
    this.href = '';
  }

  render() {
    return html`<a
      href=${this.href || '#'}
      aria-label="Go to next page"
      data-slot="pagination-link"
      data-active="false"
      class=${cn(linkClasses(false, 'default'), 'gap-1 px-2.5 sm:pr-2.5')}
    >
      <span class="hidden sm:block">Next</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      ><path d="m9 18 6-6-6-6"/></svg>
    </a>`;
  }
}
UiPaginationNext.register('ui-pagination-next');

export class UiPaginationEllipsis extends WebComponent {
  render() {
    return html`<span
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      class=${cn('flex size-9 items-center justify-center')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-4"
      ><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
      <span class="sr-only">More pages</span>
    </span>`;
  }
}
UiPaginationEllipsis.register('ui-pagination-ellipsis');
