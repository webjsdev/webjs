import type { TemplateResult } from '@webjsdev/core';
import type { TocEntry } from '#lib/ui/docs/page.ts';

/**
 * The /ui docs pages that are not component pages (#1666): Get Started,
 * Registry, Forms, Utilities and the rest of shadcn's content/docs tree,
 * one module per page under modules/ui/docs/pages/, keyed by the path after
 * /ui/docs/ ('installation', 'registry/getting-started').
 *
 * app/ui/(chrome)/docs/[...slug]/page.ts serves every key here, and
 * modules/ui/docs/nav.ts treats a key as an existing page, so the search
 * menu offers it. A page joins by adding its module and its line below.
 *
 * Each module exports `title`, `description` and a default `body(toc)`.
 * String-literal imports, so each loads only when its page is requested.
 */
export interface DocPageModule {
  title: string;
  description?: string;
  default: (toc: TocEntry[]) => Promise<TemplateResult> | TemplateResult;
}

export const DOC_PAGES: Record<string, () => Promise<DocPageModule>> = {
};
