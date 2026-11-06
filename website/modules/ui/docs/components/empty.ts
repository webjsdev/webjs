import { html } from '@webjsdev/core';
import type { TocEntry } from '#lib/ui/docs/page.ts';

/**
 * The Empty docs page, ported from shadcn's
 * content/docs/components/radix/empty.mdx (#1666): for now its lead demo,
 * empty-demo; the page's other sections follow.
 */
export const demo = 'empty-demo';

export default function body(_toc: TocEntry[]) {
  return html``;
}
