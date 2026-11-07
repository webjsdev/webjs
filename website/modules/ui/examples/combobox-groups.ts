import { html } from '@webjsdev/core';

const timezones = [
  {
    value: 'Americas',
    items: [
      '(GMT-5) New York',
      '(GMT-8) Los Angeles',
      '(GMT-6) Chicago',
      '(GMT-5) Toronto',
      '(GMT-8) Vancouver',
      '(GMT-3) São Paulo',
    ],
  },
  {
    value: 'Europe',
    items: [
      '(GMT+0) London',
      '(GMT+1) Paris',
      '(GMT+1) Berlin',
      '(GMT+1) Rome',
      '(GMT+1) Madrid',
      '(GMT+1) Amsterdam',
    ],
  },
  {
    value: 'Asia/Pacific',
    items: [
      '(GMT+9) Tokyo',
      '(GMT+8) Shanghai',
      '(GMT+8) Singapore',
      '(GMT+4) Dubai',
      '(GMT+11) Sydney',
      '(GMT+9) Seoul',
    ],
  },
];

export default function ComboboxWithGroupsAndSeparator() {
  return html`
    <ui-combobox>
      <ui-combobox-input placeholder="Select a timezone" aria-label="Timezone"></ui-combobox-input>
      <ui-combobox-content>
        <ui-combobox-empty>No timezones found.</ui-combobox-empty>
        <ui-combobox-list>
          ${timezones.map((group, index) => html`
            <ui-combobox-group>
              <ui-combobox-label>${group.value}</ui-combobox-label>
              ${group.items.map((item) => html`<ui-combobox-item value=${item}>${item}</ui-combobox-item>`)}
              ${index < timezones.length - 1 ? html`<ui-combobox-separator></ui-combobox-separator>` : ''}
            </ui-combobox-group>
          `)}
        </ui-combobox-list>
      </ui-combobox-content>
    </ui-combobox>
  `;
}
