'use server';

// The kit's projector, by relative path the way registry.server.ts reads the
// registry, since the website does not declare @webjsdev/ui as a dependency.
import { uiComponentFiles } from '../../../../packages/ui/src/registry/extract.js';

/**
 * A component's source as `webjs ui add` writes it, baked in the kit's
 * default style, for the /ui docs' Manual installation tab (#1666).
 *
 * Callable over RPC like any 'use server' export, so the name is checked
 * before the registry is read.
 */
export async function componentSource(name: string): Promise<{ path: string; content: string }[] | null> {
  if (typeof name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return null;
  return uiComponentFiles(name);
}
