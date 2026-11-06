/**
 * Trace: a vertical timeline of steps (a tool call, a reasoning step, a
 * deploy stage), each with an icon on a connecting line, a title and an
 * optional collapsible detail. Tier-1 class helper; compose with plain
 * elements and `<details>` for the collapsible part.
 *
 * shadcn parity:
 *   Trace                       → traceClass()
 *   TraceLine / TraceIcon       → traceLineClass() / traceIconClass()
 *   TraceTitle / TraceDescription
 *                               → traceTitleClass() / traceDescriptionClass()
 *   TraceCollapsible / TraceCollapsibleTrigger / TraceCollapsibleContent
 *                               → <details> / <summary> / a div, with the
 *                                 trace collapsible helpers
 *
 * shadcn has no new-york version of this component, so its look in the
 * default style is shadcn's vega style, the classic shadcn look.
 *
 * A11y (required for accessible output): a trace is an ordered list of steps,
 * so render it as `<ol>` with each step an `<li>`. A step's status must be in
 * text, not only in the icon colour ("Failed", "Done"), and a decorative icon
 * takes `aria-hidden="true"`. A collapsible step is a native `<details>` with a
 * `<summary>`, which carries the expanded state by itself.
 *
 * Design tokens used: --border, --muted-foreground, --foreground.
 *
 * @example
 * ```html
 * <ol class=${traceClass()} data-slot="trace">
 *   <li class=${traceLineClass()} data-slot="trace-line">
 *     <span class=${traceTitleClass()} data-slot="trace-title">Fetched the issue</span>
 *   </li>
 * </ol>
 * ```
 */

/** Set `data-slot="trace"` on the element. */
export function traceClass(): string {
  return 'cn-trace flex w-full min-w-0 flex-col *:has-[>[data-slot=trace-line]]:flex *:has-[>[data-slot=trace-line]]:w-fit *:has-[>[data-slot=trace-line]]:max-w-full *:has-[>[data-slot=trace-line]]:min-w-0 *:has-[>[data-slot=trace-line]]:text-start *:has-[>[data-slot=trace-line]]:outline-none';
}

/** Set `data-slot="trace-line"` on the element. */
export function traceLineClass(): string {
  return 'cn-trace-line flex w-fit max-w-full min-w-0 items-center text-muted-foreground transition-colors in-[a,button]:cursor-pointer in-[a:hover,button:hover]:text-foreground data-[status=error]:text-destructive data-[status=error]:in-[a:hover,button:hover]:text-destructive data-[status=pending]:opacity-60 data-[status=running]:*:data-[slot=trace-title]:shimmer';
}

/** Set `data-slot="trace-icon"` on the element. */
export function traceIconClass(): string {
  return 'cn-trace-icon flex shrink-0 items-center justify-center [&_svg]:pointer-events-none';
}

/** Set `data-slot="trace-title"` on the element. */
export function traceTitleClass(): string {
  return 'cn-trace-title min-w-0 truncate motion-reduce:shimmer-none';
}

/** Set `data-slot="trace-description"` on the element. */
export function traceDescriptionClass(): string {
  return 'cn-trace-description shrink-0 text-muted-foreground/70 tabular-nums';
}

/** Set `data-slot="trace-collapsible"` on the element. */
export function traceCollapsibleClass(): string {
  return 'cn-trace-collapsible flex w-full min-w-0 flex-col';
}

/** Set `data-slot="trace-collapsible-trigger"` on the element. */
export function traceCollapsibleTriggerClass(): string {
  return 'cn-trace-collapsible-trigger group/trace-collapsible-trigger flex w-fit max-w-full min-w-0 cursor-pointer items-center text-start text-muted-foreground transition-colors outline-none hover:text-foreground has-[[data-status=error]]:text-destructive';
}

/** Set `data-slot="trace-collapsible-content"` on the element. */
export function traceCollapsibleContentClass(): string {
  return 'cn-trace-collapsible-content-inner min-w-0 wrap-break-word text-muted-foreground';
}
