import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';

const timezones = [
  {
    label: 'North America',
    items: [
      { value: 'est', label: 'Eastern Standard Time' },
      { value: 'cst', label: 'Central Standard Time' },
      { value: 'mst', label: 'Mountain Standard Time' },
      { value: 'pst', label: 'Pacific Standard Time' },
      { value: 'akst', label: 'Alaska Standard Time' },
      { value: 'hst', label: 'Hawaii Standard Time' },
    ],
  },
  {
    label: 'Europe & Africa',
    items: [
      { value: 'gmt', label: 'Greenwich Mean Time' },
      { value: 'cet', label: 'Central European Time' },
      { value: 'eet', label: 'Eastern European Time' },
      { value: 'west', label: 'Western European Summer Time' },
      { value: 'cat', label: 'Central Africa Time' },
      { value: 'eat', label: 'East Africa Time' },
    ],
  },
  {
    label: 'Asia',
    items: [
      { value: 'msk', label: 'Moscow Time' },
      { value: 'ist', label: 'India Standard Time' },
      { value: 'cst_china', label: 'China Standard Time' },
      { value: 'jst', label: 'Japan Standard Time' },
      { value: 'kst', label: 'Korea Standard Time' },
      { value: 'ist_indonesia', label: 'Indonesia Central Standard Time' },
    ],
  },
  {
    label: 'Australia & Pacific',
    items: [
      { value: 'awst', label: 'Australian Western Standard Time' },
      { value: 'acst', label: 'Australian Central Standard Time' },
      { value: 'aest', label: 'Australian Eastern Standard Time' },
      { value: 'nzst', label: 'New Zealand Standard Time' },
      { value: 'fjt', label: 'Fiji Time' },
    ],
  },
  {
    label: 'South America',
    items: [
      { value: 'art', label: 'Argentina Time' },
      { value: 'bot', label: 'Bolivia Time' },
      { value: 'brt', label: 'Brasilia Time' },
      { value: 'clt', label: 'Chile Standard Time' },
    ],
  },
];

export default function SelectScrollable() {
  return html`
    <ui-select placeholder="Select a timezone">
      <select name="timezone" aria-label="Timezone" class=${cn(selectTriggerClass(), 'w-full max-w-64')}>
        <option value="" disabled selected hidden>Select a timezone</option>
        ${timezones.map((group) => html`
          <optgroup label=${group.label}>
            ${group.items.map((item) => html`<option value=${item.value}>${item.label}</option>`)}
          </optgroup>
        `)}
      </select>
    </ui-select>
  `;
}
