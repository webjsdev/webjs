import { html } from '@webjsdev/core';
import {
  nativeSelectWrapperClass, nativeSelectClass, nativeSelectIconClass,
} from '#modules/ui/components/native-select.ts';
import { ChevronDownIcon } from '#lib/ui/lucide.ts';

export default function NativeSelectDemo() {
  return html`
    <div data-slot="native-select-wrapper" data-size="default" class=${nativeSelectWrapperClass()}>
      <select data-slot="native-select" data-size="default" aria-label="Status" class=${nativeSelectClass()}>
        <option data-slot="native-select-option" value="">Select status</option>
        <option data-slot="native-select-option" value="todo">Todo</option>
        <option data-slot="native-select-option" value="in-progress">In Progress</option>
        <option data-slot="native-select-option" value="done">Done</option>
        <option data-slot="native-select-option" value="cancelled">Cancelled</option>
      </select>
      ${ChevronDownIcon(nativeSelectIconClass())}
    </div>
  `;
}
