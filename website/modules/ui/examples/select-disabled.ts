import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';

export default function SelectDisabled() {
  return html`
    <ui-select placeholder="Select a fruit">
      <select name="fruit" aria-label="Fruit" disabled class=${cn(selectTriggerClass(), 'w-full max-w-48')}>
        <option value="" disabled selected hidden>Select a fruit</option>
        <optgroup label="Fruits">
          <option value="apple">Apple</option>
          <option value="banana">Banana</option>
          <option value="blueberry">Blueberry</option>
          <option value="grapes" disabled>Grapes</option>
          <option value="pineapple">Pineapple</option>
        </optgroup>
      </select>
    </ui-select>
  `;
}
