import { html, notFound } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { componentDoc } from '#modules/ui/docs/nav.ts';
import { COMPONENT_DOCS } from '#modules/ui/docs/components/index.ts';
import { componentSource } from '#modules/ui/queries/component-source.server.ts';
import { docsPage, heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { installTabs } from '#lib/ui/docs/install.ts';
import { LEAD_PREVIEWS } from '#modules/ui/docs/lead-previews.ts';

/**
 * /ui/docs/components/<name>, shadcn's component page (#1666): the lead demo,
 * Installation (the add command, and the source to copy by hand), then the
 * component's own sections from its docs module.
 */

export async function generateMetadata({ params }: PageProps<'/ui/docs/components/[name]'>) {
  const doc = componentDoc(params.name);
  return doc ? { title: `${doc.title} | WebJs UI`, description: doc.description } : {};
}

export default async function ComponentPage({ params }: PageProps<'/ui/docs/components/[name]'>) {
  const doc = componentDoc(params.name);
  if (!doc) notFound();
  const href = `/ui/docs/components/${doc.slug}`;
  const load = COMPONENT_DOCS[doc.slug];
  const mod = load ? await load() : null;
  const files = await componentSource(doc.slug);
  const toc: TocEntry[] = [];
  const lead = mod?.demo ? await componentPreview(mod.demo, { ...LEAD_PREVIEWS[doc.slug], ...mod.demoOptions }) : '';
  const install = files?.length
    ? html`${heading(toc, 2, 'Installation')}${installTabs(doc.slug, { source: files[0].content, title: `components/ui/${doc.slug}.ts` })}`
    : '';
  const rest = mod ? await mod.default(toc) : '';
  return docsPage({ href, title: doc.title, description: doc.description, toc, body: html`${lead}${install}${rest}` });
}
