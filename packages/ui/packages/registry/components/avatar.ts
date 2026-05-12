import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Avatar — composed of <ui-avatar>, <ui-avatar-image>, <ui-avatar-fallback>.
 * The image hides itself on load failure so the fallback shows.
 *
 *   <ui-avatar>
 *     <ui-avatar-image src="/me.png" alt="Me"></ui-avatar-image>
 *     <ui-avatar-fallback>VR</ui-avatar-fallback>
 *   </ui-avatar>
 */

export type AvatarSize = 'default' | 'sm' | 'lg';

export class UiAvatar extends WebComponent {
  static properties = {
    size: { type: String, reflect: true },
  };
  declare size: AvatarSize;

  private _slot = '';

  constructor() {
    super();
    this.size = 'default';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    return html`<span
      data-slot="avatar"
      data-size=${this.size}
      class=${cn(
        'group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6',
      )}
    >${unsafeHTML(this._slot)}</span>`;
  }
}
UiAvatar.register('ui-avatar');

export class UiAvatarImage extends WebComponent {
  static properties = {
    src: { type: String, reflect: true },
    alt: { type: String },
    failed: { type: Boolean, state: true },
  };
  declare src: string;
  declare alt: string;
  declare failed: boolean;

  constructor() {
    super();
    this.src = '';
    this.alt = '';
    this.failed = false;
  }

  render() {
    if (!this.src || this.failed) return html``;
    return html`<img
      data-slot="avatar-image"
      src=${this.src}
      alt=${this.alt || null}
      @error=${this._onError}
      class=${cn('aspect-square size-full')}
    />`;
  }

  private _onError = () => {
    this.setState({});
    this.failed = true;
  };
}
UiAvatarImage.register('ui-avatar-image');

export class UiAvatarFallback extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<span
      data-slot="avatar-fallback"
      class=${cn(
        'flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs',
      )}
    >${unsafeHTML(this._slot)}</span>`;
  }
}
UiAvatarFallback.register('ui-avatar-fallback');

export class UiAvatarBadge extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<span
      data-slot="avatar-badge"
      class=${cn(
        'absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background select-none',
        'group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden',
        'group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2',
        'group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2',
      )}
    >${unsafeHTML(this._slot)}</span>`;
  }
}
UiAvatarBadge.register('ui-avatar-badge');

export class UiAvatarGroup extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<div
      data-slot="avatar-group"
      class=${cn(
        'group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background',
      )}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiAvatarGroup.register('ui-avatar-group');

export class UiAvatarGroupCount extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<div
      data-slot="avatar-group-count"
      class=${cn(
        'relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3',
      )}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiAvatarGroupCount.register('ui-avatar-group-count');
