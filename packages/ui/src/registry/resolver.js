import { getRegistryItem } from './fetcher.js';

/**
 * Walk `registryDependencies` transitively. Returns a flat array of items in
 * install order (deepest dependency first). Cycles are guarded against.
 *
 * @param {string[]} names
 * @param {string} baseUrl
 */
export async function resolveTree(names, baseUrl) {
  /** @type {Map<string, any>} */
  const seen = new Map();
  /** @type {any[]} */
  const ordered = [];

  async function visit(name) {
    if (seen.has(name)) return;
    seen.set(name, true);
    const item = await getRegistryItem(name, baseUrl);
    for (const dep of item.registryDependencies || []) await visit(dep);
    ordered.push(item);
  }

  for (const name of names) await visit(name);
  return ordered;
}

/**
 * Collect all npm `dependencies` + `devDependencies` from a resolved tree,
 * deduplicated. Returns { dependencies, devDependencies }.
 */
export function collectNpmDeps(items) {
  const deps = new Set();
  const devDeps = new Set();
  for (const item of items) {
    for (const d of item.dependencies || []) deps.add(d);
    for (const d of item.devDependencies || []) devDeps.add(d);
  }
  return { dependencies: [...deps], devDependencies: [...devDeps] };
}
