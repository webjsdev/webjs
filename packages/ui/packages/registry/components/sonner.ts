/**
 * Sonner — toast notification queue. Hand-rolled (no `sonner` npm package).
 *
 * shadcn parity: `<Toaster />` component + `toast()` function with success,
 * error, info, warning, loading, promise methods.
 *
 * Usage:
 *   Place once at the root of your app (typically in layout.ts):
 *     <ui-sonner position="bottom-right"></ui-sonner>
 *
 *   Then anywhere:
 *     import { toast } from '@/components/ui/sonner.ts';
 *     toast('Saved!');
 *     toast.success('Account created');
 *     toast.error('Failed to save', { description: 'Try again' });
 *     toast.promise(savePost(), { loading: 'Saving…', success: 'Saved', error: 'Failed' });
 *
 * Design tokens used: --popover, --popover-foreground, --border, --radius.
 */
import { cn, Base, defineElement } from '../lib/utils.ts';

type ToastType = 'default' | 'success' | 'error' | 'info' | 'warning' | 'loading';

interface ToastOptions {
  id?: string | number;
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: string | number;
  type: ToastType;
  message: string;
}

let nextId = 1;
const toaster: { add(t: ToastItem): void; remove(id: string | number): void } = {
  add() {},
  remove() {},
};

function publish(item: ToastItem): string | number {
  toaster.add(item);
  return item.id;
}

function makeToast(message: string, opts: ToastOptions = {}, type: ToastType = 'default'): string | number {
  return publish({
    id: opts.id ?? nextId++,
    type,
    message,
    description: opts.description,
    duration: opts.duration ?? (type === 'loading' ? 0 : 4000),
    action: opts.action,
  });
}

export function toast(message: string, opts?: ToastOptions): string | number {
  return makeToast(message, opts, 'default');
}
toast.success = (msg: string, o?: ToastOptions) => makeToast(msg, o, 'success');
toast.error = (msg: string, o?: ToastOptions) => makeToast(msg, o, 'error');
toast.info = (msg: string, o?: ToastOptions) => makeToast(msg, o, 'info');
toast.warning = (msg: string, o?: ToastOptions) => makeToast(msg, o, 'warning');
toast.loading = (msg: string, o?: ToastOptions) => makeToast(msg, o, 'loading');
toast.dismiss = (id?: string | number) => {
  if (id == null) return;
  toaster.remove(id);
};
toast.promise = <T,>(p: Promise<T>, opts: { loading: string; success: string; error: string }) => {
  const id = toast.loading(opts.loading);
  p.then(() => {
    toast.dismiss(id);
    toast.success(opts.success);
  }).catch(() => {
    toast.dismiss(id);
    toast.error(opts.error);
  });
  return id;
};

// --------------------------------------------------------------------------
// <ui-sonner> — the toaster element. Renders pending toasts as children.
// --------------------------------------------------------------------------

const POSITIONS = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
} as const;

export type SonnerPosition = keyof typeof POSITIONS;

const TOAST_ITEM_BASE =
  'pointer-events-auto flex w-80 items-start gap-3 rounded-md border bg-popover p-4 text-sm text-popover-foreground shadow-md transition-all';

const TYPE_ICON_COLOR: Record<ToastType, string> = {
  default: 'text-foreground',
  success: 'text-emerald-500',
  error: 'text-destructive',
  info: 'text-sky-500',
  warning: 'text-amber-500',
  loading: 'text-muted-foreground',
};

export class UiSonner extends Base {
  private _items: ToastItem[] = [];

  connectedCallback(): void {
    const position = (this.getAttribute('position') as SonnerPosition) ?? 'bottom-right';
    this.setAttribute('data-slot', 'sonner');
    this.className = cn(
      'pointer-events-none fixed z-[100] flex flex-col gap-2',
      POSITIONS[position] ?? POSITIONS['bottom-right'],
    );
    toaster.add = (t) => this._add(t);
    toaster.remove = (id) => this._remove(id);
  }

  private _add(item: ToastItem): void {
    this._items.push(item);
    this._render();
    if (item.duration && item.duration > 0) {
      setTimeout(() => this._remove(item.id), item.duration);
    }
  }

  private _remove(id: string | number): void {
    this._items = this._items.filter((i) => i.id !== id);
    this._render();
  }

  private _render(): void {
    this.replaceChildren(
      ...this._items.map((item) => {
        const el = document.createElement('div');
        el.className = TOAST_ITEM_BASE;
        el.setAttribute('data-type', item.type);
        el.setAttribute('role', item.type === 'error' ? 'alert' : 'status');
        el.innerHTML = `
          <div class="${TYPE_ICON_COLOR[item.type]} pt-0.5">${ICONS[item.type]}</div>
          <div class="flex-1">
            <div class="font-medium">${escapeHTML(item.message)}</div>
            ${item.description ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHTML(item.description)}</div>` : ''}
          </div>
        `;
        if (item.action) {
          const btn = document.createElement('button');
          btn.className = 'rounded-md px-2 py-1 text-xs font-medium hover:bg-accent';
          btn.textContent = item.action.label;
          btn.onclick = () => {
            item.action!.onClick();
            this._remove(item.id);
          };
          el.appendChild(btn);
        }
        return el;
      }),
    );
  }
}
defineElement('ui-sonner', UiSonner);

const ICONS: Record<ToastType, string> = {
  default: '',
  success:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  error:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  warning:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  loading:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>',
};

function escapeHTML(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
