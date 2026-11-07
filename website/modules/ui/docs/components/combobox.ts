import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Combobox docs page, ported from shadcn's
 * content/docs/components/radix/combobox.mdx (#1666, D15): the same sections
 * in the same order, the prose rewritten where it describes React or Base UI.
 */
export const demo = 'combobox-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import '#components/ui/combobox.ts';`, { lineNumbers: true })}
    ${codeFigure(`const frameworks = ['Next.js', 'SvelteKit', 'Nuxt.js', 'Remix', 'Astro'];

export function exampleCombobox() {
  return html\`
    <ui-combobox name="framework">
      <ui-combobox-input placeholder="Select a framework" aria-label="Framework"></ui-combobox-input>
      <ui-combobox-content>
        <ui-combobox-empty>No items found.</ui-combobox-empty>
        <ui-combobox-list>
          \${frameworks.map((item) => html\`<ui-combobox-item value=\${item}>\${item}</ui-combobox-item>\`)}
        </ui-combobox-list>
      </ui-combobox-content>
    </ui-combobox>
  \`;
}`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}

    ${heading(toc, 3, 'Simple')}
    <p>A single-line input and a flat list (see <a href="#basic">Basic</a>).</p>
    ${codeFigure(`ui-combobox
├── ui-combobox-input
└── ui-combobox-content
    ├── ui-combobox-empty
    └── ui-combobox-list
        ├── ui-combobox-item
        └── ui-combobox-item`, { lang: 'text' })}

    ${heading(toc, 3, 'With chips')}
    <p>Multi-select with <code>multiple</code>, chips, and a chips input (see <a href="#multiple">Multiple</a>). The chips are drawn from the chosen values, so the markup holds only the chips input.</p>
    ${codeFigure(`ui-combobox multiple
├── ui-combobox-chips
│   └── ui-combobox-chips-input
└── ui-combobox-content
    ├── ui-combobox-empty
    └── ui-combobox-list
        ├── ui-combobox-item
        └── ui-combobox-item`, { lang: 'text' })}

    ${heading(toc, 3, 'With groups and collection')}
    <p>Items nested in each <code>&lt;ui-combobox-group&gt;</code>, with a separator between groups (see <a href="#groups">Groups</a>). There is no collection part: the items go straight into the group, after its label.</p>
    ${codeFigure(`ui-combobox
├── ui-combobox-input
└── ui-combobox-content
    ├── ui-combobox-empty
    └── ui-combobox-list
        ├── ui-combobox-group
        │   ├── ui-combobox-label
        │   ├── ui-combobox-item
        │   ├── ui-combobox-item
        │   └── ui-combobox-separator
        └── ui-combobox-group
            ├── ui-combobox-label
            ├── ui-combobox-item
            └── ui-combobox-item`, { lang: 'text' })}

    ${heading(toc, 2, 'Custom Items')}
    <p>When your items are objects, render one <code>&lt;ui-combobox-item&gt;</code> per object, with the object's id as its <code>value</code> and its label as its text. The list filters on the text, and the form submits the value.</p>
    ${codeFigure(`type Framework = {
  label: string;
  value: string;
};

const frameworks: Framework[] = [
  { label: 'Next.js', value: 'next' },
  { label: 'SvelteKit', value: 'sveltekit' },
  { label: 'Nuxt', value: 'nuxt' },
];

export function exampleComboboxCustomItems() {
  return html\`
    <ui-combobox name="framework">
      <ui-combobox-input placeholder="Select a framework" aria-label="Framework"></ui-combobox-input>
      <ui-combobox-content>
        <ui-combobox-empty>No items found.</ui-combobox-empty>
        <ui-combobox-list>
          \${frameworks.map((framework) => html\`
            <ui-combobox-item value=\${framework.value}>\${framework.label}</ui-combobox-item>
          \`)}
        </ui-combobox-list>
      </ui-combobox-content>
    </ui-combobox>
  \`;
}`, { lineNumbers: true })}

    ${heading(toc, 2, 'Multiple Selection')}
    <p>Use <code>multiple</code> with chips for multi-select behavior. <code>value</code> holds the initial choice as a comma separated list, every choice is submitted as its own <code>name</code> entry, and <code>ui-value-change</code> reports the array as it changes.</p>
    ${codeFigure(`const frameworks = ['Next.js', 'SvelteKit', 'Nuxt.js', 'Remix', 'Astro'];

export function exampleComboboxMultiple() {
  return html\`
    <ui-combobox name="frameworks" multiple @ui-value-change=\${(e: CustomEvent<{ value: string[] }>) => console.log(e.detail.value)}>
      <ui-combobox-chips>
        <ui-combobox-chips-input placeholder="Add framework" aria-label="Frameworks"></ui-combobox-chips-input>
      </ui-combobox-chips>
      <ui-combobox-content>
        <ui-combobox-empty>No items found.</ui-combobox-empty>
        <ui-combobox-list>
          \${frameworks.map((item) => html\`<ui-combobox-item value=\${item}>\${item}</ui-combobox-item>\`)}
        </ui-combobox-list>
      </ui-combobox-content>
    </ui-combobox>
  \`;
}`, { lineNumbers: true })}

    ${heading(toc, 2, 'Basic')}
    <p>A simple combobox with a list of frameworks.</p>
    ${await componentPreview('combobox-basic')}

    ${heading(toc, 2, 'Multiple')}
    <p>A combobox with multiple selection using <code>multiple</code> and <code>&lt;ui-combobox-chips&gt;</code>.</p>
    ${await componentPreview('combobox-multiple')}

    ${heading(toc, 2, 'Clear Button')}
    <p>Use the <code>show-clear</code> attribute to show a clear button.</p>
    ${await componentPreview('combobox-clear')}

    ${heading(toc, 2, 'Groups')}
    <p>Use <code>&lt;ui-combobox-group&gt;</code> and <code>&lt;ui-combobox-separator&gt;</code> to group items.</p>
    ${await componentPreview('combobox-groups')}

    ${heading(toc, 2, 'Custom Items', 'custom-items-demo')}
    <p>You can render custom markup inside <code>&lt;ui-combobox-item&gt;</code>. The item's whole text is what the list filters on.</p>
    ${await componentPreview('combobox-custom')}

    ${heading(toc, 2, 'Invalid')}
    <p>The input part renders its own input and does not pass <code>aria-invalid</code> on to it yet, so mark the invalid state on the field around the combobox, with <code>data-invalid</code> and an error message.</p>
    ${await componentPreview('combobox-invalid')}

    ${heading(toc, 2, 'Disabled')}
    <p>Use the <code>disabled</code> attribute on <code>&lt;ui-combobox&gt;</code> to disable the combobox.</p>
    ${await componentPreview('combobox-disabled')}

    ${heading(toc, 2, 'Auto Highlight')}
    <p>The combobox always highlights the first match as you type, so Enter picks it. This is Base UI's <code>autoHighlight</code> behavior, and there is no attribute to set.</p>
    ${await componentPreview('combobox-auto-highlight')}

    ${heading(toc, 2, 'Popup')}
    <p>The combobox opens from its own input, and does not take a button trigger. To open a searchable list from a button, put a <a href="/ui/docs/components/command">Command</a> in a <a href="/ui/docs/components/popover">Popover</a>, with the search field inside the popup, and listen for <code>ui-select</code> to show the choice on the button.</p>
    ${await componentPreview('combobox-popup')}

    ${heading(toc, 2, 'Input Group')}
    <p>The input part renders its own <a href="/ui/docs/components/input-group">Input Group</a>, with the trigger as its addon, and does not take an addon of its own yet.</p>
    ${await componentPreview('combobox-input-group')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('combobox-rtl', { direction: 'rtl', align: 'start' })}

    ${heading(toc, 2, 'API Reference')}
    <p>The combobox follows Base UI's Combobox: typing filters the list, the arrow keys highlight while focus stays in the input, and Enter picks. The choice lives in a real form control, one <code>&lt;input type="hidden" name&gt;</code> per chosen value, served by the server, so the form submits it with or without JavaScript.</p>

    ${heading(toc, 3, 'Elements')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Element</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>&lt;ui-combobox&gt;</code></td><td>The root. Holds the value, the open state and the hidden form inputs.</td></tr>
          <tr><td><code>&lt;ui-combobox-input&gt;</code></td><td>The text field, a <code>role="combobox"</code> input in an input group with the trigger button and the optional clear button.</td></tr>
          <tr><td><code>&lt;ui-combobox-content&gt;</code></td><td>The popup, placed against the input, or against the chips box with <code>multiple</code>.</td></tr>
          <tr><td><code>&lt;ui-combobox-list&gt;</code></td><td>The <code>role="listbox"</code> holding the items.</td></tr>
          <tr><td><code>&lt;ui-combobox-item&gt;</code></td><td>One choice, a <code>role="option"</code> with a check mark when chosen.</td></tr>
          <tr><td><code>&lt;ui-combobox-empty&gt;</code></td><td>Shown when nothing matches the typed text.</td></tr>
          <tr><td><code>&lt;ui-combobox-group&gt;</code></td><td>A <code>role="group"</code> of items, named by its label, hidden when none of its items match.</td></tr>
          <tr><td><code>&lt;ui-combobox-label&gt;</code></td><td>A group heading.</td></tr>
          <tr><td><code>&lt;ui-combobox-separator&gt;</code></td><td>A divider between groups.</td></tr>
          <tr><td><code>&lt;ui-combobox-chips&gt;</code></td><td>The chips box for <code>multiple</code>. Draws one chip per chosen value, each with a remove button that names its value.</td></tr>
          <tr><td><code>&lt;ui-combobox-chips-input&gt;</code></td><td>The text field inside the chips box.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-combobox')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>name</code></td><td><code>string</code></td><td>-</td></tr>
          <tr><td><code>value</code></td><td><code>string</code>, comma separated with <code>multiple</code></td><td>-</td></tr>
          <tr><td><code>multiple</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>open</code></td><td><code>boolean</code>, reflected</td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>From code, <code>show()</code> and <code>hide()</code> open and close the list, <code>choose(value)</code> picks an item, <code>removeValue(value)</code> drops one choice, and <code>clear()</code> drops them all.</p>

    ${heading(toc, 3, 'ui-combobox-input')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>placeholder</code></td><td><code>string</code></td><td>-</td></tr>
          <tr><td><code>input-id</code></td><td><code>string</code>, the id a <code>&lt;label for&gt;</code> points at</td><td>-</td></tr>
          <tr><td><code>aria-label</code></td><td><code>string</code>, passed to the input</td><td>-</td></tr>
          <tr><td><code>show-trigger</code></td><td><code>"true" | "false"</code></td><td><code>"true"</code></td></tr>
          <tr><td><code>show-clear</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    <p><code>&lt;ui-combobox-chips-input&gt;</code> takes the same <code>placeholder</code>, <code>input-id</code> and <code>aria-label</code>.</p>

    ${heading(toc, 3, 'ui-combobox-content')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>side</code></td><td><code>"top" | "right" | "bottom" | "left"</code></td><td><code>"bottom"</code></td></tr>
          <tr><td><code>align</code></td><td><code>"start" | "center" | "end"</code></td><td><code>"start"</code></td></tr>
          <tr><td><code>side-offset</code></td><td><code>number</code></td><td><code>6</code></td></tr>
          <tr><td><code>align-offset</code></td><td><code>number</code></td><td><code>0</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-combobox-item')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>value</code></td><td><code>string</code></td><td>The item's text</td></tr>
          <tr><td><code>disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'Events')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Event</th><th>Detail</th><th>Fires</th></tr></thead>
        <tbody>
          <tr><td><code>ui-value-change</code></td><td><code>{ value: string }</code>, or <code>{ value: string[] }</code> with <code>multiple</code></td><td>When the choice changes.</td></tr>
          <tr><td><code>ui-open-change</code></td><td><code>{ open: boolean }</code></td><td>When the list opens or closes.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'Keyboard')}
    <p>ArrowDown and ArrowUp open the list and move the highlight, Enter picks the highlighted item, Escape closes, and Tab closes and moves on. With <code>multiple</code>, picking toggles an item and keeps the list open, and Backspace in an empty input removes the last chip. Leaving a single combobox puts the chosen item's label back in the input.</p>
  `;
}
