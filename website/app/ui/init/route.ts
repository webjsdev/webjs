import { buildPresetItem } from '../../../../packages/ui/packages/registry/themes/preset.js';
import { parsePresetRequest } from '#modules/ui/init/preset-request.ts';
import { REGISTRY_HEADERS } from '#modules/ui/utils/registry-headers.ts';

/**
 * GET /ui/init: the registry payload for one design-system choice, shadcn's
 * /init (#1666). Takes `?preset=<code>` (the configurator's share code), or
 * the fields one by one (`style`, `baseColor`, `theme`, `chartColor`,
 * `iconLibrary`, `font`, `fontHeading`, `radius`, `menuAccent`,
 * `menuColor`), a field given beside a code overriding the code's.
 *
 * The answer is one `registry:base` item: the tokens as `cssVars`, the items
 * it pulls in `registryDependencies`, and the config under `meta`. It is what
 * `npx @webjsdev/ui init --preset <code>` applies, built by the same function
 * (packages/ui/packages/registry/themes/preset.js).
 */
export async function GET(req: Request) {
  const parsed = parsePresetRequest(new URL(req.url).searchParams);
  if ('error' in parsed) {
    return Response.json({ error: parsed.error }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  return new Response(JSON.stringify(buildPresetItem(parsed.config), null, 2), { headers: REGISTRY_HEADERS });
}
