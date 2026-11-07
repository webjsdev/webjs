/**
 * GET /ui/llms-full.txt
 *
 * Every /ui page's markdown in one file (#1666), the same pages /ui/llms.txt
 * lists, each rendered the way /ui/llm/<path> serves it. /llms-full.txt
 * carries this whole corpus after the framework docs. Built once per source
 * version and served with an ETag (lib/ui/llm.server.ts).
 */
import { uiCorpus, cachedTextResponse } from '#lib/ui/llm.server.ts';
import { originFor } from '#lib/docs-llms.server.ts';

export async function GET(req: Request): Promise<Response> {
  return cachedTextResponse(req, await uiCorpus(originFor(req)));
}
