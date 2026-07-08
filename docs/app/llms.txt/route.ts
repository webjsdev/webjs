/**
 * GET /llms.txt
 *
 * The llms.txt INDEX (llmstxt.org standard): a structured list of every
 * doc page with title, one-line description, and absolute link. Served
 * as text/plain and generated live from the doc pages, so it never
 * drifts (no build step).
 *
 * The folder is literally named `llms.txt`, so the file router maps it
 * to the `/llms.txt` URL. This routes cleanly because a WebJs route.ts
 * handler is matched BEFORE the static-asset / source-file gate.
 */
import { renderLlmsIndex, textResponse } from '#lib/llms.server.ts';

export async function GET(req: Request) {
  return textResponse(await renderLlmsIndex(req));
}
