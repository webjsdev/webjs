/**
 * Input group: an input or textarea with addons inside its border (an icon, a
 * prefix such as "https://", a button, a counter), sharing one focus ring.
 * Tier-1 class helper; compose with a real `<input>` or `<textarea>`.
 *
 * shadcn parity:
 *   InputGroup                 → inputGroupClass()
 *   InputGroupAddon (align: inline-start | inline-end | block-start | block-end)
 *                              → inputGroupAddonClass({ align }), alias inputGroupAddonVariants
 *   InputGroupButton (size)    → inputGroupButtonClass({ size }) with buttonClass({ variant })
 *   InputGroupText             → inputGroupTextClass()
 *   InputGroupInput / InputGroupTextarea
 *                              → inputGroupInputClass() / inputGroupTextareaClass()
 *
 * The group draws the border and the focus ring, so the control inside drops
 * its own. Clicking an addon focuses the control through a `<label for>`, with
 * no script: make the addon a `<label>` pointing at the control's id.
 *
 * A11y (required for accessible output): the control still needs its own
 * accessible name, from a visible `<label for>` outside the group or an
 * `aria-label` on the control; an addon's text is not its name. A decorative
 * icon addon takes `aria-hidden="true"`. An addon button is a real
 * `<button type="button">` with its own name.
 *
 * Design tokens used: --input, --ring, --muted-foreground, --destructive.
 *
 * @example
 * ```html
 * <div class=${inputGroupClass()} data-slot="input-group" role="group">
 *   <label class=${inputGroupAddonClass()} data-slot="input-group-addon" for="site">https://</label>
 *   <input class=${inputGroupInputClass()} data-slot="input-group-control" id="site" name="site" aria-label="Website">
 * </div>
 * ```
 */
import { cn } from '../lib/utils.ts';

/** Set `data-slot="input-group"` on the element. */
export function inputGroupClass(): string {
  return 'group/input-group cn-input-group relative flex w-full min-w-0 items-center outline-none has-[>textarea]:h-auto';
}

const INPUT_GROUP_ADDON_BASE =
  'cn-input-group-addon flex cursor-text items-center justify-center select-none';

const INPUT_GROUP_ADDON_ALIGNS = {
  'inline-start': 'cn-input-group-addon-align-inline-start order-first',
  'inline-end': 'cn-input-group-addon-align-inline-end order-last',
  'block-start': 'cn-input-group-addon-align-block-start order-first w-full justify-start',
  'block-end': 'cn-input-group-addon-align-block-end order-last w-full justify-start',
} as const;

/** The part, with its variant options. Set its `data-slot` and any `data-variant` / `data-size` to match. */
export function inputGroupAddonClass(opts: { align?: keyof typeof INPUT_GROUP_ADDON_ALIGNS } = {}): string {
  return cn(INPUT_GROUP_ADDON_BASE, INPUT_GROUP_ADDON_ALIGNS[opts.align ?? 'inline-start']);
}

/**
 * shadcn's name for {@link inputGroupAddonClass}, so shadcn code ports verbatim. Like cva,
 * it merges a `className` into the result.
 */
export function inputGroupAddonVariants(opts: { align?: keyof typeof INPUT_GROUP_ADDON_ALIGNS } & { className?: string } = {}): string {
  return cn(inputGroupAddonClass(opts), opts.className);
}

const INPUT_GROUP_BUTTON_BASE =
  'cn-input-group-button flex items-center shadow-none';

const INPUT_GROUP_BUTTON_SIZES = {
  xs: 'cn-input-group-button-size-xs',
  sm: 'cn-input-group-button-size-sm',
  'icon-xs': 'cn-input-group-button-size-icon-xs',
  'icon-sm': 'cn-input-group-button-size-icon-sm',
} as const;

/** The part, with its variant options. Set its `data-slot` and any `data-variant` / `data-size` to match. */
export function inputGroupButtonClass(opts: { size?: keyof typeof INPUT_GROUP_BUTTON_SIZES } = {}): string {
  return cn(INPUT_GROUP_BUTTON_BASE, INPUT_GROUP_BUTTON_SIZES[opts.size ?? 'xs']);
}

/**
 * shadcn's name for {@link inputGroupButtonClass}, so shadcn code ports verbatim. Like cva,
 * it merges a `className` into the result.
 */
export function inputGroupButtonVariants(opts: { size?: keyof typeof INPUT_GROUP_BUTTON_SIZES } & { className?: string } = {}): string {
  return cn(inputGroupButtonClass(opts), opts.className);
}

/** A part with no `data-slot` of its own. */
export function inputGroupTextClass(): string {
  return 'cn-input-group-text flex items-center [&_svg]:pointer-events-none';
}

/** Set `data-slot="input-group-control"` on the element. */
export function inputGroupInputClass(): string {
  return 'cn-input-group-input flex-1';
}

/** Set `data-slot="input-group-control"` on the element. */
export function inputGroupTextareaClass(): string {
  return 'cn-input-group-textarea flex-1 resize-none';
}
