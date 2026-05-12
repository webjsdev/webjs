import {
  loadRegistryItem,
  loadRegistryIndex,
  loadRegistryManifest,
} from '../../_lib/registry.server.ts';

const HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=60',
  'Access-Control-Allow-Origin': '*',
};

/**
 * GET /r/<name>.json — returns the registry item for `<name>`.
 *
 * Two reserved slugs:
 *   - `index`    → flat list (same as `GET /r/index.json` via the sibling route)
 *   - `registry` → full manifest with every item's content inlined
 *
 * Everything else looks up the item in `registry.json` and composes its
 * shadcn-compatible JSON on demand. See _lib/registry.server.ts.
 */
export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const slug = params.name.replace(/\.json$/, '');

  if (slug === 'index') {
    return new Response(JSON.stringify(await loadRegistryIndex(), null, 2), { headers: HEADERS });
  }
  if (slug === 'registry') {
    return new Response(await loadRegistryManifest(), { headers: HEADERS });
  }

  const item = await loadRegistryItem(slug);
  if (!item) {
    return Response.json({ error: `Registry item "${slug}" not found` }, { status: 404 });
  }
  return new Response(JSON.stringify(item, null, 2), { headers: HEADERS });
}
