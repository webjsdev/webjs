import { loadRegistryIndex } from '#/app/_lib/registry.server.ts';

/** GET /registry/index.json: flat list of registry items (metadata only, used by `webjsui list`). */
export async function GET() {
  const items = await loadRegistryIndex();
  return new Response(JSON.stringify(items, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
