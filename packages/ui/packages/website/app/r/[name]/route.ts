import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REGISTRY_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'registry', 'r');

/**
 * GET /r/<name>.json — returns the registry item for `<name>`.
 *
 * The CLI fetches from this endpoint to copy a component into a user's project.
 */
export async function GET(req: Request, { params }: { params: { name: string } }) {
  // Strip .json suffix if the client included it (some clients do, some don't).
  const slug = params.name.replace(/\.json$/, '');
  const p = join(REGISTRY_DIR, `${slug}.json`);
  if (!existsSync(p)) {
    return Response.json({ error: `Registry item "${slug}" not found` }, { status: 404 });
  }
  return new Response(readFileSync(p, 'utf8'), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
