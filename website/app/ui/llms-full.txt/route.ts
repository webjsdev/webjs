/**
 * GET /ui/llms-full.txt
 *
 * Every /ui page's markdown in one file (#1666), the same pages /ui/llms.txt
 * lists, each rendered the way /ui/llm/<path> serves it. /llms-full.txt
 * carries this whole corpus after the framework docs.
 */
import { renderUiCorpus, markdownResponse } from '#lib/ui/llm.server.ts';
import { originFor } from '#lib/docs-llms.server.ts';

export async function GET(req: Request): Promise<Response> {
  const origin = originFor(req);
  const corpus = await renderUiCorpus(origin);
  return markdownResponse(`# WebJs UI (full corpus)\n\nEvery page of ${origin}/ui as markdown, concatenated.\n\n---\n\n${corpus}`);
}
