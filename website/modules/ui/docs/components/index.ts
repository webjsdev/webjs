import type { TemplateResult } from '@webjsdev/core';
import type { TocEntry } from '#lib/ui/docs/page.ts';

/**
 * The component docs modules, one per component page that has its content
 * ported (#1666, D15). A component with no module here still has a page,
 * built from its nav record (title, description, installation), until its
 * content lands.
 *
 * Each module exports `demo`, the demo shown above Installation, and a
 * default `body(toc)` for everything after it. String-literal imports, so
 * each module loads only when its page is requested.
 */
export interface ComponentDocModule {
  demo?: string;
  default: (toc: TocEntry[]) => Promise<TemplateResult> | TemplateResult;
}

export const COMPONENT_DOCS: Record<string, () => Promise<ComponentDocModule>> = {
  button: () => import('./button.ts'),
};
