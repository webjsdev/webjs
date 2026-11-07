import { WebComponent, html, prop, signal } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import '#modules/ui/components/dropdown-menu.ts';

/**
 * `<docs-copy-page href="/ui/llm/..." url="https://webjs.dev/ui/...">`,
 * shadcn's DocsCopyPage (apps/v4/components/docs-copy-page.tsx, #1666): a
 * Copy Page button joined to a menu of the page's other forms. Copy Page puts
 * the page's markdown, `href`, on the clipboard, so a reader can hand a whole
 * /ui page, demos' source included, to a coding agent in one paste. The menu
 * holds View as Markdown and shadcn's Open in ChatGPT / Claude prompts about
 * `url` (its Open in v0 has no WebJs counterpart).
 *
 * The server renders it whole, so the row has its final shape on the first
 * paint. Copying and the menu need script, so with scripting off
 * (`noscript:`, `@media (scripting: none)`) they give way to a plain View as
 * Markdown link in the same button group. The markdown is fetched on the
 * click, never ahead of it, so a page view costs no extra request.
 */
export class DocsCopyPage extends WebComponent({
  href: prop(String),
  url: prop(String),
}) {
  private copied = signal(false);
  private resetTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.href = '';
    this.url = '';
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
      // A blocked clipboard or a failed fetch: View as Markdown in the menu
      // still opens the same text.
      return;
    }
    this.copied.set(true);
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.copied.set(false), 2000);
  };

  // A menu item is a div, so the kit synthesizes Enter and Space to select
  // it, which closes the menu but does not follow the link inside. A pointer
  // click lands on the link itself and needs nothing.
  private onMenuKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const link = (e.target as HTMLElement | null)?.closest?.('ui-dropdown-menu-item')?.querySelector('a');
    if (link && this.contains(link)) link.click();
  };

  render() {
    const copied = this.copied.get();
    const button = cn(buttonClass({ variant: 'secondary', size: 'sm' }));
    const prompt = (base: string) => `${base}?q=${encodeURIComponent(`I'm looking at this WebJs UI documentation: ${this.url}.\nHelp me understand how to use it. Be ready to explain concepts, give examples, or help debug based on it.\n`)}`;
    const item = 'flex w-full items-center gap-2 no-underline text-inherit';
    return html`<div class="group/buttons relative flex rounded-lg bg-secondary *:[[data-slot=button]]:focus-visible:relative *:[[data-slot=button]]:focus-visible:z-10">
      <button type="button" data-slot="button" class=${cn(button, 'h-8 shadow-none noscript:hidden md:h-7 md:text-[0.8rem]')} @click=${this.copy}>
        ${copied ? CHECK : COPY} Copy Page
      </button>
      <a href=${this.href} target="_blank" rel="noopener" data-slot="button" class=${cn(button, 'hidden h-8 shadow-none no-underline noscript:inline-flex md:h-7 md:text-[0.8rem]')}>${MARKDOWN} View as Markdown</a>
      <button type="button" id="docs-copy-page-menu" data-slot="button" class=${cn(button, 'peer -ml-0.5 size-8 shadow-none noscript:hidden md:size-7 md:text-[0.8rem]')}>
        ${CHEVRON}<span class="sr-only">More ways to use this page</span>
      </button>
      <ui-dropdown-menu trigger="docs-copy-page-menu" @keydown=${this.onMenuKey}>
        <ui-dropdown-menu-content align="end" class="animate-none! rounded-lg shadow-none">
          <ui-dropdown-menu-item><a href=${this.href} target="_blank" rel="noopener noreferrer" class=${item}>${MARKDOWN} View as Markdown</a></ui-dropdown-menu-item>
          <ui-dropdown-menu-item><a href=${prompt('https://chatgpt.com')} target="_blank" rel="noopener noreferrer" class=${item}>${CHATGPT} Open in ChatGPT</a></ui-dropdown-menu-item>
          <ui-dropdown-menu-item><a href=${prompt('https://claude.ai/new')} target="_blank" rel="noopener noreferrer" class=${item}>${CLAUDE} Open in Claude</a></ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
      <div role="none" data-slot="separator" data-orientation="vertical" class="absolute top-1 right-8 z-0 h-6 w-px bg-foreground/5 peer-focus-visible:opacity-0 noscript:hidden sm:right-7 sm:h-5"></div>
    </div><span class="sr-only" role="status" aria-live="polite">${copied ? 'Copied' : ''}</span>`;
  }
}

const COPY = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
const CHECK = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>`;
// Tabler's chevron-down, shadcn's IconChevronDown, pointing up on a phone.
const CHEVRON = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="rotate-180 sm:rotate-0"><path d="M6 9l6 6l6 -6"></path></svg>`;
// shadcn's three menu marks (components/docs-copy-page.tsx).
const MARKDOWN = html`<svg viewBox="0 0 22 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M19.5 2.25H2.5C1.81 2.25 1.25 2.81 1.25 3.5V12.5C1.25 13.19 1.81 13.75 2.5 13.75H19.5C20.19 13.75 20.75 13.19 20.75 12.5V3.5C20.75 2.81 20.19 2.25 19.5 2.25ZM2.5 1C1.12 1 0 2.12 0 3.5V12.5C0 13.88 1.12 15 2.5 15H19.5C20.88 15 22 13.88 22 12.5V3.5C22 2.12 20.88 1 19.5 1H2.5ZM3 4.5H4.69L7 7.02L9.31 4.5H11V11.5H9V7.8L7 9.98L5 7.8V11.5H3V4.5ZM15 8V4.5H17V8H19.5L16 11.5L12.5 8H15Z"></path></svg>`;
const CHATGPT = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z"></path></svg>`;
const CLAUDE = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m4.714 15.956 4.718-2.648.079-.23-.08-.128h-.23l-.79-.048-2.695-.073-2.337-.097-2.265-.122-.57-.121-.535-.704.055-.353.48-.321.685.06 1.518.104 2.277.157 1.651.098 2.447.255h.389l.054-.158-.133-.097-.103-.098-2.356-1.596-2.55-1.688-1.336-.972-.722-.491L2 6.223l-.158-1.008.655-.722.88.06.225.061.893.686 1.906 1.476 2.49 1.833.364.304.146-.104.018-.072-.164-.274-1.354-2.446-1.445-2.49-.644-1.032-.17-.619a2.972 2.972 0 0 1-.103-.729L6.287.133 6.7 0l.995.134.42.364.619 1.415L9.735 4.14l1.555 3.03.455.898.243.832.09.255h.159V9.01l.127-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.583.28.48.685-.067.444-.286 1.851-.558 2.903-.365 1.942h.213l.243-.242.983-1.306 1.652-2.064.728-.82.85-.904.547-.431h1.032l.759 1.129-.34 1.166-1.063 1.347-.88 1.142-1.263 1.7-.79 1.36.074.11.188-.02 2.853-.606 1.542-.28 1.84-.315.832.388.09.395-.327.807-1.967.486-2.307.462-3.436.813-.043.03.049.061 1.548.146.662.036h1.62l3.018.225.79.522.473.638-.08.485-1.213.62-1.64-.389-3.825-.91-1.31-.329h-.183v.11l1.093 1.068 2.003 1.81 2.508 2.33.127.578-.321.455-.34-.049-2.204-1.657-.85-.747-1.925-1.62h-.127v.17l.443.649 2.343 3.521.122 1.08-.17.353-.607.213-.668-.122-1.372-1.924-1.415-2.168-1.141-1.943-.14.08-.674 7.254-.316.37-.728.28-.607-.461-.322-.747.322-1.476.388-1.924.316-1.53.285-1.9.17-.632-.012-.042-.14.018-1.432 1.967-2.18 2.945-1.724 1.845-.413.164-.716-.37.066-.662.401-.589 2.386-3.036 1.439-1.882.929-1.086-.006-.158h-.055L4.138 18.56l-1.13.146-.485-.456.06-.746.231-.243 1.907-1.312Z"></path></svg>`;

DocsCopyPage.register('docs-copy-page');
