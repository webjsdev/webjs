import { html } from '@webjsdev/core';
import type { TocEntry } from '#lib/ui/docs/page.ts';

/**
 * The Toast docs page, ported from shadcn's
 * content/docs/components/radix/toast.mdx (#1666, D15): a deprecation notice
 * pointing at Sonner, with no demo and no sections.
 */
export default function body(_toc: TocEntry[]) {
  return html`
    <p>The toast component has been deprecated. Use the <a href="/ui/docs/components/sonner">sonner</a> component instead.</p>
  `;
}
