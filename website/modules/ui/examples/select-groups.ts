import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';

export default function SelectGroups() {
  return html`
    <ui-select placeholder="Select a fruit">
      <select name="food" aria-label="Food" class=${cn(selectTriggerClass(), 'w-full max-w-48')}>
        <option value="" disabled selected hidden>Select a fruit</option>
        <optgroup label="Fruits">
          <option value="apple">Apple</option>
          <option value="banana">Banana</option>
          <option value="blueberry">Blueberry</option>
        </optgroup>
        <hr>
        <optgroup label="Vegetables">
          <option value="carrot">Carrot</option>
          <option value="broccoli">Broccoli</option>
          <option value="spinach">Spinach</option>
        </optgroup>
      </select>
    </ui-select>
  `;
}
