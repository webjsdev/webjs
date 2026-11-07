'use server';

import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadRegistryIndex } from './registry.server.ts';

/**
 * What the /ui/create item explorer lists (#1666), shadcn's getAllItems
 * (apps/v4/app/(app)/(create)/lib/api.ts): the registry's blocks and the
 * components' demos, each a thing the preview frame can show.
 *
 * shadcn drops every name ending in a number (the numbered variants of a
 * block family), and so does this. A component is listed when its
 * `<name>-demo` exists under modules/ui/examples/, which is what
 * /ui/preview/<name>-demo renders.
 */

export interface ExplorerItem {
  name: string;
  title: string;
}

export interface ExplorerGroup {
  title: string;
  items: ExplorerItem[];
}

const EXAMPLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples');

let cached: Promise<ExplorerGroup[]> | null = null;

export async function explorerItems(): Promise<ExplorerGroup[]> {
  cached ??= (async () => {
    const [index, files] = await Promise.all([loadRegistryIndex(), readdir(EXAMPLES).catch(() => [] as string[])]);
    const demos = new Set(files.filter((f) => f.endsWith('-demo.ts')).map((f) => f.slice(0, -'.ts'.length)));
    const blocks = index
      .filter((it) => it.type === 'registry:block' && !(it.categories || []).includes('chart') && !/\d+$/.test(it.name))
      .map((it) => ({ name: it.name, title: it.title || it.name }));
    const components = index
      .filter((it) => it.type === 'registry:ui' && demos.has(`${it.name}-demo`))
      .map((it) => ({ name: `${it.name}-demo`, title: it.title || titleCase(it.name) }));
    return [
      { title: 'Blocks', items: blocks },
      { title: 'Components', items: components },
    ].filter((group) => group.items.length > 0);
  })();
  return cached;
}

function titleCase(name: string): string {
  return name.replace(/(^|-)([a-z])/g, (_m, sep: string, c: string) => (sep ? ' ' : '') + c.toUpperCase());
}
