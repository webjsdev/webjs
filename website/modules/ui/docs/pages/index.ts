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
  'ai-elements': () => import('./ai-elements/index.ts'),
  'ai-elements/chain-of-thought': () => import('./ai-elements/chain-of-thought.ts'),
  'ai-elements/chat': () => import('./ai-elements/chat.ts'),
  'ai-elements/checkpoint': () => import('./ai-elements/checkpoint.ts'),
  'ai-elements/confirmation': () => import('./ai-elements/confirmation.ts'),
  'ai-elements/context': () => import('./ai-elements/context.ts'),
  'ai-elements/file-tree': () => import('./ai-elements/file-tree.ts'),
  'ai-elements/inline-citation': () => import('./ai-elements/inline-citation.ts'),
  'ai-elements/message': () => import('./ai-elements/message.ts'),
  'ai-elements/model-selector': () => import('./ai-elements/model-selector.ts'),
  'ai-elements/plan': () => import('./ai-elements/plan.ts'),
  'ai-elements/prompt-input': () => import('./ai-elements/prompt-input.ts'),
  'ai-elements/queue': () => import('./ai-elements/queue.ts'),
  'ai-elements/reasoning': () => import('./ai-elements/reasoning.ts'),
  'ai-elements/sources': () => import('./ai-elements/sources.ts'),
  'ai-elements/stack-trace': () => import('./ai-elements/stack-trace.ts'),
  'ai-elements/subagent': () => import('./ai-elements/subagent.ts'),
  'ai-elements/suggestion': () => import('./ai-elements/suggestion.ts'),
  'ai-elements/task': () => import('./ai-elements/task.ts'),
  'ai-elements/terminal': () => import('./ai-elements/terminal.ts'),
  'ai-elements/test-results': () => import('./ai-elements/test-results.ts'),
  'ai-elements/tool': () => import('./ai-elements/tool.ts'),
  'helpers/ai-sdk': () => import('./helpers/ai-sdk.ts'),
  'primitives/message-scroller': () => import('./primitives/message-scroller.ts'),
  'primitives/questionnaire': () => import('./primitives/questionnaire.ts'),
};
