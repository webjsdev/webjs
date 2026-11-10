import { notFound } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { DOC_PAGES } from '#modules/ui/docs/pages/index.ts';
import { docsPage, type TocEntry } from '#lib/ui/docs/page.ts';

/**
 * Every /ui docs page that is not a component page (#1666): Installation,
 * Theming, the CLI, the Registry pages and the rest, one module each under
 * modules/ui/docs/pages/ (see its index). The more specific docs routes
 * (components, directory) take precedence over this one.
 */

// A catch-all segment arrives as the list of path segments (string[], as in
// Next); the joined path is the DOC_PAGES key.
async function pathOf(params: PageProps<'/ui/docs/[...slug]'>['params']): Promise<string> {
  return (await params).slug.join('/');
}

export async function generateMetadata({ params }: PageProps<'/ui/docs/[...slug]'>) {
  const load = DOC_PAGES[await pathOf(params)];
  if (!load) return {};
  const mod = await load();
  return { title: `${mod.title} | WebJs UI`, description: mod.description };
}

export default async function DocPage({ params, actionData }: PageProps<'/ui/docs/[...slug]'>) {
  const path = await pathOf(params);
  const load = DOC_PAGES[path];
  if (!load) notFound();
  const mod = await load();
  const toc: TocEntry[] = [];
  // actionData is set on the 422 re-render after a bound form fails, so the
  // page that owns the form (the Forms guide's live demo) can show its errors.
  const body = await mod.default(toc, { actionData });
  return docsPage({ href: `/ui/docs/${path}`, title: mod.title, description: mod.description, toc, body });
}
