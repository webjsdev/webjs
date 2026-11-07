import { loadRegistryIndex } from '#modules/ui/queries/registry.server.ts';
import { parsePresetRequest } from '#modules/ui/init/preset-request.ts';
import { presetInstructions } from '#modules/ui/init/instructions.ts';

/**
 * GET /ui/init/md: the markdown instructions for one design-system choice,
 * shadcn's /init/md (#1666). Same query as /ui/init. It leads with the one
 * command that does everything, then spells out what that command writes,
 * for a reader (or an agent) setting an app up by hand.
 */
export async function GET(req: Request) {
  const parsed = parsePresetRequest(new URL(req.url).searchParams);
  if ('error' in parsed) {
    return new Response(parsed.error, { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const components = (await loadRegistryIndex()).filter((it) => it.type === 'registry:ui').map((it) => it.name);
  return new Response(presetInstructions(parsed.config, components), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
