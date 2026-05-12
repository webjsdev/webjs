import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Breadcrumb. Composition:
 *
 *   <ui-breadcrumb>
 *     <ui-breadcrumb-list>
 *       <ui-breadcrumb-item><ui-breadcrumb-link href="/">Home</ui-breadcrumb-link></ui-breadcrumb-item>
 *       <ui-breadcrumb-separator></ui-breadcrumb-separator>
 *       <ui-breadcrumb-item><ui-breadcrumb-page>Current</ui-breadcrumb-page></ui-breadcrumb-item>
 *     </ui-breadcrumb-list>
 *   </ui-breadcrumb>
 */
export class UiBreadcrumb extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<nav
      aria-label="breadcrumb"
      data-slot="breadcrumb"
    >${unsafeHTML(this._slot)}</nav>`;
  }
}
UiBreadcrumb.register('ui-breadcrumb');

export class UiBreadcrumbList extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<ol
      data-slot="breadcrumb-list"
      class=${cn(
        'flex flex-wrap items-center gap-1.5 text-sm break-words text-muted-foreground sm:gap-2.5',
      )}
    >${unsafeHTML(this._slot)}</ol>`;
  }
}
UiBreadcrumbList.register('ui-breadcrumb-list');

export class UiBreadcrumbItem extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<li
      data-slot="breadcrumb-item"
      class=${cn('inline-flex items-center gap-1.5')}
    >${unsafeHTML(this._slot)}</li>`;
  }
}
UiBreadcrumbItem.register('ui-breadcrumb-item');

export class UiBreadcrumbLink extends WebComponent {
  static properties = {
    href: { type: String, reflect: true },
  };
  declare href: string;

  private _slot = '';

  constructor() {
    super();
    this.href = '';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<a
      href=${this.href || '#'}
      data-slot="breadcrumb-link"
      class=${cn('transition-colors hover:text-foreground')}
    >${unsafeHTML(this._slot)}</a>`;
  }
}
UiBreadcrumbLink.register('ui-breadcrumb-link');

export class UiBreadcrumbPage extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      class=${cn('font-normal text-foreground')}
    >${unsafeHTML(this._slot)}</span>`;
  }
}
UiBreadcrumbPage.register('ui-breadcrumb-page');

export class UiBreadcrumbSeparator extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    const inner = this._slot.trim()
      ? unsafeHTML(this._slot)
      : html`<svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ><path d="m9 18 6-6-6-6"/></svg>`;
    return html`<li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      class=${cn('[&>svg]:size-3.5')}
    >${inner}</li>`;
  }
}
UiBreadcrumbSeparator.register('ui-breadcrumb-separator');

export class UiBreadcrumbEllipsis extends WebComponent {
  render() {
    return html`<span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
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
      <span class="sr-only">More</span>
    </span>`;
  }
}
UiBreadcrumbEllipsis.register('ui-breadcrumb-ellipsis');
