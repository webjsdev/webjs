import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldGroupClass, fieldClass, fieldContentClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';

// position="item-aligned" (the default) opens the list over the trigger on
// the chosen option; position="popper" opens it below the trigger. The
// switch shows the setting this select renders with.
export default function SelectAlignItem() {
  const alignItemWithTrigger = true;

  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'w-full max-w-xs')}>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <div data-slot="field-content" class=${fieldContentClass()}>
          <label data-slot="field-label" for="align-item" class=${fieldLabelClass()}>Align Item</label>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>
            Toggle to align the item with the trigger.
          </p>
        </div>
        <ui-switch input-id="align-item" ?checked=${alignItemWithTrigger}></ui-switch>
      </div>
      <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
        <ui-select position=${alignItemWithTrigger ? 'item-aligned' : 'popper'}>
          <select name="fruit" aria-label="Fruit" class=${cn(selectTriggerClass(), 'w-full')}>
            <option value="apple">Apple</option>
            <option value="banana" selected>Banana</option>
            <option value="blueberry">Blueberry</option>
            <option value="grapes">Grapes</option>
            <option value="pineapple">Pineapple</option>
          </select>
        </ui-select>
      </div>
    </div>
  `;
}
