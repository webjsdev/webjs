import { WebComponent, html, signal } from '@webjsdev/core';

/*
 * `<copy-cmd>` wraps a shell command with a click-to-copy affordance,
 * adapted from the WebJs marketing site's copy-cmd to plain CSS (the
 * redesign is not Tailwind). Light DOM: the whole chip is the click target,
 * the icon flips to a check for ~1.5s after a copy. Progressive enhancement,
 * with JS off it renders as a plain command chip.
 *
 * Usage: <copy-cmd>npm create webjs@latest my-app</copy-cmd>
 */
export class CopyCmd extends WebComponent {
  copied = signal(false);
  private _t: number | undefined;

  disconnectedCallback() {
    if (this._t) clearTimeout(this._t);
    super.disconnectedCallback?.();
  }

  private _copy = async () => {
    const el = this.querySelector('[data-copy-text]');
    const text = (el?.textContent || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard blocked (insecure context / denied). Silent no-op.
      return;
    }
    this.copied.set(true);
    if (this._t) clearTimeout(this._t);
    this._t = setTimeout(() => this.copied.set(false), 1500) as unknown as number;
  };

  private _onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._copy();
    }
  };

  render() {
    const c = this.copied.get();
    return html`
      <span
        class=${'ccmd' + (c ? ' is-copied' : '')}
        role="button"
        tabindex="0"
        aria-label="Copy command to clipboard"
        @click=${this._copy}
        @keydown=${this._onKey}
      >
        <span class="ccmd-text" data-copy-text><slot></slot></span>
        <span class="ccmd-icon" aria-hidden="true">${c ? CHECK_ICON : COPY_ICON}</span>
        <span class="sr-only" role="status" aria-live="polite">${c ? 'Copied' : ''}</span>
      </span>
    `;
  }
}

const COPY_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

const CHECK_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

CopyCmd.register('copy-cmd');
