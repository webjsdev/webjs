import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Select docs page, ported from shadcn's
 * content/docs/components/radix/select.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'select-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { selectTriggerClass } from '#components/ui/select.ts';
import { cn } from '#lib/utils/cn.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-select placeholder="Theme">
  <select name="theme" aria-label="Theme" class=\${cn(selectTriggerClass(), 'w-[180px]')}>
    <option value="" disabled selected hidden>Theme</option>
    <option value="light">Light</option>
    <option value="dark">Dark</option>
    <option value="system">System</option>
  </select>
</ui-select>`, { lineNumbers: true })}
    <p><code>&lt;ui-select&gt;</code> enhances the native <code>&lt;select&gt;</code> inside it. Without JavaScript the native select is what the page shows and what the form submits. With JavaScript the element hides it visually and draws the styled trigger and list in its place, writing every choice back into it.</p>

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a select. The options stay native elements, because the HTML parser drops a custom element inside a <code>&lt;select&gt;</code>:</p>
    ${codeFigure(`ui-select
└── select (selectTriggerClass)
    ├── option (placeholder, value="" hidden)
    ├── optgroup (label)
    │   ├── option
    │   └── option
    ├── hr
    └── optgroup (label)
        ├── option
        └── option`, { lang: 'text' })}

    ${heading(toc, 2, 'Align Item With Trigger')}
    <p>Use the <code>position</code> attribute on <code>&lt;ui-select&gt;</code> to control alignment. When <code>position="item-aligned"</code> (default), the list positions so the selected item appears over the trigger. When <code>position="popper"</code>, the list aligns to the trigger edge.</p>
    ${await componentPreview('select-align-item')}

    ${heading(toc, 2, 'Groups')}
    <p>Use <code>&lt;optgroup label&gt;</code> and an <code>&lt;hr&gt;</code> between options to organize items. The label becomes the group's heading.</p>
    ${await componentPreview('select-groups')}

    ${heading(toc, 2, 'Scrollable')}
    <p>A select with many items that scrolls.</p>
    ${await componentPreview('select-scrollable')}

    ${heading(toc, 2, 'Disabled')}
    ${await componentPreview('select-disabled')}

    ${heading(toc, 2, 'Invalid')}
    <p>Add the <code>data-invalid</code> attribute to the field and the <code>aria-invalid</code> attribute to the native <code>&lt;select&gt;</code> to show an error state. The drawn trigger carries the select's <code>aria-invalid</code>.</p>
    ${codeFigure(`<div data-slot="field" data-invalid="true" class=\${fieldClass()}>
  <label for="fruit" class=\${fieldLabelClass()}>Fruit</label>
  <ui-select>
    <select id="fruit" aria-invalid="true" class=\${selectTriggerClass()}>
      ...
    </select>
  </ui-select>
</div>`, { lineNumbers: true })}
    ${await componentPreview('select-invalid')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('select-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'ui-select')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>placeholder</code></td><td><code>string</code></td><td>the placeholder option's text</td></tr>
          <tr><td><code>size</code></td><td><code>"default" | "sm"</code></td><td><code>"default"</code></td></tr>
          <tr><td><code>position</code></td><td><code>"item-aligned" | "popper"</code></td><td><code>"item-aligned"</code></td></tr>
          <tr><td><code>open</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Event</th><th>Detail</th><th>Fired when</th></tr></thead>
        <tbody>
          <tr><td><code>ui-value-change</code></td><td><code>{ value: string }</code></td><td>The selected value changes.</td></tr>
        </tbody>
      </table>
    </div>
    <p>The native select also fires <code>input</code> and <code>change</code>. The value, <code>disabled</code>, <code>required</code> and each option's <code>disabled</code> are the native select's own attributes. A placeholder option is one with <code>value=""</code> that is <code>hidden</code> or <code>disabled</code>.</p>
    <p>The trigger is a <code>role="combobox"</code> button named by the select's <code>&lt;label&gt;</code> or <code>aria-label</code>, and the list a <code>role="listbox"</code>. From the keyboard, the arrows, Enter or Space open the list, typing jumps to a matching option, and Escape closes it without a change.</p>
    ${heading(toc, 3, 'selectTriggerClass')}
    <p>Put <code>selectTriggerClass()</code> on the native select. The drawn trigger takes the classes written there, so <code>cn(selectTriggerClass(), 'w-full')</code> gives a full-width trigger with JavaScript on and off alike.</p>
  `;
}
