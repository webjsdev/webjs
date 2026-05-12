'use server';

/**
 * Registry composer — reads the source files from `packages/ui/packages/registry/`
 * and produces shadcn-compatible registry JSON on demand. Replaces the old
 * `node scripts/build.js → r/*.json` step: no committed build output, no
 * `prestart` hook, source-of-truth is the .ts files + registry.json manifest.
 *
 * Cached in memory after first read so subsequent requests don't repeat the
 * file I/O. The website dev server restarts on source changes, so cache
 * invalidation isn't needed in dev. Prod is read-only.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REGISTRY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'registry',
);
const MANIFEST_PATH = join(REGISTRY_ROOT, 'registry.json');
const SCHEMA = 'https://ui.webjs.dev/schema/registry-item.json';

export type RegistryFile = {
  path: string;
  type: string;
  target?: string;
  content?: string;
};

export type RegistryItem = {
  $schema?: string;
  name: string;
  type: string;
  description?: string;
  title?: string;
  dependencies?: string[];
  devDependencies?: string[];
  registryDependencies?: string[];
  files?: RegistryFile[];
};

type Manifest = {
  name?: string;
  homepage?: string;
  items: RegistryItem[];
};

let manifestCache: Manifest | null = null;
const itemCache = new Map<string, RegistryItem>();
let indexCache: RegistryItem[] | null = null;

function readManifest(): Manifest {
  if (manifestCache) return manifestCache;
  manifestCache = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
  return manifestCache;
}

function inlineFiles(item: RegistryItem): RegistryItem {
  return {
    $schema: SCHEMA,
    ...item,
    files: (item.files || []).map((f) => {
      const abs = resolve(REGISTRY_ROOT, f.path);
      if (!existsSync(abs)) return { ...f, content: '' };
      return { ...f, content: readFileSync(abs, 'utf8') };
    }),
  };
}

/** Load a single registry item by name. Returns null if not in the manifest. */
export async function loadRegistryItem(name: string): Promise<RegistryItem | null> {
  if (itemCache.has(name)) return itemCache.get(name)!;
  const item = readManifest().items.find((it) => it.name === name);
  if (!item) return null;
  const composed = inlineFiles(item);
  itemCache.set(name, composed);
  return composed;
}

/** Load the flat registry index (one entry per item, metadata-only — no inlined content). */
export async function loadRegistryIndex(): Promise<RegistryItem[]> {
  if (indexCache) return indexCache;
  indexCache = readManifest().items.map((item) => ({
    name: item.name,
    type: item.type,
    description: item.description,
    dependencies: item.dependencies,
    registryDependencies: item.registryDependencies,
  }));
  return indexCache;
}

/** Load the full registry manifest with every item's content inlined. Returns a JSON string. */
export async function loadRegistryManifest(): Promise<string> {
  const manifest = readManifest();
  const items = manifest.items.map(inlineFiles);
  return JSON.stringify({ ...manifest, items }, null, 2);
}
