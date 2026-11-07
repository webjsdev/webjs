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
  default: (toc: TocEntry[], ctx?: DocPageContext) => Promise<TemplateResult> | TemplateResult;
}

/**
 * What the route hands a page body beyond its table of contents. `actionData`
 * is the page's `ctx.actionData`: the result a bound form's action returned,
 * on the 422 re-render after a failed submission (the Forms page's live demo).
 */
export interface DocPageContext {
  actionData?: unknown;
}

export const DOC_PAGES: Record<string, () => Promise<DocPageModule>> = {
  'installation': () => import('./installation.ts'),
  'components-json': () => import('./components-json.ts'),
  'package-imports': () => import('./package-imports.ts'),
  'theming': () => import('./theming.ts'),
  'typeset': () => import('./typeset.ts'),
  'dark-mode': () => import('./dark-mode.ts'),
  'rtl': () => import('./rtl.ts'),
  'cli': () => import('./cli.ts'),
  'monorepo': () => import('./monorepo.ts'),
  'skills': () => import('./skills.ts'),
  'javascript': () => import('./javascript.ts'),
  'blocks': () => import('./blocks.ts'),
  'figma': () => import('./figma.ts'),
  'changelog': () => import('./changelog.ts'),
  'registry': () => import('./registry.ts'),
  'registry/getting-started': () => import('./registry/getting-started.ts'),
  'registry/github': () => import('./registry/github.ts'),
  'registry/registry-index': () => import('./registry/registry-index.ts'),
  'registry/health': () => import('./registry/health.ts'),
  'registry/examples': () => import('./registry/examples.ts'),
  'registry/namespace': () => import('./registry/namespace.ts'),
  'registry/authentication': () => import('./registry/authentication.ts'),
  'registry/dynamic-search': () => import('./registry/dynamic-search.ts'),
  'registry/mcp': () => import('./registry/mcp.ts'),
  'registry/faq': () => import('./registry/faq.ts'),
  'registry/api-reference': () => import('./registry/api-reference.ts'),
  'registry/registry-json': () => import('./registry/registry-json.ts'),
  'registry/registry-item-json': () => import('./registry/registry-item-json.ts'),
  'forms': () => import('./forms.ts'),
  'utils/scroll-fade': () => import('./utils/scroll-fade.ts'),
  'utils/shimmer': () => import('./utils/shimmer.ts'),
};
