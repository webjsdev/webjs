/**
 * Accordion, vertical collapsible list built on native <details>/<summary>.
 *
 * Tier-1 component (no custom element). Exclusive open behavior, what
 * Radix calls `type="single"`, is provided natively by giving each
 * <details> the same `name=""` attribute. Independent open behavior
 * (`type="multiple"`) is the default when `name` is omitted.
 *
 * Both modes give the user `collapsible` behavior for free: clicking the
 * currently-open <summary> always closes it.
 *
 * shadcn parity:
 *   <Accordion type="single" collapsible>
 *     → <div class=${accordionClass()}>
 *         <details name="faq" class=${accordionItemClass()}>…</details>
 *         <details name="faq" class=${accordionItemClass()}>…</details>
 *       </div>
 *
 *   <Accordion type="multiple">
 *     → omit the `name="…"` attribute. Each <details> toggles
 *       independently.
 *
 *   <AccordionTrigger> → <summary class=${accordionTriggerClass()}>
 *   <AccordionContent> → <div class=${accordionContentClass()}>
 *
 * Usage (single-open, exclusive):
 *   <div class=${accordionClass()}>
 *     <details name="faq" class=${accordionItemClass()}>
 *       <summary class=${accordionTriggerClass()}>
 *         <span>Is it accessible?</span>
 *         <svg class="size-4 transition-transform group-open:rotate-180" …></svg>
 *       </summary>
 *       <div class=${accordionContentClass()}>
 *         Yes. Native &lt;details&gt; implements the WAI-ARIA disclosure
 *         widget pattern.
 *       </div>
 *     </details>
 *     <details name="faq" class=${accordionItemClass()} open>
 *       <summary class=${accordionTriggerClass()}>
 *         <span>Is it styled?</span>
 *         <svg class="size-4 transition-transform group-open:rotate-180" …></svg>
 *       </summary>
 *       <div class=${accordionContentClass()}>Yes, shadcn design tokens.</div>
 *     </details>
 *   </div>
 *
 * Initial state: add `open` on the <details> that should render expanded
 * on first paint. Programmatic toggling: `el.open = true | false`.
 *
 * `<details name="X">` is the platform's exclusive-accordion primitive:
 * Chrome 120+, Safari 17.2+, Firefox 130+.
 *
 * Migrated from the prior <ui-accordion> / <ui-accordion-item> /
 * <ui-accordion-trigger> / <ui-accordion-content> custom elements.
 */

/** Root wrapper. Holds the column-of-items rhythm; no display: rules. */
export const accordionClass = (): string => 'w-full';

/**
 * Item: each <details>. The `group` utility lets the trigger's chevron
 * rotate on open via `group-open:rotate-180`. `last:border-b-0` cleans
 * the trailing edge.
 */
export const accordionItemClass = (): string => 'group border-b last:border-b-0';

/**
 * Trigger: applied to <summary>. Hides the native disclosure triangle so
 * authors can compose their own chevron icon (typical pattern: trailing
 * lucide chevron with `group-open:rotate-180`).
 *
 * `disabled: true` returns the visual disabled state (greyed out,
 * not-allowed cursor, no pointer events). For true keyboard prevention
 *, the native disabled-disclosure-widget gap, add the standard
 * `inert` attribute to the <details> element. shadcn's React `disabled`
 * prop combines both; native HTML has no `disabled` on <details>.
 */
export const accordionTriggerClass = (opts: { disabled?: boolean } = {}): string => {
  const base = 'flex w-full cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-sm font-medium outline-none transition-all hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 marker:hidden [&::-webkit-details-marker]:hidden';
  if (opts.disabled) return `${base} pointer-events-none cursor-not-allowed opacity-50`;
  return base;
};

/**
 * Content: <details> hides this entirely when not [open], so all we add
 * is the typography rhythm matching shadcn (bottom padding, small text).
 */
export const accordionContentClass = (): string => 'pb-4 text-sm';
