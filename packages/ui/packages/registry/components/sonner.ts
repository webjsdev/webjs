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
 *   toast.success('Saved!');
 *   toast.error('Could not save', { duration: 6000 });
 *   toast({
 *     title: 'Note deleted',
 *     action: { label: 'Undo', onClick: () => restore() },
 *     cancel: { label: 'Dismiss' },
 *   });
 *   toast.dismiss();          // dismiss all
 *   toast.dismiss(id);        // dismiss one
 *
 * v2 SCOPE: swipe-to-dismiss (horizontal drag for left/right positions,
 * vertical for top/bottom-center), action + cancel buttons, variant
 * helpers (toast.success/info/warning/error/message), `toast.dismiss(id?)`.
 */

export type ToastVariant = 'default' | 'destructive' | 'success' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick?: () => void;
}

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  id?: string;
  action?: ToastAction;
  cancel?: ToastAction;
}

interface Toast {
  id: string;
  title: string;
  description: string;
  variant: ToastVariant;
  duration: number;
  action: ToastAction | null;
  cancel: ToastAction | null;
}

let nextId = 0;
/** Callback registry — keyed by toast id, looked up at click time. */
const actionRegistry = new Map<string, { action: ToastAction | null; cancel: ToastAction | null }>();

interface ToastFn {
  (opts: ToastOptions | string): string;
  dismiss: (id?: string) => void;
  message: (title: string, opts?: Omit<ToastOptions, 'variant' | 'title'>) => string;
  success: (title: string, opts?: Omit<ToastOptions, 'variant' | 'title'>) => string;
  error: (title: string, opts?: Omit<ToastOptions, 'variant' | 'title'>) => string;
  info: (title: string, opts?: Omit<ToastOptions, 'variant' | 'title'>) => string;
  warning: (title: string, opts?: Omit<ToastOptions, 'variant' | 'title'>) => string;
}

function dispatchToast(opts: ToastOptions): string {
  const detail: Toast = {
    id: opts.id ?? `t${Date.now()}-${nextId++}`,
    title: opts.title ?? '',
    description: opts.description ?? '',
    variant: opts.variant ?? 'default',
    duration: opts.duration ?? 4000,
    action: opts.action ?? null,
    cancel: opts.cancel ?? null,
  };
  // Callbacks can't survive a CustomEvent detail clone across realms in
  // theory; in practice we route them through a side-table keyed by id
  // so the renderer can invoke them on click without serialising them.
  actionRegistry.set(detail.id, { action: detail.action, cancel: detail.cancel });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ui-toast', { detail }));
  }
  return detail.id;
}

const toastImpl = ((opts: ToastOptions | string): string => {
  if (typeof opts === 'string') return dispatchToast({ title: opts });
  return dispatchToast(opts);
}) as ToastFn;

toastImpl.dismiss = (id?: string) => {
  if (typeof window === 'undefined') return;
  if (id) {
    actionRegistry.delete(id);
    window.dispatchEvent(new CustomEvent('ui-toast-dismiss', { detail: { id } }));
  } else {
    actionRegistry.clear();
    window.dispatchEvent(new CustomEvent('ui-toast-dismiss', { detail: { all: true } }));
  }
};

toastImpl.message = (title, opts) => dispatchToast({ ...opts, title, variant: 'default' });
toastImpl.success = (title, opts) => dispatchToast({ ...opts, title, variant: 'success' });
toastImpl.error = (title, opts) => dispatchToast({ ...opts, title, variant: 'destructive' });
toastImpl.info = (title, opts) => dispatchToast({ ...opts, title, variant: 'info' });
toastImpl.warning = (title, opts) => dispatchToast({ ...opts, title, variant: 'warning' });

export const toast: ToastFn = toastImpl;

/** Backwards-compatible export. Prefer `toast.dismiss(id)`. */
export function dismissToast(id?: string) {
  toastImpl.dismiss(id);
}
/** Convenience alias. */
export const dismiss = toastImpl.dismiss;

const variantClasses: Record<ToastVariant, string> = {
  default: 'bg-popover text-popover-foreground border',
  destructive: 'bg-destructive text-white border-destructive',
  success: 'bg-popover text-popover-foreground border-green-500/40',
  info: 'bg-popover text-popover-foreground border-blue-500/40',
  warning: 'bg-popover text-popover-foreground border-yellow-500/40',
};

/** Dismiss threshold — drag more than this fraction of width to dismiss. */
const SWIPE_THRESHOLD = 0.4;

interface SwipeState {
  pointerId: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
  axis: 'x' | 'y';
}

export class UiSonner extends WebComponent {
  static properties = {
    position: { type: String, reflect: true },
  };
  declare position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'top-center' | 'bottom-center';

  state: {
    toasts: Toast[];
    /** Per-toast drag delta in pixels along the swipe axis. */
    drag: Record<string, number>;
  } = { toasts: [], drag: {} };
  private _timers = new Map<string, ReturnType<typeof setTimeout>>();
  private _swipe: SwipeState | null = null;

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

  _onDismiss = (e: CustomEvent<{ id?: string; all?: boolean }>) => {
    if (e.detail.all) {
      for (const t of this.state.toasts) this._clearTimer(t.id);
      this.setState({ toasts: [], drag: {} });
      return;
    }
    if (e.detail.id) this._remove(e.detail.id);
  };

  _clearTimer(id: string) {
    const timer = this._timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this._timers.delete(id);
    }
  }

  _remove(id: string) {
    this._clearTimer(id);
    actionRegistry.delete(id);
    const nextDrag = { ...this.state.drag };
    delete nextDrag[id];
    this.setState({ toasts: this.state.toasts.filter((t) => t.id !== id), drag: nextDrag });
  }

  /** Direction of swipe-to-dismiss for the current position. */
  _swipeAxis(): 'x' | 'y' {
    return this.position === 'top-center' || this.position === 'bottom-center' ? 'y' : 'x';
  }

  _onPointerDown = (e: PointerEvent, id: string) => {
    // Don't start a drag from clicks on buttons.
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    const card = (e.currentTarget as HTMLElement);
    const rect = card.getBoundingClientRect();
    this._swipe = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      width: rect.width,
      height: rect.height,
      axis: this._swipeAxis(),
    };
    card.setPointerCapture?.(e.pointerId);
    this._clearTimer(id);
  };

  _onPointerMove = (e: PointerEvent, id: string) => {
    const s = this._swipe;
    if (!s || s.pointerId !== e.pointerId) return;
    const delta = s.axis === 'x' ? e.clientX - s.startX : e.clientY - s.startY;
    this.setState({ drag: { ...this.state.drag, [id]: delta } });
  };

  _onPointerUp = (e: PointerEvent, id: string) => {
    const s = this._swipe;
    if (!s || s.pointerId !== e.pointerId) return;
    const card = e.currentTarget as HTMLElement;
    card.releasePointerCapture?.(e.pointerId);
    const delta = this.state.drag[id] ?? 0;
    const dim = s.axis === 'x' ? s.width : s.height;
    this._swipe = null;
    if (Math.abs(delta) > dim * SWIPE_THRESHOLD) {
      // Animate the rest of the way off-screen, then remove.
      const finalOff = Math.sign(delta) * (dim + 40);
      this.setState({ drag: { ...this.state.drag, [id]: finalOff } });
      setTimeout(() => this._remove(id), 180);
    } else {
      // Snap back.
      const nextDrag = { ...this.state.drag };
      delete nextDrag[id];
      this.setState({ drag: nextDrag });
      // Restart the auto-dismiss timer if there is one.
      const t = this.state.toasts.find((tt) => tt.id === id);
      if (t && t.duration > 0) {
        this._timers.set(id, setTimeout(() => this._remove(id), t.duration));
      }
    }
  };

  _invokeAction(id: string, which: 'action' | 'cancel') {
    const slot = actionRegistry.get(id);
    const fn = which === 'action' ? slot?.action?.onClick : slot?.cancel?.onClick;
    try {
      fn?.();
    } finally {
      this._remove(id);
    }
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
    const axis = this._swipeAxis();
    return html`
      <div
        data-slot="sonner"
        class=${cn(
          'fixed z-[100] flex flex-col gap-2 p-4 w-full max-w-sm pointer-events-none',
          this._posClasses(),
        )}
      >
        ${this.state.toasts.map((t) => {
          const delta = this.state.drag[t.id] ?? 0;
          const transform = delta
            ? axis === 'x'
              ? `transform:translateX(${delta}px);`
              : `transform:translateY(${delta}px);`
            : '';
          const dragging = !!this.state.drag[t.id];
          const opacity = dragging ? Math.max(0, 1 - Math.abs(delta) / 200) : 1;
          return html`
          <div
            role="status"
            aria-live="polite"
            data-slot="sonner-toast"
            data-variant=${t.variant}
            data-toast-id=${t.id}
            style=${`touch-action:${axis === 'x' ? 'pan-y' : 'pan-x'};${transform}opacity:${opacity};transition:${dragging ? 'none' : 'transform 180ms ease, opacity 180ms ease'};`}
            class=${cn(
              'pointer-events-auto w-full rounded-md shadow-lg p-4 flex items-start gap-3 select-none cursor-grab active:cursor-grabbing animate-in slide-in-from-bottom-2 fade-in',
              variantClasses[t.variant],
            )}
            @pointerdown=${(e: PointerEvent) => this._onPointerDown(e, t.id)}
            @pointermove=${(e: PointerEvent) => this._onPointerMove(e, t.id)}
            @pointerup=${(e: PointerEvent) => this._onPointerUp(e, t.id)}
            @pointercancel=${(e: PointerEvent) => this._onPointerUp(e, t.id)}
          >
            <div class="flex-1 min-w-0">
              ${t.title ? html`<div class="text-sm font-semibold">${t.title}</div>` : html``}
              ${t.description ? html`<div class="text-sm opacity-90">${t.description}</div>` : html``}
              ${(t.action || t.cancel) ? html`
                <div class="mt-3 flex items-center gap-2">
                  ${t.action ? html`
                    <button
                      type="button"
                      data-button="action"
                      class="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90"
                      @click=${() => this._invokeAction(t.id, 'action')}
                    >${t.action.label}</button>
                  ` : html``}
                  ${t.cancel ? html`
                    <button
                      type="button"
                      data-button="cancel"
                      class="inline-flex h-8 items-center justify-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted"
                      @click=${() => this._invokeAction(t.id, 'cancel')}
                    >${t.cancel.label}</button>
                  ` : html``}
                </div>
              ` : html``}
            </div>
            <button
              aria-label="Dismiss"
              class="opacity-70 hover:opacity-100 transition-opacity"
              @click=${() => this._remove(t.id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        `;
        })}
      </div>
    `;
  }
}
UiSonner.register('ui-sonner');
