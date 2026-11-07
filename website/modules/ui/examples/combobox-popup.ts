import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { ChevronDownIcon } from '#lib/ui/lucide.ts';

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

// The combobox opens from its own input, so a list opened from a button is
// a Command in a Popover: the button shows the choice, and the search field
// sits inside the popup. Listen for `ui-select` to set the button's text.
export default function ComboboxPopup() {
  return html`
    <button type="button" popovertarget="combobox-popup" aria-haspopup="dialog" aria-expanded="false" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'w-64 justify-between font-normal')}>
      <span>${countries[0].label}</span>
      ${ChevronDownIcon()}
    </button>
    <div id="combobox-popup" popover role="dialog" aria-label="Select country" data-slot="popover-content" class=${cn(popoverContentClass({ align: 'start' }), 'w-64 p-0')}>
      <ui-command label="Countries">
        <ui-command-input placeholder="Search"></ui-command-input>
        <ui-command-list>
          <ui-command-empty>No items found.</ui-command-empty>
          ${countries.map((item) => html`<ui-command-item value=${item.value || 'none'}>${item.label}</ui-command-item>`)}
        </ui-command-list>
      </ui-command>
    </div>
  `;
}
