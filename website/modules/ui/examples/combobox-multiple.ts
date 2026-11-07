import { html } from '@webjsdev/core';

const frameworks = ['Next.js', 'SvelteKit', 'Nuxt.js', 'Remix', 'Astro'];

// The chips are drawn from the chosen values, so the markup holds only the
// chips input. `value` is the initial choice, comma separated.
export default function ComboboxMultiple() {
  return html`
    <ui-combobox multiple value=${frameworks[0]} class="w-full max-w-xs">
      <ui-combobox-chips>
        <ui-combobox-chips-input aria-label="Frameworks"></ui-combobox-chips-input>
      </ui-combobox-chips>
      <ui-combobox-content>
        <ui-combobox-empty>No items found.</ui-combobox-empty>
        <ui-combobox-list>
          ${frameworks.map((item) => html`<ui-combobox-item value=${item}>${item}</ui-combobox-item>`)}
        </ui-combobox-list>
      </ui-combobox-content>
    </ui-combobox>
  `;
}
