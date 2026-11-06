import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { alertClass, alertTitleClass, alertDescriptionClass } from '#modules/ui/components/alert.ts';

/**
 * shadcn's docs Callout (apps/v4/components/callout.tsx): an Alert on the
 * surface colour, used in the docs for notes. `icon` is an optional icon
 * fragment, `title` an optional heading, `body` the note itself; `className`
 * is shadcn's className (some callouts add `bg-muted font-semibold`).
 */
export function callout(body: unknown, opts: { title?: string; icon?: unknown; className?: string; variant?: 'default' | 'info' | 'warning' } = {}) {
  return html`<div role="note" data-slot="alert" data-variant=${opts.variant ?? 'default'} class=${cn(alertClass(), 'not-typeset mt-6 w-auto rounded-2xl border-surface bg-surface text-surface-foreground md:-mx-1 **:[a]:font-medium **:[a]:underline **:[a]:decoration-current/30 **:[a]:hover:decoration-current **:[code]:border', opts.className)}>
    ${opts.icon ?? ''}
    ${opts.title ? html`<div data-slot="alert-title" class=${alertTitleClass()}>${opts.title}</div>` : ''}
    <div data-slot="alert-description" class=${cn(alertDescriptionClass(), 'text-card-foreground/80')}>${body}</div>
  </div>`;
}
