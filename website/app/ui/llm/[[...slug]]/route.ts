/**
 * GET /ui/llm/<path>
 *
 * Every /ui page as markdown (#1666), shadcn's /llm/<slug> route: the page at
 * /ui/<path> rendered and converted, with each demo's source inlined as a
 * fenced block, the install command, and the API reference. /ui/llm alone is
 * the /ui home page. /llms.txt and /ui/llms.txt link every page here, and
 * each page's head points at it with a `<link rel="alternate"
 * type="text/markdown">`.
 *
 * An unknown path is a 404, the same status the page itself would answer.
 */
import { renderUiMarkdown, markdownResponse } from '#lib/ui/llm.server.ts';
import { originFor } from '#lib/docs-llms.server.ts';
import { uiPathFromSlug } from '#lib/ui/llm-path.ts';

export async function GET(req: Request, { params }: { params: { slug?: string | string[] } }) {
  const slug = Array.isArray(params.slug) ? params.slug : typeof params.slug === 'string' ? params.slug.split('/') : [];
  const path = uiPathFromSlug(slug);
  const md = await renderUiMarkdown(path, originFor(req));
  if (md == null) return markdownResponse(`# Not found\n\nNo /ui page at ${path}.\n`, 404);
  return markdownResponse(md);
}
