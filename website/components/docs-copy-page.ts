import { WebComponent, html, prop, signal } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';

/**
 * `<docs-copy-page href="/ui/llm/...">`, shadcn's Copy Page button
 * (apps/v4/components/docs-copy-page.tsx, #1666): it copies the page's
 * markdown, `href`, to the clipboard, so a reader can hand a whole /ui page,
 * demos' source included, to a coding agent in one paste.
 *
 * Copying needs script, so the docs shell hides this element until it is
 * defined. The "View as Markdown" link beside it is plain markup and works
 * with JavaScript off. The markdown is fetched on the click, never ahead of
 * it, so a page view costs no extra request.
 */
export class DocsCopyPage extends WebComponent({
  href: prop(String),
}) {
  private copied = signal(false);
  private resetTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.href = '';
  }

  disconnectedCallback() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    super.disconnectedCallback?.();
  }

  private copy = async () => {
    if (!this.href) return;
    const text = fetch(this.href).then((res) => {
      if (!res.ok) throw new Error(`${res.status}`);
      return res.text();
    });
    try {
      // A ClipboardItem holding a promise keeps the click's user activation
      // across the fetch, which Safari requires; writeText after an await
      // would be refused there.
      if (typeof ClipboardItem !== 'undefined') {
        const blob = text.then((t) => new Blob([t], { type: 'text/plain' }));
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      } else {
        await navigator.clipboard.writeText(await text);
      }
    } catch {
      // A blocked clipboard or a failed fetch: the View as Markdown link
      // beside the button still opens the same text.
      return;
    }
    this.copied.set(true);
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.copied.set(false), 2000);
  };

  render() {
    const copied = this.copied.get();
    return html`<button type="button" data-slot="button" class=${cn(buttonClass({ variant: 'secondary', size: 'sm' }), 'h-8 shadow-none md:h-7 md:text-[0.8rem]')} @click=${this.copy}>
      ${copied ? CHECK : COPY} Copy Page
    </button><span class="sr-only" role="status" aria-live="polite">${copied ? 'Copied' : ''}</span>`;
  }
}

const COPY = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
const CHECK = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>`;

DocsCopyPage.register('docs-copy-page');
