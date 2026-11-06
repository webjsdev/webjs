import { html } from '@webjsdev/core';
import { unsafeHTML } from '@webjsdev/core/directives';
import { cn } from '#lib/utils/cn.ts';
import { renderDemo } from '#modules/ui/queries/render-demo.server.ts';
import { codeFigure } from './code.ts';

/**
 * shadcn's ComponentPreview (apps/v4/components/component-preview-tabs.tsx)
 * for one demo (#1666, D14): the rendered demo over its source, the source
 * clipped to a few faded lines behind a "View Code" button.
 *
 * The button is the `summary` of an otherwise empty `details`, and the clip
 * is lifted by `:has(details[open])`. That is the whole interaction, with no
 * script, so it works the same with JavaScript off.
 *
 * Previews render in the nova style, the one shadcn's docs render in (D8).
 * The demo string comes from renderDemo, which renders custom elements
 * unexpanded so this page's own render expands each exactly once.
 */
export async function componentPreview(name: string, opts: { align?: 'center' | 'start' | 'end'; previewClass?: string; hideCode?: boolean } = {}) {
  const demo = await renderDemo(name);
  if (!demo) {
    return html`<p class="mt-6 text-sm text-muted-foreground">Component <code>${name}</code> not found in registry.</p>`;
  }
  const align = opts.align ?? 'center';
  return html`
    <div data-slot="component-preview" data-not-typeset class="group relative mt-4 mb-12 flex flex-col overflow-hidden rounded-2xl border">
      <div data-slot="preview" dir="ltr">
        <div data-align=${align} class=${cn('preview style-nova relative flex h-72 w-full justify-center p-10 data-[align=center]:items-center data-[align=end]:items-start data-[align=start]:items-start sm:data-[align=end]:items-end', opts.previewClass)}>
          ${unsafeHTML(demo.html)}
        </div>
      </div>
      ${opts.hideCode ? '' : html`
        <div data-slot="code" class="relative overflow-hidden [&_[data-rehype-pretty-code-figure]]:m-0! [&_[data-rehype-pretty-code-figure]]:rounded-t-none [&_[data-rehype-pretty-code-figure]]:border-t [&_pre]:max-h-72 not-has-[details[open]]:[&_pre]:max-h-[6.75rem] not-has-[details[open]]:[&_pre]:overflow-hidden">
          ${codeFigure(demo.source, { lineNumbers: true })}
          <details class="absolute inset-0 flex items-center justify-center pb-4 open:hidden">
            <summary class="absolute inset-0 flex cursor-pointer list-none items-center justify-center [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" class="absolute inset-0" style="background: linear-gradient(to top, var(--color-code), color-mix(in oklab, var(--color-code) 60%, transparent), transparent)"></span>
              <span data-slot="button" class="relative z-10 inline-flex h-8 items-center rounded-lg border bg-background px-3 text-sm font-medium text-foreground shadow-none hover:bg-muted">View Code</span>
            </summary>
          </details>
        </div>`}
    </div>`;
}
