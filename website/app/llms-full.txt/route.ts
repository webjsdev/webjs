/**
 * GET /llms-full.txt
 *
 * The full prose corpus (llmstxt.org standard): every doc page
 * concatenated as readable markdown, plus optional skill
 * enrichment when running inside the monorepo, then every /ui page's
 * markdown (#1666), the same corpus /ui/llms-full.txt serves. Served as
 * text/plain and generated live from the pages (no build step, never drifts).
 */
import { renderLlmsFull, textResponse, originFor } from '#lib/docs-llms.server.ts';
import { renderUiCorpus } from '#lib/ui/llm.server.ts';

export async function GET(req: Request) {
  const [docs, ui] = await Promise.all([renderLlmsFull(req), renderUiCorpus(originFor(req))]);
  return textResponse(`${docs}\n---\n\n# WebJs UI (every /ui page)\n\n${ui}`);
}
