/**
 * Where a /ui page's markdown lives (#1666): `/ui/<path>` is served as
 * markdown at `/ui/llm/<path>`, and `/ui` itself at `/ui/llm`. The scheme is
 * shadcn's `/llm/<slug>` route, kept under /ui so it covers every /ui page
 * (the docs, the blocks, the typeset builder) and not only the docs.
 *
 * Browser-safe and import-free, because the /ui chrome layout reads it for
 * each page's `<link rel="alternate" type="text/markdown">`.
 */

export const UI_LLM_PREFIX = '/ui/llm';

/** Paths under /ui that are not pages a reader opens, so they have no markdown. */
const NOT_PAGES = /^\/ui\/(?:llm|view|preview|registry|r|init)(?:\/|$)|^\/ui\/[^/]+\.(?:txt|json|css)$/;

/** The markdown URL for a /ui page path, or null when the path is not a /ui page. */
export function uiMarkdownHref(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path !== '/ui' && !path.startsWith('/ui/')) return null;
  if (NOT_PAGES.test(path)) return null;
  return UI_LLM_PREFIX + path.slice('/ui'.length);
}

/** The /ui page path a markdown URL's slug segments name. */
export function uiPathFromSlug(slug: readonly string[]): string {
  const rest = slug.filter(Boolean).join('/');
  return rest ? `/ui/${rest}` : '/ui';
}
