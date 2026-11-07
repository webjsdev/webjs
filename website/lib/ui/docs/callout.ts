import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { alertClass, alertTitleClass, alertDescriptionClass } from '#modules/ui/components/alert.ts';

/**
 * shadcn's docs Callout (apps/v4/components/callout.tsx): an Alert on the
 * surface colour, used in the docs for notes. `icon` is an optional icon
 * fragment, `title` an optional heading, `body` the note itself; `className`
 * is shadcn's className (some callouts add `bg-muted font-semibold`).
 *
 * The description is a grid, as shadcn's AlertDescription is, so a bare run
 * of text and inline `<code>` would put every node on its own row. shadcn's
 * MDX always hands it a paragraph, so a body that does not open with a block
 * element is wrapped in a `<p>` here.
 */
export function callout(body: unknown, opts: { title?: string; icon?: unknown; className?: string; variant?: 'default' | 'info' | 'warning' } = {}) {
  const content = leadsWithBlock(body) ? body : html`<p>${body}</p>`;
  return html`<div role="note" data-slot="alert" data-variant=${opts.variant ?? 'default'} class=${cn(alertClass(), 'not-typeset mt-6 w-auto rounded-2xl border-surface bg-surface text-surface-foreground md:-mx-1 **:[a]:font-medium **:[a]:underline **:[a]:decoration-current/30 **:[a]:hover:decoration-current **:[code]:border', opts.className)}>
    ${opts.icon ?? ''}
    ${opts.title ? html`<div data-slot="alert-title" class=${alertTitleClass()}>${opts.title}</div>` : ''}
    <div data-slot="alert-description" class=${cn(alertDescriptionClass(), 'text-card-foreground/80')}>${content}</div>
  </div>`;
}

const BLOCK = /^\s*<(?:p|ul|ol|div|pre|figure|table|blockquote|h[1-6]|code-block)[\s>]/;

/** Whether an `html` body opens with a block element of its own. */
function leadsWithBlock(body: unknown): boolean {
  const first = (body as { strings?: readonly string[] } | null)?.strings?.[0];
  return typeof first === 'string' && BLOCK.test(first);
}
