import { WebComponent, html } from '@webjsdev/core';
import '#modules/ui/components/dialog.ts';
import '#modules/ui/components/command.ts';

type Dialog = HTMLElement & { open: boolean };

/**
 * `<docs-command-menu>` adds the keyboard shortcuts to the /ui header's
 * search palette, shadcn's CommandMenu. The trigger, the dialog and its items
 * are the server's markup (lib/ui/docs/command-menu.ts), and the trigger
 * opens the dialog by itself; this element only adds what the markup cannot,
 * so the island is the behaviour and not the list.
 *
 * Cmd+K / Ctrl+K and "/" toggle it, as shadcn's do, except while the reader
 * is typing in a field. Each open starts on an empty search. A navigation
 * closes it: each item holds a real link, which the client router follows,
 * and `webjs:navigate` / `popstate` are both listened to for the reason
 * components/docs-drawer.ts gives.
 */
export class DocsCommandMenu extends WebComponent {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-open-change', this._onOpenChange);
    document.addEventListener('keydown', this._onKey);
    document.addEventListener('webjs:navigate', this._close);
    window.addEventListener('popstate', this._close);
  }

  disconnectedCallback() {
    this.removeEventListener('ui-open-change', this._onOpenChange);
    document.removeEventListener('keydown', this._onKey);
    document.removeEventListener('webjs:navigate', this._close);
    window.removeEventListener('popstate', this._close);
    super.disconnectedCallback();
  }

  _dialog(): Dialog | null {
    return this.querySelector<Dialog>('ui-dialog');
  }

  open(): void {
    const dialog = this._dialog();
    if (dialog && !dialog.open) dialog.open = true;
  }

  // Each open starts on an empty search, however it was opened.
  _onOpenChange = (e: Event): void => {
    if (!(e as CustomEvent<{ open: boolean }>).detail?.open) return;
    const input = this.querySelector<HTMLInputElement>('input[data-slot="command-input"]');
    if (input && input.value) {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  _close = (): void => {
    const dialog = this._dialog();
    if (dialog?.open) dialog.open = false;
  };

  _onKey = (e: KeyboardEvent): void => {
    if (!((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/')) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement)) return;
    e.preventDefault();
    const dialog = this._dialog();
    if (dialog?.open) this._close();
    else this.open();
  };

  render() {
    return html`<slot></slot>`;
  }
}
DocsCommandMenu.register('docs-command-menu');
