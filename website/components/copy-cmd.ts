import { WebComponent, html, signal } from '@webjsdev/core';

/**
 * `<copy-cmd>` wraps a shell-command line with a copy-to-clipboard
 * affordance. Light DOM, Tailwind utilities throughout. The whole
 * inner wrapper is the click target (text or icon both trigger copy);
 * the icon is a hover-revealed visual hint, not a separate focusable
 * element.
 *
 * Usage:
 *   <copy-cmd>npx create-webjs-app@latest my-app</copy-cmd>
 *
 * On click (or Enter / Space), writes the trimmed text content to the
 * clipboard via navigator.clipboard.writeText and flips the icon to a
 * checkmark for ~1.5s.
 *
 * Implementation. render() drives all host attributes, classes, and
 * event bindings, so there is no imperative setAttribute or
 * addEventListener in lifecycle hooks. Cleanup of the auto-reset
 * timer happens in disconnectedCallback.
 */
export class CopyCmd extends WebComponent {
  copied = signal(false);
  private _resetTimer: number | undefined;

  disconnectedCallback() {
    if (this._resetTimer) clearTimeout(this._resetTimer);
    super.disconnectedCallback?.();
  }

  _copy = async () => {
    const textEl = this.querySelector('[data-copy-text]');
    const text = (textEl?.textContent || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      if (this._resetTimer) clearTimeout(this._resetTimer);
      this._resetTimer = (setTimeout(() => this.copied.set(false), 1500) as unknown as number);
    } catch {
      // Clipboard API blocked (insecure context, perms denied). Fail
      // silently. The whole feature is progressive enhancement.
    }
  };

  _onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._copy();
    }
  };

  render() {
    const isCopied = this.copied.get();
    return html`
      <span
        role="button"
        tabindex="0"
        aria-label="Click to copy command"
        class="group flex items-center gap-3 text-fg outline-none cursor-copy focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 rounded-sm"
        @click=${this._copy}
        @keydown=${this._onKey}
      >
        <span data-copy-text class="whitespace-nowrap">
          <slot></slot>
        </span>
        <button
          class="flex-shrink-0 inline-flex items-center justify-center w-[26px] h-[26px] p-0 border border-border rounded text-fg-muted bg-transparent cursor-copy opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 hover:text-fg hover:border-fg-muted"
          aria-hidden="true"
          tabindex="-1"
          type="button"
        >${isCopied ? CHECK_ICON : COPY_ICON}</button>
      </span>
    `;
  }
}

const COPY_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

const CHECK_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

CopyCmd.register('copy-cmd');
