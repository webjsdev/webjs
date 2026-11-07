/**
 * The docs demos that are whole pages, linked from a docs page to open full
 * screen (shadcn's "View RTL Sidebar"), and so served by /ui/view/<name>
 * beside the blocks. Each renders in nova, the docs previews' style. Shared
 * by that route and lib/ui/style-links.ts, which links the style the frame
 * renders, so the two cannot disagree.
 */
export const FULL_SCREEN_DEMOS: ReadonlySet<string> = new Set(['sidebar-rtl']);
