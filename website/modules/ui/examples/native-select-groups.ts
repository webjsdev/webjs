import { html } from '@webjsdev/core';
import {
  nativeSelectWrapperClass, nativeSelectClass, nativeSelectIconClass,
} from '#modules/ui/components/native-select.ts';
import { ChevronDownIcon } from '#lib/ui/lucide.ts';

export default function NativeSelectGroups() {
  return html`
    <div data-slot="native-select-wrapper" data-size="default" class=${nativeSelectWrapperClass()}>
      <select data-slot="native-select" data-size="default" aria-label="Department" class=${nativeSelectClass()}>
        <option data-slot="native-select-option" value="">Select department</option>
        <optgroup data-slot="native-select-optgroup" label="Engineering">
          <option data-slot="native-select-option" value="frontend">Frontend</option>
          <option data-slot="native-select-option" value="backend">Backend</option>
          <option data-slot="native-select-option" value="devops">DevOps</option>
        </optgroup>
        <optgroup data-slot="native-select-optgroup" label="Sales">
          <option data-slot="native-select-option" value="sales-rep">Sales Rep</option>
          <option data-slot="native-select-option" value="account-manager">Account Manager</option>
          <option data-slot="native-select-option" value="sales-director">Sales Director</option>
        </optgroup>
        <optgroup data-slot="native-select-optgroup" label="Operations">
          <option data-slot="native-select-option" value="support">Customer Support</option>
          <option data-slot="native-select-option" value="product-manager">Product Manager</option>
          <option data-slot="native-select-option" value="ops-manager">Operations Manager</option>
        </optgroup>
      </select>
      ${ChevronDownIcon(nativeSelectIconClass())}
    </div>
  `;
}
