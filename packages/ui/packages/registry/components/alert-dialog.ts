/**
 * AlertDialog — modal that requires explicit user confirmation. Variant of
 * Dialog with explicit Cancel/Action buttons.
 *
 * APG pattern: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/
 *
 * shadcn parity:
 *   AlertDialog, AlertDialogTrigger, AlertDialogContent (size: default | sm),
 *   AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
 *   AlertDialogFooter, AlertDialogAction, AlertDialogCancel.
 *
 * Usage:
 *   <ui-alert-dialog>
 *     <ui-alert-dialog-trigger>
 *       <button class=${buttonClass({ variant: 'destructive' })}>Delete</button>
 *     </ui-alert-dialog-trigger>
 *     <ui-alert-dialog-content>
 *       <div class=${alertDialogHeaderClass()}>
 *         <h2 class=${alertDialogTitleClass()}>Delete account?</h2>
 *         <p class=${alertDialogDescriptionClass()}>This cannot be undone.</p>
 *       </div>
 *       <div class=${alertDialogFooterClass()}>
 *         <ui-alert-dialog-cancel>
 *           <button class=${buttonClass({ variant: 'outline' })}>Cancel</button>
 *         </ui-alert-dialog-cancel>
 *         <ui-alert-dialog-action>
 *           <button class=${buttonClass({ variant: 'destructive' })}>Delete</button>
 *         </ui-alert-dialog-action>
 *       </div>
 *     </ui-alert-dialog-content>
 *   </ui-alert-dialog>
 *
 * Behavior is identical to <ui-dialog> except role="alertdialog" and Escape /
 * overlay-click are disabled (user MUST choose Cancel or Action).
 *
 * Design tokens used: --background, --border, --muted-foreground.
 */
import { cn, Base, defineElement } from '../lib/utils.ts';
import { buttonClass, type ButtonVariant, type ButtonSize } from './button.ts';

export const alertDialogContentClass = (): string =>
  'group/alert-dialog-content fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadcn-lg shadow-lg duration-200 data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-lg';

export const alertDialogOverlayClass = (): string => 'fixed inset-0 z-50 bg-black/50';

export const alertDialogHeaderClass = (): string =>
  'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left';

export const alertDialogFooterClass = (): string =>
  'flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end';

export const alertDialogTitleClass = (): string => 'text-lg font-semibold';

export const alertDialogDescriptionClass = (): string => 'text-sm text-muted-foreground';

const STYLES = `
ui-alert-dialog:not([open]) ui-alert-dialog-content,
ui-alert-dialog:not([open]) ui-alert-dialog-overlay { display: none !important; }
ui-alert-dialog-content { display: grid; }
`;

function installStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ui-alert-dialog-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-alert-dialog-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

let scrollLockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';
function lockScroll(): void {
  if (scrollLockCount === 0) {
    // Reserve the gutter the OS scrollbar was occupying so the body doesn't
    // visibly widen when `overflow: hidden` removes it. See dialog.ts for
    // the full rationale — kept in lockstep here because alert-dialog
    // intentionally re-implements the lock (rather than importing from
    // dialog.ts) so users can `webjs ui add alert-dialog` without pulling
    // in the full dialog component.
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

export class UiAlertDialog extends Base {
  static get observedAttributes(): string[] {
    return ['open'];
  }
  private _previouslyFocused: HTMLElement | null = null;

  connectedCallback(): void {
    installStyles();
    this.setAttribute('data-slot', 'alert-dialog');
    if (!this.querySelector(':scope > ui-alert-dialog-overlay')) {
      const overlay = document.createElement('ui-alert-dialog-overlay');
      this.insertBefore(overlay, this.firstChild);
    }
    this._reflect();
  }
  disconnectedCallback(): void {
    if (this.hasAttribute('open')) this._teardown();
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    if (name === 'open' && oldVal !== newVal) {
      this._reflect();
      if (newVal !== null) this._setup();
      else this._teardown();
    }
  }
  show(): void {
    this.setAttribute('open', '');
  }
  hide(): void {
    this.removeAttribute('open');
  }
  private _reflect(): void {
    const open = this.hasAttribute('open');
    this.setAttribute('data-state', open ? 'open' : 'closed');
    const content = this.querySelector<HTMLElement>(':scope > ui-alert-dialog-content');
    if (content) {
      content.setAttribute('data-state', open ? 'open' : 'closed');
      content.setAttribute('role', 'alertdialog');
      content.setAttribute('aria-modal', 'true');
    }
  }
  private _setup(): void {
    this._previouslyFocused = document.activeElement as HTMLElement | null;
    lockScroll();
    queueMicrotask(() => {
      const action = this.querySelector<HTMLElement>('ui-alert-dialog-action button, ui-alert-dialog-action');
      action?.focus({ preventScroll: true });
    });
  }
  private _teardown(): void {
    unlockScroll();
    this._previouslyFocused?.focus({ preventScroll: true });
    this._previouslyFocused = null;
  }
}
defineElement('ui-alert-dialog', UiAlertDialog);

export class UiAlertDialogTrigger extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'alert-dialog-trigger');
    this.addEventListener('click', this._onClick);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
  }
  private _onClick = (): void => (this.closest('ui-alert-dialog') as UiAlertDialog | null)?.show();
}
defineElement('ui-alert-dialog-trigger', UiAlertDialogTrigger);

export class UiAlertDialogContent extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'alert-dialog-content');
    if (!this.hasAttribute('size')) this.setAttribute('size', 'default');
    this.setAttribute('data-size', this.getAttribute('size') ?? 'default');
    this.setAttribute('tabindex', '-1');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(alertDialogContentClass(), userClass);
  }
}
defineElement('ui-alert-dialog-content', UiAlertDialogContent);

export class UiAlertDialogOverlay extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'alert-dialog-overlay');
    this.setAttribute('aria-hidden', 'true');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(alertDialogOverlayClass(), userClass);
    // No click-to-close — alert dialogs require explicit Cancel/Action.
  }
}
defineElement('ui-alert-dialog-overlay', UiAlertDialogOverlay);

// shadcn's <AlertDialogAction> and <AlertDialogCancel> ARE button-styled
// elements with forwarded `variant` and `size` props from the Button
// component. We mirror that: the host element itself receives
// buttonClass({variant, size}) so users can write
//   <ui-alert-dialog-action variant="destructive">Delete</ui-alert-dialog-action>
// and get the right visuals without wrapping a <button>. Cancel defaults
// to variant="outline" (matches shadcn); Action defaults to "default".
//
// Back-compat: if the consumer provided a child <button> (the legacy
// wrap-a-button pattern), we don't restyle the host — their button keeps
// its own buttonClass call and the host stays a transparent wrapper.

function applyAlertDialogButton(host: HTMLElement, defaultVariant: ButtonVariant): void {
  if (host.querySelector(':scope > button')) return;
  const variant = (host.getAttribute('variant') ?? defaultVariant) as ButtonVariant;
  const size = (host.getAttribute('size') ?? 'default') as ButtonSize;
  const userClass = host.getAttribute('class') ?? '';
  host.className = cn(buttonClass({ variant, size }), userClass);
  host.setAttribute('role', 'button');
  if (!host.hasAttribute('tabindex')) host.setAttribute('tabindex', '0');
}

function alertDialogButtonKeydown(this: HTMLElement, e: KeyboardEvent): void {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    this.click();
  }
}

export class UiAlertDialogCancel extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'alert-dialog-cancel');
    applyAlertDialogButton(this, 'outline');
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', alertDialogButtonKeydown as EventListener);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', alertDialogButtonKeydown as EventListener);
  }
  private _onClick = (): void => (this.closest('ui-alert-dialog') as UiAlertDialog | null)?.hide();
}
defineElement('ui-alert-dialog-cancel', UiAlertDialogCancel);

export class UiAlertDialogAction extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'alert-dialog-action');
    applyAlertDialogButton(this, 'default');
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', alertDialogButtonKeydown as EventListener);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', alertDialogButtonKeydown as EventListener);
  }
  private _onClick = (): void => (this.closest('ui-alert-dialog') as UiAlertDialog | null)?.hide();
}
defineElement('ui-alert-dialog-action', UiAlertDialogAction);
