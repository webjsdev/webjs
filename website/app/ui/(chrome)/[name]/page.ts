import { notFound, redirect } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { componentDoc } from '#modules/ui/docs/nav.ts';

/**
 * /ui/<name>, the interim component gallery's old address (#1666). The gallery
 * is retired: every component page is /ui/docs/components/<name>, shadcn's
 * docs page, so each old url permanently redirects (308) there and keeps its
 * link equity. A name with no component page is a 404 inside the /ui chrome.
 *
 * A thin page rather than a `webjs.redirects` rule: the set of names is the
 * component records in modules/ui/docs/nav.ts, so a component added there is
 * redirected the moment it exists, with no second list to keep in step, and a
 * single-segment pattern rule would also catch /ui/docs, /ui/blocks and every
 * other section page. Static siblings outrank this dynamic segment, so those
 * still render.
 */
export default function LegacyComponentPage({ params }: PageProps<'/ui/[name]'>) {
  const doc = componentDoc(params.name);
  if (!doc) notFound();
  redirect(`/ui/docs/components/${doc.slug}`, 308);
}
