/**
 * Code block: a framed block of code with an optional header, title,
 * actions, footer, line numbers and per-line highlights. Tier 1, with one
 * Tier-2 part, the copy button.
 *
 * shadcn parity:
 *   CodeBlock (variant, size)  → <div data-slot="code-block" data-variant data-size class=${codeBlockClass({ variant })}>
 *                                (codeBlockVariants is the same helper under shadcn's name)
 *   CodeBlockHeader / Title / Actions / Footer
 *                              → <div class=${codeBlockHeaderClass()} data-slot="code-block-header"> and so on
 *   CodeBlockContent (wrap, lineNumbers, startLine)
 *                              → <pre data-slot="code-block-content" tabindex="0" dir="ltr" class=${codeBlockContentClass()}
 *                                ?data-wrap ?data-numbered style="counter-reset: line N">
 *                                <code data-slot="code-block-code" class=${codeBlockCodeClass()}>
 *   CodeBlockLine variant      → codeBlockLines(text, { variants }) for numbered lines, or a
 *                                <span data-slot="code-block-line" class=${codeBlockLineClass({ variant })}> of your own
 *   CodeBlockCopyButton value  → <ui-code-block-copy-button value>, which copies its block's code
 *                                when it has no value
 *
 * `codeBlockLines` splits text on newlines into the line spans numbering and
 * highlights need, keeping an empty line as a newline so a copied selection
 * keeps its blank lines. Pass `{ 3: 'added', 4: 'removed' }` as `variants`
 * (one-based line numbers) to mark lines.
 *
 * A11y (required for accessible output): keep `tabindex="0"` on the `<pre>`,
 * so a keyboard can reach and scroll a block wider than its frame, and
 * `dir="ltr"`, since code reads left to right on any page. A title names the
 * file or language. The copy button is named "Copy", becomes "Copied" for two
 * seconds, and announces it through a polite live region. Added and removed
 * lines are marked by colour and by a "+" / "−" gutter sign, which a screen
 * reader skips, so say what changed in prose when it matters.
 *
 * @example
 * ```html
 * <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
 *   <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
 *     <div data-slot="code-block-title" class=${codeBlockTitleClass()}>app/page.ts</div>
 *     <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
 *       <ui-code-block-copy-button></ui-code-block-copy-button>
 *     </div>
 *   </div>
 *   <pre data-slot="code-block-content" data-numbered tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code
 *     data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(source, { variants: { 2: 'added' } })}</code></pre>
 * </div>
 * ```
 */
import { WebComponent, html, signal } from '@webjsdev/core';
import { cn } from '../lib/utils.ts';
import { buttonClass, type ButtonVariant, type ButtonSize } from './button.ts';

const CODE_BLOCK_VARIANTS = {
  default: 'cn-code-block-variant-default',
  destructive: 'cn-code-block-variant-destructive',
} as const;

export type CodeBlockVariant = keyof typeof CODE_BLOCK_VARIANTS;

/** The frame's classes. */
export function codeBlockClass(opts: { variant?: CodeBlockVariant } = {}): string {
  return cn('cn-code-block group/code-block relative flex w-full min-w-0 flex-col overflow-hidden', CODE_BLOCK_VARIANTS[opts.variant ?? 'default']);
}

/** shadcn's name for {@link codeBlockClass}. Like cva, it merges a `className`. */
export function codeBlockVariants(opts: { variant?: CodeBlockVariant; className?: string } = {}): string {
  return cn(codeBlockClass(opts), opts.className);
}

/** The header row. */
export function codeBlockHeaderClass(): string {
  return 'cn-code-block-header flex min-w-0 shrink-0 items-center *:has-[>[data-slot=code-block-title]]:min-w-0';
}

/** The title in the header. */
export function codeBlockTitleClass(): string {
  return 'cn-code-block-title min-w-0 truncate [&_svg]:pointer-events-none [&_svg]:inline-block [&_svg]:align-middle';
}

/** The actions (in the header, or floating over the code when a direct child of the frame). */
export function codeBlockActionsClass(): string {
  return 'cn-code-block-actions ms-auto flex shrink-0 items-center [[data-slot=code-block]>&]:absolute [[data-slot=code-block]>&]:z-10 [[data-slot=code-block]>&]:opacity-0 [[data-slot=code-block]>&]:transition-opacity [[data-slot=code-block]>&]:group-focus-within/code-block:opacity-100 [[data-slot=code-block]>&]:group-hover/code-block:opacity-100 [[data-slot=code-block]>&]:pointer-coarse:opacity-100';
}

/** The scrolling `<pre>`. */
export function codeBlockContentClass(): string {
  return 'cn-code-block-content min-h-0 min-w-0 scroll-fade-x scrollbar-thin overflow-auto text-start font-mono outline-none data-[wrap]:scroll-fade-y data-[wrap]:wrap-break-word data-[wrap]:whitespace-pre-wrap';
}

/** The `<code>` inside it. */
export function codeBlockCodeClass(): string {
  return 'cn-code-block-code grid min-h-lh min-w-max content-start in-data-numbered:grid-cols-[auto_1fr] in-data-wrap:min-w-0';
}

const CODE_BLOCK_LINE_VARIANTS = {
  default: 'cn-code-block-line-variant-default',
  added: 'cn-code-block-line-variant-added',
  removed: 'cn-code-block-line-variant-removed',
  highlighted: 'cn-code-block-line-variant-highlighted',
} as const;

export type CodeBlockLineVariant = keyof typeof CODE_BLOCK_LINE_VARIANTS;

/** One line's classes. */
export function codeBlockLineClass(opts: { variant?: CodeBlockLineVariant } = {}): string {
  return cn(
    "cn-code-block-line relative block min-h-lh after:absolute after:top-0 after:select-none in-data-numbered:col-span-2 in-data-numbered:grid in-data-numbered:grid-cols-subgrid in-data-numbered:[counter-increment:line] in-data-numbered:before:content-[counter(line)] in-data-numbered:before:select-none in-data-numbered:supports-[content:counter(line)_/_'']:before:content-[counter(line)_/_'']",
    CODE_BLOCK_LINE_VARIANTS[opts.variant ?? 'default'],
  );
}

/** shadcn's name for {@link codeBlockLineClass}. Like cva, it merges a `className`. */
export function codeBlockLineVariants(opts: { variant?: CodeBlockLineVariant; className?: string } = {}): string {
  return cn(codeBlockLineClass(opts), opts.className);
}

/** The footer row. */
export function codeBlockFooterClass(): string {
  return 'cn-code-block-footer flex min-w-0 shrink-0 items-center';
}

/**
 * The line spans for `text`, one per line, for line numbers and highlights.
 * `variants` maps a one-based line number to its variant.
 */
export function codeBlockLines(text: string, opts: { variants?: Record<number, CodeBlockLineVariant> } = {}) {
  const lines = text.replace(/\n$/, '').split(/\n/);
  return lines.map((line, i) => {
    const variant = opts.variants?.[i + 1] ?? 'default';
    // An empty line holds a newline, so copying a selection keeps blank lines.
    // (Spelled as a char code: a string literal holding a newline reads, to the
    // style bake's lexer, like a string that ran into code.)
    return html`<span data-slot="code-block-line" data-variant=${variant} class=${codeBlockLineClass({ variant })}><span data-slot="code-block-line-content" class="min-w-0">${line === '' ? String.fromCharCode(10) : line}</span></span>`;
  });
}

// --------------------------------------------------------------------------
// <ui-code-block-copy-button>
// --------------------------------------------------------------------------

export class UiCodeBlockCopyButton extends WebComponent({
  value: String,
  variant: String,
  size: String,
}) {
  #copied = signal(false);
  _timer = 0;

  constructor() {
    super();
    this.value = '';
    this.variant = 'ghost';
    this.size = 'icon-xs';
  }

  disconnectedCallback(): void {
    clearTimeout(this._timer);
    super.disconnectedCallback?.();
  }

  /** What a click copies: the `value`, else the code in this block. */
  text(): string {
    if (this.value) return this.value;
    const block = this.closest?.('[data-slot="code-block"]');
    const code = block?.querySelector('[data-slot="code-block-code"]') ?? block?.querySelector('code');
    return (code?.textContent ?? '').replace(/\n$/, '');
  }

  render() {
    return html`<button
      type="button"
      data-slot="code-block-copy-button"
      ?data-copied=${!!this.#copied.get()}
      aria-label=${this.#copied.get() ? 'Copied' : 'Copy'}
      class=${cn(buttonClass({ variant: this.variant as ButtonVariant, size: this.size as ButtonSize }), 'cn-code-block-copy-button')}
      @click=${this._onClick}
    >${this.#copied.get()
      ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>`
      : html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`}</button><span aria-live="polite" class="sr-only">${this.#copied.get() ? 'Copied' : ''}</span>`;
  }

  _onClick = (): void => {
    const write = navigator.clipboard?.writeText?.(this.text());
    if (!write) return;
    write.then(() => {
      this.#copied.set(true);
      clearTimeout(this._timer);
      this._timer = window.setTimeout(() => { this.#copied.set(false); }, 2000);
      this.dispatchEvent(new CustomEvent('ui-copy', { bubbles: true, detail: { text: this.text() } }));
    }).catch(() => {});
  };
}
UiCodeBlockCopyButton.register('ui-code-block-copy-button');
