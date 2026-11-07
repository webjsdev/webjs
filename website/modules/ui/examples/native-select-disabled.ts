import { html } from '@webjsdev/core';
import {
  nativeSelectWrapperClass, nativeSelectClass, nativeSelectIconClass,
} from '#modules/ui/components/native-select.ts';
import { ChevronDownIcon } from '#lib/ui/lucide.ts';

export default function NativeSelectDisabled() {
  return html`
    <div data-slot="native-select-wrapper" data-size="default" class=${nativeSelectWrapperClass()}>
      <select data-slot="native-select" data-size="default" aria-label="Fruit" disabled class=${nativeSelectClass()}>
        <option data-slot="native-select-option" value="">Disabled</option>
        <option data-slot="native-select-option" value="apple">Apple</option>
        <option data-slot="native-select-option" value="banana">Banana</option>
        <option data-slot="native-select-option" value="blueberry">Blueberry</option>
      </select>
      ${ChevronDownIcon(nativeSelectIconClass())}
    </div>
  `;
}
