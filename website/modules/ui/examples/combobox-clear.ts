import { html } from '@webjsdev/core';

const frameworks = ['Next.js', 'SvelteKit', 'Nuxt.js', 'Remix', 'Astro'];

export default function ComboboxWithClear() {
  return html`
    <ui-combobox value=${frameworks[0]}>
      <ui-combobox-input placeholder="Select a framework" aria-label="Framework" show-clear></ui-combobox-input>
      <ui-combobox-content>
        <ui-combobox-empty>No items found.</ui-combobox-empty>
        <ui-combobox-list>
          ${frameworks.map((item) => html`<ui-combobox-item value=${item}>${item}</ui-combobox-item>`)}
        </ui-combobox-list>
      </ui-combobox-content>
    </ui-combobox>
  `;
}
