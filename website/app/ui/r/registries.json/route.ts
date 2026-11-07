import { REGISTRIES } from '#modules/ui/directory/registries.ts';
import { REGISTRY_HEADERS } from '#modules/ui/utils/registry-headers.ts';

/**
 * GET /ui/r/registries.json: the registry directory, shadcn's
 * /r/registries.json in the WebJs format (modules/ui/directory/registries.ts).
 */
export async function GET() {
  const body = REGISTRIES.map(({ default: _d, ...r }) => r);
  return new Response(JSON.stringify(body, null, 2), { headers: REGISTRY_HEADERS });
}
