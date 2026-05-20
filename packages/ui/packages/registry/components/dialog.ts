/**
 * Dialog, modal dialog built on the native <dialog> element.
 *
 * The custom element is a thin decorator. All the heavy lifting comes
 * from HTMLDialogElement.showModal():
 *   - Top-layer rendering (no z-index wars)
 *   - ::backdrop pseudo-element for the overlay
 *   - Native focus management: initial focus on first tabbable, Tab
 *     trapped inside the dialog, focus restored on close
 *   - Escape-to-close via the cancel event
 *   - Background made inert (clicks pass through to nothing)
 *
 * Component composition uses named slots: the rendered template emits
 * a programmatic <dialog> with `<slot name="dialog-content">` inside.
 * The user authors `<ui-dialog-content>` as a normal child; the
 * component sets `slot="dialog-content"` on it during connection so
 * the slot machinery routes it inside the <dialog> automatically.
 * Triggers and other children stay in the default slot, outside the
 * <dialog>.
 *
 * shadcn parity:
 *   <Dialog>            → <ui-dialog open>
 *   <DialogTrigger>     → <ui-dialog-trigger>
 *   <DialogContent>     → <ui-dialog-content>
 *   <DialogClose>       → <ui-dialog-close>
 *   <DialogHeader>      → div with dialogHeaderClass()
 *   <DialogTitle>       → h2/div with dialogTitleClass()
 *   <DialogDescription> → p with dialogDescriptionClass()
 *   <DialogFooter>      → div with dialogFooterClass()
 *
 * Attributes on <ui-dialog>:
 *   `open`, boolean (reflected). Presence shows the dialog.
 *
 * Events on <ui-dialog>:
 *   `ui-open-change`, { detail: { open: boolean } }, fires after the
 *     element transitions between open and closed.
 *
 * Programmatic API: .show()  .hide()  .toggle()
 *
 * Design tokens used: --background, --border, --muted-foreground.
 */
import { WebComponent, html } from '@webjskit/core';
import { buttonClass } from './button.ts';

// --------------------------------------------------------------------------
// Class helpers for subparts.
// --------------------------------------------------------------------------

export const dialogHeaderClass = (): string =>
  'flex flex-col gap-2 text-center sm:text-left';

export const dialogTitleClass = (): string =>
  'text-lg leading-none font-semibold';

export const dialogDescriptionClass = (): string =>
  'text-sm text-muted-foreground';

export const dialogFooterClass = (): string =>
  'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end';

export const dialogContentClass = (): string =>
  'fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none sm:max-w-lg';

export const dialogCloseButtonClass = (): string =>
  "absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const DIALOG_CLOSE_X_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>';

// --------------------------------------------------------------------------
// Pre-hydration paint fallback. Before the script upgrades the custom
// elements, <ui-dialog-content> sits in normal flow and would flash
// visible. The selector-based rules hide it until JS marks the host as
// `[open]`. Once upgraded, the native <dialog> wrapper takes over:
// closed `<dialog>` is UA `display: none`; opened via showModal() is
// `display: block` in the top layer.
// --------------------------------------------------------------------------

const STYLES = `
ui-dialog:not([open]) ui-dialog-content { display: none !important; }
ui-dialog[open] { display: contents; }
ui-dialog-content { display: grid; }
`;

// Clears the UA defaults on <dialog> so it becomes an invisible top-layer
// host. The visible box is rendered by <ui-dialog-content>. The
// backdrop: variant styles the ::backdrop pseudo-element.
const NATIVE_DIALOG_CLASS = 'border-0 bg-transparent p-0 m-0 w-0 h-0 max-w-none max-h-none overflow-visible text-inherit backdrop:bg-black/50';

function installStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ui-dialog-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-dialog-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

// --------------------------------------------------------------------------
// Body scroll lock. Refcounted so nested dialogs unlock in order. Native
// <dialog> does not lock body scroll, only inert-ifies the background.
// --------------------------------------------------------------------------

let scrollLockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';

function lockScroll(): void {
  if (scrollLockCount === 0) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    savedOverflow = document.body.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  scrollLockCount++;
}

function unlockScroll(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

// --------------------------------------------------------------------------
// <ui-dialog>
// --------------------------------------------------------------------------

export class UiDialog extends WebComponent {
  static properties = {
    open: { type: Boolean, reflect: true },
  };
  declare open: boolean;

  _lastOpen: boolean = false;

  constructor() {
    super();
    this.open = false;
  }

  // Slot-routing has to run BEFORE the framework captures authored
  // children: we set `slot="dialog-content"` on the user's
  // <ui-dialog-content> so the slot machinery projects it into the
  // named slot inside the <dialog>. Also strip the legacy
  // <ui-dialog-overlay> (native ::backdrop replaces it).
  connectedCallback(): void {
    installStyles();
    const content = this.querySelector<HTMLElement>(':scope > ui-dialog-content');
    if (content && !content.hasAttribute('slot')) {
      content.setAttribute('slot', 'dialog-content');
    }
    this.querySelector<HTMLElement>(':scope > ui-dialog-overlay')?.remove();
    super.connectedCallback?.();
  }

  disconnectedCallback(): void {
    if (this.open) this._teardown();
    super.disconnectedCallback?.();
  }

  show(): void { this.open = true; }
  hide(): void { this.open = false; }
  toggle(): void { this.open = !this.open; }

  // Back-compat getter alongside the reactive `open` prop.
  get isOpen(): boolean { return this.open; }

  render() {
    // Track open transitions to call showModal / close imperatively.
    // RAF defers until the rendered <dialog> is in the DOM and the
    // descendant <ui-dialog-content> has settled its own first render
    // (the named slot projection cascade).
    if (this._lastOpen !== this.open) {
      this._lastOpen = this.open;
      requestAnimationFrame(() => {
        if (this.open) this._setup();
        else this._teardown();
        this.dispatchEvent(
          new CustomEvent('ui-open-change', { detail: { open: this.open }, bubbles: true }),
        );
      });
    }
    return html`<div data-slot="dialog" data-state=${this.open ? 'open' : 'closed'}>
      <slot></slot>
      <dialog
        data-slot="dialog-native"
        class=${NATIVE_DIALOG_CLASS}
        @close=${this._onNativeClose}
        @click=${this._onNativeClick}
      ><slot name="dialog-content"></slot></dialog>
    </div>`;
  }

  get _native(): HTMLDialogElement | null {
    return this.querySelector<HTMLDialogElement>('dialog[data-slot="dialog-native"]');
  }

  _setup(): void {
    const native = this._native;
    if (!native) return;
    lockScroll();
    if (!native.open) native.showModal();
  }

  _teardown(): void {
    unlockScroll();
    const native = this._native;
    if (native?.open) native.close();
  }

  _onNativeClose = (): void => {
    if (this.open) this.open = false;
  };

  _onNativeClick = (e: MouseEvent): void => {
    if (e.target === this._native) this.hide();
  };
}
UiDialog.register('ui-dialog');

// --------------------------------------------------------------------------
// <ui-dialog-trigger>
// --------------------------------------------------------------------------

export class UiDialogTrigger extends WebComponent {
  render() {
    return html`<div
      data-slot="dialog-trigger"
      @click=${this._onClick}
    ><slot></slot></div>`;
  }

  _onClick = (): void => {
    (this.closest('ui-dialog') as UiDialog | null)?.show();
  };
}
UiDialogTrigger.register('ui-dialog-trigger');

// --------------------------------------------------------------------------
// <ui-dialog-content>
// Auto-injects an X close button (top-right) unless show-close-button="false".
// --------------------------------------------------------------------------

export class UiDialogContent extends WebComponent {
  static properties = {
    showCloseButton: { type: String, reflect: true, attribute: 'show-close-button' },
  };
  declare showCloseButton: string;

  constructor() {
    super();
    this.showCloseButton = 'true';
  }

  render() {
    const wantClose = this.showCloseButton !== 'false';
    return html`<div
      data-slot="dialog-content"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      data-state=${this._parent()?.open ? 'open' : 'closed'}
      class=${dialogContentClass()}
    >
      <slot></slot>
      ${wantClose
        ? html`<ui-dialog-close
            aria-label="Close"
            class=${dialogCloseButtonClass()}
            .innerHTML=${DIALOG_CLOSE_X_SVG}
          ></ui-dialog-close>`
        : ''}
    </div>`;
  }

  _parent(): UiDialog | null {
    return this.closest('ui-dialog') as UiDialog | null;
  }
}
UiDialogContent.register('ui-dialog-content');

// --------------------------------------------------------------------------
// <ui-dialog-close>
// --------------------------------------------------------------------------

export class UiDialogClose extends WebComponent {
  render() {
    return html`<div
      data-slot="dialog-close"
      @click=${this._onClick}
    ><slot></slot></div>`;
  }

  _onClick = (): void => {
    (this.closest('ui-dialog') as UiDialog | null)?.hide();
  };
}
UiDialogClose.register('ui-dialog-close');

// --------------------------------------------------------------------------
// <ui-dialog-footer>
// --------------------------------------------------------------------------

export class UiDialogFooter extends WebComponent {
  static properties = {
    showCloseButton: { type: String, attribute: 'show-close-button' },
  };
  declare showCloseButton: string | null;

  constructor() {
    super();
    this.showCloseButton = null;
  }

  render() {
    const wantClose = this.showCloseButton !== null && this.showCloseButton !== 'false';
    return html`<div data-slot="dialog-footer" class=${dialogFooterClass()}>
      <slot></slot>
      ${wantClose
        ? html`<ui-dialog-close>
            <button class=${buttonClass({ variant: 'outline' })} type="button">Close</button>
          </ui-dialog-close>`
        : ''}
    </div>`;
  }
}
UiDialogFooter.register('ui-dialog-footer');
