import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REGISTRY_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'registry', 'r');

/** GET /r — full manifest of registry items. */
export async function GET() {
  const p = join(REGISTRY_DIR, 'registry.json');
  if (!existsSync(p)) {
    return Response.json({ error: 'Registry not built. Run `npm run ui:build`.' }, { status: 503 });
  }
  const body = readFileSync(p, 'utf8');
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
