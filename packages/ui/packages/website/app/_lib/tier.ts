/**
 * Tier classification for `@webjskit/ui` registry items.
 *
 * The kit's core mental model: visual primitives are Tier-1 class-helper
 * functions applied to native HTML elements; stateful primitives that
 * need focus management, keyboard nav, or open/close state are Tier-2
 * custom elements. Documented in `packages/ui/AGENTS.md`.
 *
 * Kept in a non-server module so it can be imported from any context
 * (page, layout, client component, build script) without going through
 * the `*.server.ts` RPC-stub rewrite.
 */

import type { RegistryItem } from './registry.server.ts';

/**
 * Tier-2 components: stateful custom elements (`<ui-X>` tags) that
 * manage focus, keyboard nav, open/close state, etc. Everything else
 * with `type === 'registry:ui'` is Tier 1.
 *
 * Migrations to Tier 1 so far:
 *   popover, accordion, collapsible: pure class helpers on native HTML
 *     (Popover API, <details>/<summary>).
 *   dialog, alert-dialog: class helpers on native <dialog> + openDialog /
 *     closeDialog / wireAlertDialog helpers. showModal() owns top-layer,
 *     focus trap, Escape, ::backdrop, focus restoration.
 *   tooltip, hover-card: class helpers on [popover="manual"] + attachTooltip
 *     / attachHoverCard wiring helpers.
 *   progress: class helper on native <progress value max>.
 *   toggle: class helper on native <button aria-pressed> + attachToggle.
 *
 * The remaining four Tier-2 components have repeated inner structure
 * (tabs items, toggle-group items, dropdown-menu items) or a singleton
 * mount point (sonner), so they keep call-site DRY by staying custom
 * elements until they can be rewritten on the WebComponent base class
 * with html`` rendering + light-DOM <slot> projection.
 *
 * When adding a new component to the registry, add its name here if its
 * source defines `class X extends Base | WebComponent` + `defineElement('ui-...')`.
 */
export const TIER_2_NAMES: ReadonlySet<string> = new Set([
  'tabs',
  'toggle-group',
  'dropdown-menu',
  'sonner',
]);

/** 'tier-1' | 'tier-2' classification for a `registry:ui` item. */
export type Tier = 'tier-1' | 'tier-2';

/**
 * Classify a `registry:ui` item. Caller should ensure the item is of
 * `type === 'registry:ui'`, themes / lib items don't have a tier.
 */
export function tierOf(item: Pick<RegistryItem, 'name'>): Tier {
  return TIER_2_NAMES.has(item.name) ? 'tier-2' : 'tier-1';
}

/**
 * Split `registry:ui` items by tier, preserving the input order within
 * each tier. Non-`registry:ui` items (themes, libs) are skipped.
 */
export function splitByTier(items: RegistryItem[]): { tier1: RegistryItem[]; tier2: RegistryItem[] } {
  const tier1: RegistryItem[] = [];
  const tier2: RegistryItem[] = [];
  for (const it of items) {
    if (it.type !== 'registry:ui') continue;
    (tierOf(it) === 'tier-2' ? tier2 : tier1).push(it);
  }
  return { tier1, tier2 };
}
