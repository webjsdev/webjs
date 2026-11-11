/**
 * Input group: an input or textarea with addons inside its border (an icon, a
 * prefix such as "https://", a button, a counter), sharing one focus ring.
 * Tier-1 class helper; compose with a real `<input>` or `<textarea>`.
 *
 * shadcn parity:
 *   InputGroup                 → inputGroupClass()
 *   InputGroupAddon (align: inline-start | inline-end | block-start | block-end)
 *                              → inputGroupAddonClass({ align }), alias inputGroupAddonVariants,
 *                                plus the same `data-align` on the addon (the styles pad the
 *                                control beside it by it)
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
 *   <label class=${inputGroupAddonClass()} data-slot="input-group-addon" data-align="inline-start" for="site">https://</label>
 *   <input class=${inputGroupInputClass()} data-slot="input-group-control" id="site" name="site" aria-label="Website">
 * </div>
 * ```
 */
import { cn } from '../lib/utils.ts';
import { inputClass } from './input.ts';
import { textareaClass } from './textarea.ts';
import { buttonClass, type ButtonVariant } from './button.ts';

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
export function inputGroupAddonClass(opts: { align?: keyof typeof INPUT_GROUP_ADDON_ALIGNS } & { className?: string } = {}): string {
  if (opts.className) return cn(inputGroupAddonClass({ ...opts, className: undefined }), opts.className);
  return cn(INPUT_GROUP_ADDON_BASE, INPUT_GROUP_ADDON_ALIGNS[opts.align ?? 'inline-start']);
}

/**
 * shadcn's name for {@link inputGroupAddonClass}, so shadcn code ports verbatim. Like cva,
 * it merges a `className` into the result.
 */
export function inputGroupAddonVariants(opts: { align?: keyof typeof INPUT_GROUP_ADDON_ALIGNS } & { className?: string } = {}): string {
  return inputGroupAddonClass(opts);
}

const INPUT_GROUP_BUTTON_BASE =
  'cn-input-group-button flex items-center shadow-none';

const INPUT_GROUP_BUTTON_SIZES = {
  xs: 'cn-input-group-button-size-xs',
  sm: 'cn-input-group-button-size-sm',
  'icon-xs': 'cn-input-group-button-size-icon-xs',
  'icon-sm': 'cn-input-group-button-size-icon-sm',
} as const;

/**
 * The part, with its variant options. Set its `data-slot` and any `data-variant` / `data-size` to match.
 *
 * shadcn's InputGroupButton IS its Button (`variant` defaulting to ghost)
 * with these classes on top, so the button's own classes come first and the
 * group's size wins a conflict.
 */
export function inputGroupButtonClass(opts: { size?: keyof typeof INPUT_GROUP_BUTTON_SIZES; variant?: ButtonVariant } & { className?: string } = {}): string {
  if (opts.className) return cn(inputGroupButtonClass({ ...opts, className: undefined }), opts.className);
  return cn(buttonClass({ variant: opts.variant ?? 'ghost' }), INPUT_GROUP_BUTTON_BASE, INPUT_GROUP_BUTTON_SIZES[opts.size ?? 'xs']);
}

/**
 * shadcn's name for {@link inputGroupButtonClass}, so shadcn code ports verbatim. Like cva,
 * it merges a `className` into the result.
 */
export function inputGroupButtonVariants(opts: { size?: keyof typeof INPUT_GROUP_BUTTON_SIZES; variant?: ButtonVariant } & { className?: string } = {}): string {
  return inputGroupButtonClass(opts);
}

/** A part with no `data-slot` of its own. */
export function inputGroupTextClass(): string {
  return 'cn-input-group-text flex items-center [&_svg]:pointer-events-none';
}

/**
 * Set `data-slot="input-group-control"` on the element. shadcn's
 * InputGroupInput is its Input with these classes on top, so the input's own
 * base (its `outline-none` and focus treatment included) comes first and the
 * group's resets win a conflict. Without it a focused control shows the
 * browser's own outline inside the group's ring.
 */
export function inputGroupInputClass(): string {
  return cn(inputClass(), 'cn-input-group-input flex-1');
}

/** Set `data-slot="input-group-control"` on the element. The Textarea's classes, then the group's, as shadcn composes it. */
export function inputGroupTextareaClass(): string {
  return cn(textareaClass(), 'cn-input-group-textarea flex-1 resize-none');
}
