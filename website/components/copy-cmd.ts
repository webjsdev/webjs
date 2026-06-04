import { WebComponent, html, signal } from '@webjsdev/core';

/**
 * `<copy-cmd>` wraps a shell-command line with a copy-to-clipboard
 * affordance. Light DOM, Tailwind utilities throughout. The whole
 * inner wrapper is the click target (text or icon both trigger copy);
 * the icon is an always-visible visual hint, not a separate focusable
 * element. The command text is the button's accessible NAME, and an
 * sr-only aria-describedby hint adds "Copy command to clipboard" as its
 * description, so a screen reader announces both the payload and the
 * action without the label hiding the command.
 *
 * Usage:
 *   <copy-cmd>npm create webjs@latest my-app</copy-cmd>
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
let HINT_SEQ = 0;

export class CopyCmd extends WebComponent {
  copied = signal(false);
  private _resetTimer: number | undefined;
  // Per-instance id so aria-describedby points at this button's own hint
  // (multiple copy-cmd can share a page; the value is document-unique).
  private _hintId = `copy-cmd-hint-${HINT_SEQ++}`;

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
      <span class="group relative flex items-center min-w-0">
        <span
          class="scroll-thin flex-1 min-w-0 overflow-x-auto whitespace-nowrap cursor-copy pr-9 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          data-copy-text
          role="button"
          tabindex="0"
          aria-describedby=${this._hintId}
          @click=${this._copy}
          @keydown=${this._onKey}
        ><slot></slot></span>
        <button
          class="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 p-0 rounded-[7px] border bg-bg-elev cursor-copy transition-[opacity,color,border-color] duration-[140ms] hover:text-fg hover:border-fg-muted ${isCopied ? 'opacity-100 text-[oklch(0.66_0.16_150)] border-accent-tint' : 'opacity-100 text-fg-muted border-border'}"
          type="button"
          aria-hidden="true"
          tabindex="-1"
          @click=${this._copy}
        >${isCopied ? CHECK_ICON : COPY_ICON}</button>
        <span id=${this._hintId} class="sr-only">Copy command to clipboard</span>
        <span class="sr-only" role="status" aria-live="polite">${isCopied ? 'Copied' : ''}</span>
      </span>
    `;
  }
}

const COPY_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

const CHECK_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

CopyCmd.register('copy-cmd');
