import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  itemClass, itemContentClass, itemTitleClass, itemDescriptionClass,
} from '#modules/ui/components/item.ts';

const countries = [
  { code: '', value: '', continent: '', label: 'Select country' },
  { code: 'ar', value: 'argentina', label: 'Argentina', continent: 'South America' },
  { code: 'au', value: 'australia', label: 'Australia', continent: 'Oceania' },
  { code: 'br', value: 'brazil', label: 'Brazil', continent: 'South America' },
  { code: 'ca', value: 'canada', label: 'Canada', continent: 'North America' },
  { code: 'cn', value: 'china', label: 'China', continent: 'Asia' },
  { code: 'co', value: 'colombia', label: 'Colombia', continent: 'South America' },
  { code: 'eg', value: 'egypt', label: 'Egypt', continent: 'Africa' },
  { code: 'fr', value: 'france', label: 'France', continent: 'Europe' },
  { code: 'de', value: 'germany', label: 'Germany', continent: 'Europe' },
  { code: 'it', value: 'italy', label: 'Italy', continent: 'Europe' },
  { code: 'jp', value: 'japan', label: 'Japan', continent: 'Asia' },
  { code: 'ke', value: 'kenya', label: 'Kenya', continent: 'Africa' },
  { code: 'mx', value: 'mexico', label: 'Mexico', continent: 'North America' },
  { code: 'nz', value: 'new-zealand', label: 'New Zealand', continent: 'Oceania' },
  { code: 'ng', value: 'nigeria', label: 'Nigeria', continent: 'Africa' },
  { code: 'za', value: 'south-africa', label: 'South Africa', continent: 'Africa' },
  { code: 'kr', value: 'south-korea', label: 'South Korea', continent: 'Asia' },
  { code: 'gb', value: 'united-kingdom', label: 'United Kingdom', continent: 'Europe' },
  { code: 'us', value: 'united-states', label: 'United States', continent: 'North America' },
];

// An item's value is its `value` attribute and its label is its text, so an
// object list maps to items with the id as the value.
export default function ComboboxWithCustomItems() {
  return html`
    <ui-combobox>
      <ui-combobox-input placeholder="Search countries..." aria-label="Country"></ui-combobox-input>
      <ui-combobox-content>
        <ui-combobox-empty>No countries found.</ui-combobox-empty>
        <ui-combobox-list>
          ${countries.filter((country) => country.code !== '').map((country) => html`
            <ui-combobox-item value=${country.value}>
              <div data-slot="item" data-variant="default" data-size="xs" class=${cn(itemClass({ size: 'xs' }), 'p-0')}>
                <div data-slot="item-content" class=${itemContentClass()}>
                  <div data-slot="item-title" class=${cn(itemTitleClass(), 'whitespace-nowrap')}>${country.label}</div>
                  <p data-slot="item-description" class=${itemDescriptionClass()}>${country.continent} (${country.code})</p>
                </div>
              </div>
            </ui-combobox-item>
          `)}
        </ui-combobox-list>
      </ui-combobox-content>
    </ui-combobox>
  `;
}
