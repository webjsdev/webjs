/**
 * The design-system registry items that are built from data rather than
 * listed in registry.json (#1666): shadcn's 17 accent themes and the 52 font
 * items. Both registry composers serve them through these two functions, the
 * CLI's (`src/registry/local.js`) and the site's
 * (`website/modules/ui/queries/registry.server.ts`), so the two cannot
 * disagree.
 *
 * The 7 base-colour themes are not here. `theme-neutral` is a registry.json
 * item and the other six are synthesized by each composer from
 * `base-colors.js`, and all seven carry the theme FILE `init --base-color`
 * writes. An accent theme carries only `cssVars`, shadcn's shape for it,
 * since it is a layer over a base colour rather than a stylesheet of its own.
 */

import { THEMES, isBaseColor } from './themes.js';
import { fontItems } from './fonts.js';

/** The accent themes' registry items, `theme-<name>`. */
function accentThemeItems() {
  return THEMES.filter((t) => !isBaseColor(t.name)).map((t) => ({
    name: `theme-${t.name}`,
    type: 'registry:theme',
    title: t.title,
    description: `${t.title} accent: the primary, chart and sidebar tokens, layered over a base color`,
    cssVars: { light: { ...t.cssVars.light }, dark: { ...t.cssVars.dark } },
  }));
}

/**
 * @typedef {object} DesignSystemItem
 * @property {string} name
 * @property {string} type
 * @property {string} title
 * @property {string} description
 * @property {{ theme?: Record<string, string>, light?: Record<string, string>, dark?: Record<string, string> }} cssVars
 * @property {Record<string, unknown>} [font]
 */

/** @type {DesignSystemItem[] | null} */
let cache = null;

/**
 * Every data-built item, accent themes then fonts.
 *
 * @returns {DesignSystemItem[]}
 */
export function designSystemItems() {
  if (!cache) cache = [...accentThemeItems(), ...fontItems()];
  return cache;
}

/**
 * One data-built item by name, or null.
 *
 * @param {string} name
 * @returns {DesignSystemItem | null}
 */
export function designSystemItem(name) {
  return designSystemItems().find((it) => it.name === name) || null;
}
