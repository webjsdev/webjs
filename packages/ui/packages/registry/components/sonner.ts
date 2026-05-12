import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Toast notification system. Mount <ui-sonner></ui-sonner> once near the
 * root of your app (e.g. in your root layout) and dispatch toasts from
 * anywhere via the exported `toast()` helper:
 *
 *   import { toast } from './sonner.ts';
 *   toast({ title: 'Saved', description: 'Your changes were saved.' });
 *   toast({ title: 'Error', variant: 'destructive', duration: 6000 });
 *
 * v1 SCOPE: basic queue, auto-dismiss, manual close. No swipe gestures,
 * no action buttons, no undo, no rich theming beyond `variant`.
 */

export type ToastVariant = 'default' | 'destructive' | 'success' | 'info' | 'warning';

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  id?: string;
}

interface Toast extends Required<Omit<ToastOptions, 'id'>> {
  id: string;
}

let nextId = 0;

export function toast(opts: ToastOptions) {
  const detail: Toast = {
    id: opts.id ?? `t${Date.now()}-${nextId++}`,
    title: opts.title ?? '',
    description: opts.description ?? '',
    variant: opts.variant ?? 'default',
    duration: opts.duration ?? 4000,
  };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ui-toast', { detail }));
  }
  return detail.id;
}

export function dismissToast(id: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ui-toast-dismiss', { detail: { id } }));
  }
}

const variantClasses: Record<ToastVariant, string> = {
  default: 'bg-popover text-popover-foreground border',
  destructive: 'bg-destructive text-white border-destructive',
  success: 'bg-popover text-popover-foreground border-green-500/40',
  info: 'bg-popover text-popover-foreground border-blue-500/40',
  warning: 'bg-popover text-popover-foreground border-yellow-500/40',
};

export class UiSonner extends WebComponent {
  static properties = {
    position: { type: String, reflect: true },
  };
  declare position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'top-center' | 'bottom-center';

  state: { toasts: Toast[] } = { toasts: [] };
  private _timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    super();
    this.position = 'bottom-right';
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('ui-toast', this._onToast as EventListener);
    window.addEventListener('ui-toast-dismiss', this._onDismiss as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('ui-toast', this._onToast as EventListener);
    window.removeEventListener('ui-toast-dismiss', this._onDismiss as EventListener);
    this._timers.forEach((t) => clearTimeout(t));
    this._timers.clear();
  }

  _onToast = (e: CustomEvent<Toast>) => {
    const t = e.detail;
    this.setState({ toasts: [...this.state.toasts, t] });
    if (t.duration > 0) {
      this._timers.set(t.id, setTimeout(() => this._remove(t.id), t.duration));
    }
  };

  _onDismiss = (e: CustomEvent<{ id: string }>) => {
    this._remove(e.detail.id);
  };

  _remove(id: string) {
    const timer = this._timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this._timers.delete(id);
    }
    this.setState({ toasts: this.state.toasts.filter((t) => t.id !== id) });
  }

  _posClasses(): string {
    switch (this.position) {
      case 'top-right':    return 'top-0 right-0 items-end';
      case 'top-left':     return 'top-0 left-0 items-start';
      case 'top-center':   return 'top-0 left-1/2 -translate-x-1/2 items-center';
      case 'bottom-left':  return 'bottom-0 left-0 items-start';
      case 'bottom-center':return 'bottom-0 left-1/2 -translate-x-1/2 items-center';
      case 'bottom-right':
      default:             return 'bottom-0 right-0 items-end';
    }
  }

  render() {
    return html`
      <div
        data-slot="sonner"
        class=${cn(
          'fixed z-[100] flex flex-col gap-2 p-4 w-full max-w-sm pointer-events-none',
          this._posClasses(),
        )}
      >
        ${this.state.toasts.map((t) => html`
          <div
            role="status"
            aria-live="polite"
            data-slot="sonner-toast"
            data-variant=${t.variant}
            class=${cn(
              'pointer-events-auto w-full rounded-md shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-bottom-2 fade-in',
              variantClasses[t.variant],
            )}
          >
            <div class="flex-1 min-w-0">
              ${t.title ? html`<div class="text-sm font-semibold">${t.title}</div>` : html``}
              ${t.description ? html`<div class="text-sm opacity-90">${t.description}</div>` : html``}
            </div>
            <button
              aria-label="Dismiss"
              class="opacity-70 hover:opacity-100 transition-opacity"
              @click=${() => this._remove(t.id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        `)}
      </div>
    `;
  }
}
UiSonner.register('ui-sonner');
