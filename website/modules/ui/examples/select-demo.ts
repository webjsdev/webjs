import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';

export default function SelectDemo() {
  return html`
    <ui-select>
      <select name="fruit" aria-label="Fruit" class=${cn(selectTriggerClass(), 'w-full max-w-48')}>
        <optgroup label="Fruits">
          <option value="" selected>Select a fruit</option>
          <option value="apple">Apple</option>
          <option value="banana">Banana</option>
          <option value="blueberry">Blueberry</option>
          <option value="grapes">Grapes</option>
          <option value="pineapple">Pineapple</option>
        </optgroup>
      </select>
    </ui-select>
  `;
}
