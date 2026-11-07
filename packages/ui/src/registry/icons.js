/**
 * The app's icon library in a resolved install tree (#1666).
 *
 * Registry items depend on `lib-icons` (the Lucide file). The other four
 * libraries export the same function names and land at the same path, so an
 * app whose `components.json` names one of them gets that library's file in
 * place of Lucide's, and a block's icons draw in the library the app chose.
 *
 * @module registry/icons
 */

import { getRegistryItem } from './fetcher.js';
import { getIconLibrary } from '../../packages/registry/themes/preset.js';

/**
 * Replace `lib-icons` in a resolved tree with the item for `iconLibrary`.
 * A tree without `lib-icons`, Lucide, or an unknown library name is
 * returned as it is.
 *
 * @param {any[]} tree the items `resolveTree` returned
 * @param {string | undefined} iconLibrary `components.json` `iconLibrary`
 * @param {string} [registryUrl]
 * @returns {Promise<any[]>}
 */
export async function withIconLibrary(tree, iconLibrary, registryUrl) {
  const lib = getIconLibrary(iconLibrary || 'lucide');
  if (!lib || lib.item === 'lib-icons') return tree;
  if (!tree.some((it) => it.name === 'lib-icons')) return tree;
  const chosen = await getRegistryItem(lib.item, registryUrl);
  return tree.map((it) => (it.name === 'lib-icons' ? chosen : it));
}
