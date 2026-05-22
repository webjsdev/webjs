import { WebComponent, html, signal } from '@webjsdev/core';

/**
 * `<copy-cmd>`: wraps a shell-command line with a copy-to-clipboard
 * affordance. Light DOM so the parent's monospace + foreground styling
 * cascades through. The whole component is the click target (text or
 * icon both trigger copy); the icon itself is a hover-revealed visual
 * hint, not a separate focusable element.
 *
 * Usage:
 *   <copy-cmd>npx create-webjs-app@latest my-app</copy-cmd>
 *
 * On click (or Enter / Space), writes the trimmed text content to the
 * clipboard via navigator.clipboard.writeText and flips the icon to a
 * checkmark for ~1.5s.
 */
export class CopyCmd extends WebComponent {
  copied = signal(false);
  private _resetTimer: number | undefined;

  connectedCallback() {
    super.connectedCallback();
    // Make the whole host element act like a button (one focusable
    // target, Enter / Space activate, mouse click anywhere copies).
    // The inner <button> is decorative; we hide it from the a11y tree
    // with aria-hidden + tabindex=-1.
    this.setAttribute('role', 'button');
    this.setAttribute('tabindex', '0');
    this.setAttribute('aria-label', 'Click to copy command');
    this.addEventListener('click', this._handleCopy);
    this.addEventListener('keydown', this._handleKey);
  }

  disconnectedCallback() {
    if (this._resetTimer) clearTimeout(this._resetTimer);
    this.removeEventListener('click', this._handleCopy);
    this.removeEventListener('keydown', this._handleKey);
    super.disconnectedCallback?.();
  }

  _handleCopy = async () => {
    const textEl = this.querySelector('.copy-cmd-text');
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

  _handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._handleCopy();
    }
  };

  render() {
    const isCopied = this.copied.get();
    return html`
      <span class="copy-cmd-text"><slot></slot></span>
      <button class="copy-cmd-btn" aria-hidden="true" tabindex="-1" type="button">
        ${isCopied ? CHECK_ICON : COPY_ICON}
      </button>
    `;
  }
}

const COPY_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

const CHECK_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

CopyCmd.register('copy-cmd');
