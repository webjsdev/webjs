import { registryItemSchema, registryIndexSchema } from './schema.js';

/**
 * Default registry URL. Override via REGISTRY_URL env var, or per-call.
 */
export const DEFAULT_REGISTRY_URL = process.env.REGISTRY_URL || 'https://ui.webjs.com/r';

const cache = new Map();

/**
 * Fetch a registry item by name.
 *
 * @param {string} name
 * @param {string} [baseUrl]
 */
export async function fetchRegistryItem(name, baseUrl = DEFAULT_REGISTRY_URL) {
  const url = `${baseUrl.replace(/\/$/, '')}/${name}.json`;
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch registry item "${name}" from ${url} — HTTP ${res.status}`);
  }
  const json = await res.json();
  const item = registryItemSchema.parse(json);
  cache.set(url, item);
  return item;
}

/**
 * Fetch the flat registry index (list of all items).
 *
 * @param {string} [baseUrl]
 */
export async function fetchRegistryIndex(baseUrl = DEFAULT_REGISTRY_URL) {
  const url = `${baseUrl.replace(/\/$/, '')}/index.json`;
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch registry index from ${url} — HTTP ${res.status}`);
  }
  const json = await res.json();
  const items = registryIndexSchema.parse(json);
  cache.set(url, items);
  return items;
}
