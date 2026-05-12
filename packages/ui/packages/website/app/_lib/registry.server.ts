'use server';

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// app/_lib/registry.server.ts is 2 levels deep in website/. Reach
// packages/ui/packages/registry/r/ from here.
const REGISTRY_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'registry',
  'r',
);

export type RegistryItem = {
  name: string;
  type: string;
  description?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: Array<{ path: string; content?: string; type: string }>;
};

/** Read a single registry item by name. Returns null if not found. */
export async function loadRegistryItem(name: string): Promise<RegistryItem | null> {
  const p = join(REGISTRY_DIR, `${name}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as RegistryItem;
}

/** Read the flat registry index (one entry per registry item). */
export async function loadRegistryIndex(): Promise<RegistryItem[]> {
  const p = join(REGISTRY_DIR, 'index.json');
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, 'utf8')) as RegistryItem[];
}

/** Read the full registry manifest (entire registry.json). */
export async function loadRegistryManifest(): Promise<string> {
  const p = join(REGISTRY_DIR, 'registry.json');
  if (!existsSync(p)) return '';
  return readFileSync(p, 'utf8');
}
