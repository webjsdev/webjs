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
 * The markdown is cached until the source changes, and the response carries
 * an ETag, so a repeat fetch is a 304. An unknown path is a 404, the same
 * status the page itself would answer.
 */
import { renderUiMarkdown, markdownResponse, cachedTextResponse } from '#lib/ui/llm.server.ts';
import { originFor } from '#lib/docs-llms.server.ts';
import { uiPathFromSlug } from '#lib/ui/llm-path.ts';

// An optional catch-all arrives as string[] (absent at /ui/llm itself), as in Next.
export async function GET(req: Request, { params }: { params: { slug?: string[] } }) {
  const slug = params.slug ?? [];
  const path = uiPathFromSlug(slug);
  const md = await renderUiMarkdown(path, originFor(req));
  if (md == null) return markdownResponse(`# Not found\n\nNo /ui page at ${path}.\n`, 404);
  return cachedTextResponse(req, md);
}
