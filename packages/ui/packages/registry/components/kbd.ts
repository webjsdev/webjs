/**
 * Kbd: keyboard chord display. Pure class helpers; use with native `<kbd>`.
 *
 * shadcn parity: Kbd, KbdGroup.
 *
 * Usage:
 *   <kbd class=${kbdClass()}>⌘</kbd>
 *   <kbd class=${kbdClass()}>K</kbd>
 *
 *   <div class=${kbdGroupClass()}>
 *     <kbd class=${kbdClass()}>⌘</kbd>
 *     <kbd class=${kbdClass()}>Shift</kbd>
 *     <kbd class=${kbdClass()}>P</kbd>
 *   </div>
 *
 * Design tokens used: --muted, --muted-foreground, --background.
 */

export const kbdClass = (): string =>
  "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none [&_svg:not([class*='size-'])]:size-3 [[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10";

export const kbdGroupClass = (): string => 'inline-flex items-center gap-1';
