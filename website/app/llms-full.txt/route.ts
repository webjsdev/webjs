/**
 * GET /llms-full.txt
 *
 * The full prose corpus (llmstxt.org standard): every doc page
 * concatenated as readable markdown, plus optional skill
 * enrichment when running inside the monorepo, then every /ui page's
 * markdown (#1666), the same corpus /ui/llms-full.txt serves. Generated from
 * the pages (no build step, never drifts), built once per source version and
 * served with an ETag (lib/ui/llm.server.ts).
 */
import { renderLlmsFull, originFor } from '#lib/docs-llms.server.ts';
import { siteCorpus, cachedTextResponse } from '#lib/ui/llm.server.ts';

export async function GET(req: Request) {
  const corpus = await siteCorpus(originFor(req), () => renderLlmsFull(req));
  return cachedTextResponse(req, corpus, 'text/plain; charset=utf-8');
}
