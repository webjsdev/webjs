import { registryItemSchema, registryIndexSchema } from './schema.js';
import { loadRegistryItem, loadRegistryIndex } from './local.js';

/**
 * Default registry URL. Override via REGISTRY_URL env var, or per-call.
 */
export const DEFAULT_REGISTRY_URL = process.env.REGISTRY_URL || 'https://ui.webjs.dev/registry';

const cache = new Map();

/**
 * True when `url` is the default hosted registry (or unset), meaning a caller
 * did not point at a CUSTOM registry. Local-first resolution kicks in here;
 * an explicit `--registry <url>` forces the network path.
 *
 * @param {string} [url]
 */
export function isDefaultRegistry(url) {
  return !url || url === DEFAULT_REGISTRY_URL;
}

/**
 * Resolve one registry item LOCAL-FIRST (#983): read the packaged registry
 * sources unless the caller pointed at a custom `--registry` URL, in which case
 * fetch over the network. This is the resolver `add` / `init` / `view` / `list`
 * use, so a scaffolded app installs components with no network dependency.
 *
 * NOTE: `webjsui diff` deliberately does NOT use this (it compares local files
 * against the LIVE upstream, so it calls {@link fetchRegistryItem} directly).
 *
 * @param {string} name
 * @param {string} [registryUrl]
 */
export async function getRegistryItem(name, registryUrl) {
  if (isDefaultRegistry(registryUrl)) {
    const item = loadRegistryItem(name);
    if (!item) {
      throw new Error(
        `Unknown registry item "${name}". Run \`webjsui list\` to see the available components.`,
      );
    }
    return item;
  }
  return fetchRegistryItem(name, registryUrl);
}

/**
 * Resolve the flat registry index LOCAL-FIRST (#983). See {@link getRegistryItem}.
 *
 * @param {string} [registryUrl]
 */
export async function getRegistryIndex(registryUrl) {
  if (isDefaultRegistry(registryUrl)) return loadRegistryIndex();
  return fetchRegistryIndex(registryUrl);
}

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
    throw new Error(`Failed to fetch registry item "${name}" from ${url}: HTTP ${res.status}`);
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
    throw new Error(`Failed to fetch registry index from ${url}: HTTP ${res.status}`);
  }
  const json = await res.json();
  const items = registryIndexSchema.parse(json);
  cache.set(url, items);
  return items;
}
