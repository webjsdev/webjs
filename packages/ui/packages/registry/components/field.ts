/**
 * Field: the layout system for a form, a label, a control, its helper text,
 * and its error message, plus the fieldset, legend, and group that hold many
 * fields. Tier-1 class helpers; compose with the native elements (`<fieldset>`,
 * `<legend>`, `<label>`, `<p>`) and the kit's control helpers
 * (`inputClass()`, `textareaClass()`, `checkboxClass()`, and the rest).
 *
 * shadcn parity:
 *   FieldSet                             → fieldSetClass()
 *   FieldLegend (variant: legend | label) → fieldLegendClass({ variant })
 *   FieldGroup                           → fieldGroupClass()
 *   Field (orientation: vertical | horizontal | responsive) → fieldClass({ orientation })
 *   FieldContent                         → fieldContentClass()
 *   FieldLabel                           → fieldLabelClass()
 *   FieldTitle                           → fieldTitleClass()
 *   FieldDescription                     → fieldDescriptionClass()
 *   FieldError                           → fieldErrorClass()
 *   FieldSeparator                       → fieldSeparatorClass() + fieldSeparatorContentClass()
 *
 * Set the shadcn data attributes on the same elements, because the sibling and
 * group rules key on them: `data-slot="field"` + `data-orientation` on the
 * field, `data-slot="field-label"` on the label, `data-slot="field-content"`
 * on the content wrapper, `data-variant` on the legend, and
 * `data-slot="field-group"` on the group (the `responsive` orientation reads
 * the group's container width).
 *
 * Invalid state: put `data-invalid="true"` on the field, which turns the
 * field's text destructive (`data-[invalid=true]:text-destructive`), and
 * `aria-invalid="true"` on the control, which the control helpers style.
 * Disabled state: `data-disabled="true"` on the field fades its label.
 *
 * Not the same as the `fieldClass()` / `fieldLabelClass()` in the `cn()`
 * helper module (`lib/utils/cn.ts`), which are the older single-field rhythm
 * helpers (`grid gap-2`). Both keep working. Import each from its own module,
 * and alias one (`import { fieldClass as fieldStackClass } from ...`) if a file
 * needs both.
 *
 * Design tokens used: --destructive, --muted-foreground, --primary,
 * --background, --border.
 *
 * A11y (required for accessible output):
 *   Every control has a real `<label for>` (`fieldLabelClass()`), never a
 *   placeholder alone. A field carries `role="group"` (as shadcn's does) only
 *   when it holds more than one control; a single-control field needs no role.
 *   Wire the helper and error text to the control with `aria-describedby`,
 *   listing the description id and, when invalid, the error id
 *   (`aria-describedby="email-desc email-error"`). Point it only at ids that
 *   EXIST on the page, so render the error element only when there is an error.
 *   On a server validation error, re-render the form with the typed values
 *   kept (`value=${values.email}`), `data-invalid="true"` on the field,
 *   `aria-invalid="true"` on the control, and the message in
 *   `fieldErrorClass()` with `role="alert"`, so the user fixes the one field
 *   instead of retyping the form. Move focus to the first invalid control.
 *   Group related controls (a radio set, a checkbox list) in a `<fieldset>`
 *   with a `<legend>` (`fieldSetClass()` / `fieldLegendClass()`), which names
 *   the group. A `fieldTitleClass()` element is NOT a label: use it for the
 *   title inside a choice card whose `<label>` wraps the whole card.
 *   A decorative separator gets `role="none"`; its text (`or`) stays readable.
 *
 * @example
 * ```html
 * <form method="post" class="w-full max-w-md">
 *   <fieldset class=${fieldSetClass()}>
 *     <legend class=${fieldLegendClass()} data-variant="legend">Profile</legend>
 *     <p class=${fieldDescriptionClass()}>This is how others see you.</p>
 *     <div class=${fieldGroupClass()} data-slot="field-group">
 *       <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
 *         <label class=${fieldLabelClass()} data-slot="field-label" for="name">Name</label>
 *         <input class=${inputClass()} id="name" name="name" value="Ada" aria-describedby="name-desc">
 *         <p class=${fieldDescriptionClass()} id="name-desc">Shown on your public page.</p>
 *       </div>
 *       <div class=${fieldClass()} data-slot="field" data-orientation="vertical" data-invalid="true">
 *         <label class=${fieldLabelClass()} data-slot="field-label" for="email">Email</label>
 *         <input class=${inputClass()} id="email" name="email" type="email" value="ada@" aria-invalid="true" aria-describedby="email-error">
 *         <div class=${fieldErrorClass()} id="email-error" role="alert">Enter a valid email address.</div>
 *       </div>
 *       <div class=${fieldSeparatorClass()} role="none"><span class=${fieldSeparatorContentClass()}>Notifications</span></div>
 *       <div class=${fieldClass({ orientation: 'horizontal' })} data-slot="field" data-orientation="horizontal">
 *         <input class=${checkboxClass()} data-slot="checkbox" type="checkbox" id="digest" name="digest">
 *         <label class=${fieldLabelClass()} data-slot="field-label" for="digest">Send me a weekly digest</label>
 *       </div>
 *     </div>
 *   </fieldset>
 * </form>
 * ```
 */

export type FieldLegendVariant = 'legend' | 'label';
export type FieldOrientation = 'vertical' | 'horizontal' | 'responsive';

const LEGEND_VARIANTS = {
  legend: 'text-base',
  label: 'text-sm',
} as const;

const ORIENTATIONS = {
  vertical: 'flex-col [&>*]:w-full [&>.sr-only]:w-auto',
  horizontal:
    'flex-row items-center [&>[data-slot=field-label]]:flex-auto has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[type=checkbox],[type=radio]]:mt-px',
  responsive:
    'flex-col @md/field-group:flex-row @md/field-group:items-center [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-auto @md/field-group:[&>[data-slot=field-label]]:flex-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[type=checkbox],[type=radio]]:mt-px',
} as const;

/** Field set: a native `<fieldset>` holding a legend and a group of fields. */
export const fieldSetClass = (): string =>
  'flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3';

/**
 * Field legend: the `<legend>` naming a field set. `legend` is section-sized,
 * `label` matches a field label (for a radio or checkbox set). Set
 * `data-variant="<variant>"` on the same element so a following description
 * tightens its spacing.
 */
export function fieldLegendClass(opts: { variant?: FieldLegendVariant } = {}): string {
  return 'mb-3 font-medium ' + LEGEND_VARIANTS[opts.variant ?? 'legend'];
}

/** Field group: stacks fields, and is the container `responsive` fields measure. */
export const fieldGroupClass = (): string =>
  'group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4';

/**
 * Field: one label + control + text unit. `vertical` stacks them, `horizontal`
 * puts the control beside the label (checkbox, switch), and `responsive` stacks
 * on a narrow group and goes side by side from the group's `md` width.
 */
export function fieldClass(opts: { orientation?: FieldOrientation } = {}): string {
  return (
    'group/field flex w-full gap-3 data-[invalid=true]:text-destructive ' +
    ORIENTATIONS[opts.orientation ?? 'vertical']
  );
}

/** Field content: wraps a label and description beside a horizontal control. */
export const fieldContentClass = (): string =>
  'group/field-content flex flex-1 flex-col gap-1.5 leading-snug';

/** Field label: the `<label for>` of the control. Fades when the field is data-disabled. */
export const fieldLabelClass = (): string =>
  'group/field-label peer/field-label flex w-fit items-center gap-2 text-sm leading-snug font-medium select-none group-data-[disabled=true]/field:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-4 has-checked:border-primary has-checked:bg-primary/5 dark:has-checked:bg-primary/10';

/** Field title: label-styled text that is not a `<label>` (a choice card's heading). */
export const fieldTitleClass = (): string =>
  'flex w-fit items-center gap-2 text-sm leading-snug font-medium group-data-[disabled=true]/field:opacity-50';

/** Field description: the muted helper text under (or beside) the control. */
export const fieldDescriptionClass = (): string =>
  'text-sm leading-normal font-normal text-muted-foreground group-has-[[data-orientation=horizontal]]/field:text-balance last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5 [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary';

/** Field error: the inline validation message. Give it an id the control's aria-describedby lists. */
export const fieldErrorClass = (): string => 'text-sm font-normal text-destructive';

/**
 * Field separator: a horizontal rule between fields, drawn by the element's own
 * `::before`, with optional centred text in a `fieldSeparatorContentClass()`
 * span.
 */
export const fieldSeparatorClass = (): string =>
  'relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2 before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-border';

/** Field separator content: the text on the separator line (`or`, a section name). */
export const fieldSeparatorContentClass = (): string =>
  'relative mx-auto block w-fit bg-background px-2 text-muted-foreground';
