import { WebComponent, html, prop, signal } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';

/**
 * `<docs-copy-code>`, shadcn's CopyButton on a /ui docs code block
 * (apps/v4/components/copy-button.tsx and code-block-command.tsx, #1666): an
 * icon button in the block's top right that copies the code and shows a check
 * for two seconds.
 *
 * It reads the code from the figure it sits in, so the HTML carries the
 * source once: a package-manager block (lib/ui/docs/install.ts) copies the
 * command of the selected tab, any other block its `pre`. Copying needs
 * script, so the host is hidden until defined and the code stays readable,
 * and selectable, with JavaScript off. `variant="command"` is the command
 * block's placement and dimmed look.
 */
export class DocsCopyCode extends WebComponent({
  variant: prop<'code' | 'command'>(String),
}) {
  readonly #copied = signal(false);
  private resetTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.variant = 'code';
  }

  disconnectedCallback() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    super.disconnectedCallback?.();
  }

  /** The code this button copies, read from its figure as shown. */
  text(): string {
    const figure = this.closest('figure');
    if (!figure) return '';
    const tab = figure.querySelector('ui-tabs-content:not([hidden]) code');
    const code = tab ?? figure.querySelector('pre code');
    return (code?.textContent ?? '').replace(/\n$/, '');
  }

  private copy = async () => {
    const value = this.text();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    this.#copied.set(true);
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.#copied.set(false), 2000);
  };

  render() {
    const copied = this.#copied.get();
    const command = this.variant === 'command';
    return html`<button type="button" data-copied=${copied ? 'true' : 'false'} class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), 'size-7', command ? 'opacity-70 hover:opacity-100 focus-visible:opacity-100' : 'bg-code hover:opacity-100 focus-visible:opacity-100')} @click=${this.copy}>
      <span class="sr-only">Copy</span>${copied ? CHECK : COPY}
    </button><span class="sr-only" role="status" aria-live="polite">${copied ? 'Copied' : ''}</span>`;
  }
}

// Tabler's copy and check, shadcn's IconCopy and IconCheck.
const COPY = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"></path><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"></path></svg>`;
const CHECK = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10"></path></svg>`;

DocsCopyCode.register('docs-copy-code');
