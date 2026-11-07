import { html } from '@webjsdev/core';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';

const weights = [
  { value: 'light', label: 'Light', class: 'font-light' },
  { value: 'normal', label: 'Normal', class: 'font-normal' },
  { value: 'medium', label: 'Medium', class: 'font-medium' },
  { value: 'bold', label: 'Bold', class: 'font-bold' },
];

// The group shows its initial selection, "normal". Picking another weight
// updates the group's value and dispatches ui-value-change.
export default function ToggleGroupFontWeightSelector() {
  const fontWeight = 'normal';
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
      <label data-slot="field-label" class=${fieldLabelClass()}>Font Weight</label>
      <ui-toggle-group type="single" value=${fontWeight} variant="outline" spacing="2" size="lg">
        ${weights.map((w) => html`
          <ui-toggle-group-item value=${w.value} aria-label=${w.label} class="flex size-16 flex-col items-center justify-center rounded-xl">
            <span class=${'text-2xl leading-none ' + w.class}>Aa</span>
            <span class="text-xs text-muted-foreground">${w.label}</span>
          </ui-toggle-group-item>
        `)}
      </ui-toggle-group>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>
        Use
        <code class="rounded-md bg-muted px-1 py-0.5 font-mono">font-${fontWeight}</code>
        to set the font weight.
      </p>
    </div>
  `;
}
