import { loadRegistryManifest } from '../_lib/registry.server.ts';

/** GET /r — full registry manifest with content inlined per item. */
export async function GET() {
  const body = await loadRegistryManifest();
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
