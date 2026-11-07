'use server';

import { posix } from 'node:path';
import { loadRegistryIndex, loadRegistryItem, type RegistryFile } from './registry.server.ts';

/**
 * The blocks the /ui/blocks pages and the block viewer show (#1666, D18):
 * which blocks exist in which category, and one block's files as a reader
 * copies them into an app.
 *
 * Both read the registry through registry.server.ts, the same composer
 * /ui/registry/** serves, so a block on these pages is exactly the block
 * `npx @webjsdev/ui add <name>` installs.
 */

export interface BlockSummary {
  name: string;
  title: string;
  description: string;
  categories: string[];
}

export interface BlockFile {
  /** Where `add` writes the file, relative to the app root. */
  target: string;
  /** The source with its imports rewritten to where `add` puts each file. */
  source: string;
}

export interface BlockDisplay extends BlockSummary {
  files: BlockFile[];
}

/** Every block, by name, optionally only those in `category`. */
export async function listBlocks(category?: string): Promise<BlockSummary[]> {
  const index = await loadRegistryIndex();
  return index
    .filter((it) => it.type === 'registry:block' && !(it.categories || []).includes('chart'))
    .filter((it) => !category || (it.categories || []).includes(category))
    .map((it) => ({
      name: it.name,
      title: it.title ?? it.name,
      description: it.description ?? '',
      categories: it.categories ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
}

/**
 * Where `add` puts a registry file, for a default components.json (the
 * scaffold's): kit components in components/ui/, the helpers in lib/utils/,
 * the block's own files at their targets.
 */
function installedPath(regPath: string, own: Map<string, RegistryFile>): string | null {
  const ownFile = own.get(regPath);
  if (ownFile?.target) return ownFile.target;
  if (regPath === 'lib/utils.ts') return 'lib/utils/cn.ts';
  if (regPath === 'lib/dom.ts') return 'lib/utils/dom.ts';
  if (/^components\/[^/]+\.ts$/.test(regPath)) return `components/ui/${posix.basename(regPath)}`;
  return null;
}

/** A block file's registry-relative imports, rewritten the way `add` writes them. */
function asInstalled(source: string, file: RegistryFile, own: Map<string, RegistryFile>): string {
  const from = posix.dirname(file.target ?? file.path);
  return source.replace(/((?:from|import)\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+)\2/g, (whole, lead, q, spec) => {
    const dest = installedPath(posix.normalize(posix.join(posix.dirname(file.path), spec)), own);
    if (!dest) return whole;
    let rel = posix.relative(from, dest);
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return `${lead}${q}${rel}${q}`;
  });
}

/** One block's summary and its source files, or null for a name that is not a block. */
export async function blockDisplay(name: string): Promise<BlockDisplay | null> {
  if (typeof name !== 'string') return null;
  const item = await loadRegistryItem(name);
  if (!item || item.type !== 'registry:block') return null;
  const files = item.files || [];
  const own = new Map(files.map((f) => [posix.normalize(f.path), f]));
  return {
    name: item.name,
    title: item.title ?? item.name,
    description: item.description ?? '',
    categories: item.categories ?? [],
    files: files
      .filter((f) => f.target && f.path.endsWith('.ts'))
      .map((f) => ({ target: f.target!, source: asInstalled(f.content ?? '', f, own).trimEnd() })),
  };
}
