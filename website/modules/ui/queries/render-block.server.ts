'use server';

import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderToString } from '@webjsdev/core/server';

/**
 * Render one registry block's page for /ui/view/<name>, the frame the block
 * viewer shows (#1666, D18).
 *
 * The page module is the site's mirror of the block (modules/ui/blocks/,
 * written by scripts/copy-registry.mjs with its kit imports pointed at the
 * site's one kit instance), so this renders exactly the source `add`
 * installs. The same three details as render-demo.server.ts hold here:
 * custom elements are left unexpanded (`ssr: false`) so the page's own
 * render expands each once, the name is checked against the mirror before
 * anything is imported (an RPC-callable function must not be a path
 * traversal), and the site keeps `"seed": false`.
 */

const BLOCKS = join(dirname(fileURLToPath(import.meta.url)), '..', 'blocks');
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

let known: Promise<Set<string>> | null = null;
async function blockNames(): Promise<Set<string>> {
  known ??= readdir(BLOCKS, { withFileTypes: true })
    // A block is a directory holding a page.ts (charts/ holds chart modules, no page).
    .then((entries) => new Set(entries.filter((e) => e.isDirectory() && existsSync(join(BLOCKS, e.name, 'page.ts'))).map((e) => e.name)))
    .catch(() => new Set<string>());
  return known;
}

export interface RenderedBlock {
  html: string;
  title: string;
}

export async function renderBlock(name: string): Promise<RenderedBlock | null> {
  if (typeof name !== 'string' || !NAME.test(name) || !(await blockNames()).has(name)) return null;
  const mod = await import(`../blocks/${name}/page.ts`);
  const html = await renderToString(await mod.default(), { ssr: false });
  const title = typeof mod.metadata?.title === 'string' ? mod.metadata.title : name;
  return { html, title };
}
