import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REGISTRY_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'registry', 'r');

/** GET /r/index.json — flat list of all registry items (for `webjsui list`). */
export async function GET() {
  const p = join(REGISTRY_DIR, 'index.json');
  if (!existsSync(p)) {
    return Response.json({ error: 'Registry not built.' }, { status: 503 });
  }
  return new Response(readFileSync(p, 'utf8'), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
