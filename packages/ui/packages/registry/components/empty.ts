/**
 * Empty: the empty state for a list, table, search result, or any region with
 * nothing to show yet. Tier-1 class helpers; compose with `<div>` (or a heading
 * and paragraph) for each subpart.
 *
 * shadcn parity:
 *   Empty                               → emptyClass()
 *   EmptyHeader                         → emptyHeaderClass()
 *   EmptyMedia (variant: default | icon) → emptyMediaClass({ variant })
 *   EmptyTitle                          → emptyTitleClass()
 *   EmptyDescription                    → emptyDescriptionClass()
 *   EmptyContent                        → emptyContentClass()
 *
 * The root carries `border-dashed` but no border width, exactly as shadcn
 * does, so it renders borderless by default. Add `border` beside it for the
 * dashed outline: `class=${cn(emptyClass(), 'border')}`.
 *
 * Design tokens used: --muted, --foreground, --muted-foreground, --primary,
 * --border.
 *
 * A11y (required for accessible output):
 *   Use a REAL HEADING for `emptyTitleClass()`, at the level the surrounding
 *   document wants (`<h2>` under the page `<h1>`, `<h3>` inside a section). The
 *   empty state usually replaces the list a heading already introduces, so the
 *   title is often a level below it.
 *   The media is decorative: put `aria-hidden="true"` on the icon or
 *   illustration, since the title already says what is missing.
 *   The action in `emptyContentClass()` is a real `<a href>` (navigates, e.g.
 *   to the create page) or a real `<button>` (acts in place). A create action
 *   that is a form submit keeps working without JavaScript.
 *   When the empty state appears in response to a user action (a search or a
 *   filter that matched nothing), put `role="status"` on the root so the change
 *   is announced; a page that simply loads empty needs no role.
 *
 * @example
 * ```html
 * <div class=${cn(emptyClass(), 'border')}>
 *   <div class=${emptyHeaderClass()}>
 *     <div class=${emptyMediaClass({ variant: 'icon' })}>
 *       <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
 *     </div>
 *     <h3 class=${emptyTitleClass()}>No projects yet</h3>
 *     <p class=${emptyDescriptionClass()}>Create your first project to get started.</p>
 *   </div>
 *   <div class=${emptyContentClass()}>
 *     <a class=${buttonClass()} href="/projects/new">Create project</a>
 *   </div>
 * </div>
 * ```
 */

const MEDIA_BASE =
  'mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0';

const MEDIA_VARIANTS = {
  default: 'bg-transparent',
  icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
} as const;

export type EmptyMediaVariant = keyof typeof MEDIA_VARIANTS;

/** Empty root: centred column with generous padding. Add `border` for the dashed outline. */
export const emptyClass = (): string =>
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12';

/** Empty header: groups the media, title, and description. */
export const emptyHeaderClass = (): string =>
  'flex max-w-sm flex-col items-center gap-2 text-center';

/**
 * Empty media: the icon or illustration above the title. `icon` puts the icon
 * on a muted tile; `default` leaves it bare (for an avatar or an illustration).
 * Set `data-variant="<variant>"` on the same element for shadcn parity.
 */
export function emptyMediaClass(opts: { variant?: EmptyMediaVariant } = {}): string {
  return MEDIA_BASE + ' ' + MEDIA_VARIANTS[opts.variant ?? 'default'];
}

/** Empty title: what is missing, in a few words. */
export const emptyTitleClass = (): string => 'text-lg font-medium tracking-tight';

/** Empty description: the muted line under the title, saying what to do next. */
export const emptyDescriptionClass = (): string =>
  'text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary';

/** Empty content: the row for the action button(s) or a small form. */
export const emptyContentClass = (): string =>
  'flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance';
