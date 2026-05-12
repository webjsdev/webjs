/**
 * Card — visual container. Pure class-helper functions; compose with any
 * element you like (most commonly `<div>`).
 *
 * shadcn parity:
 *   Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter.
 *
 * Usage:
 *   <div class=${cardClass()}>
 *     <div class=${cardHeaderClass()}>
 *       <div class=${cardTitleClass()}>Notifications</div>
 *       <div class=${cardDescriptionClass()}>You have 3 unread messages.</div>
 *       <div class=${cardActionClass()}>
 *         <button class=${buttonClass({ variant: 'ghost', size: 'sm' })}>Mark all read</button>
 *       </div>
 *     </div>
 *     <div class=${cardContentClass()}>…</div>
 *     <div class=${cardFooterClass()}>
 *       <button class=${buttonClass()}>Save</button>
 *     </div>
 *   </div>
 *
 * Design tokens used: --card, --card-foreground, --muted-foreground, --border.
 */

/** Card root. `data-slot="card"` recommended on the host. */
export const cardClass = (): string =>
  'flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm';

/** Card header — supports an optional `CardAction` slot via grid layout. */
export const cardHeaderClass = (): string =>
  '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6';

/** Card title — heading text within the header. */
export const cardTitleClass = (): string => 'leading-none font-semibold';

/** Card description — subdued caption beneath the title. */
export const cardDescriptionClass = (): string => 'text-sm text-muted-foreground';

/** Card action — right-aligned controls inside the header (matches shadcn CardAction). */
export const cardActionClass = (): string =>
  'col-start-2 row-span-2 row-start-1 self-start justify-self-end';

/** Card content — the main body region. */
export const cardContentClass = (): string => 'px-6';

/** Card footer — trailing controls or actions. */
export const cardFooterClass = (): string => 'flex items-center px-6 [.border-t]:pt-6';
