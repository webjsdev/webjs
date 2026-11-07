import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Checkbox docs page body, ported from shadcn's
 * content/docs/components/radix/checkbox.mdx (#1666, D15): the same sections
 * in the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'checkbox-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { checkboxClass } from '#components/ui/checkbox.ts';`)}
    ${codeFigure(`<input type="checkbox" data-slot="checkbox" class=\${checkboxClass()}>`)}

    ${heading(toc, 2, 'Checked State')}
    <p>The checkbox is a native <code>&lt;input type="checkbox"&gt;</code>, so it keeps its own state. Use the <code>checked</code> attribute for the initial state, and read or set the <code>checked</code> property, listening for the <code>change</code> event, to follow it.</p>
    ${codeFigure(`<input
  type="checkbox"
  data-slot="checkbox"
  checked
  class=\${checkboxClass()}
  @change=\${(e: Event) => this.onCheckedChange((e.target as HTMLInputElement).checked)}
>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Invalid State')}
    <p>Set <code>aria-invalid</code> on the checkbox and <code>data-invalid</code> on the field wrapper to show the invalid styles.</p>
    ${await componentPreview('checkbox-invalid')}

    ${heading(toc, 2, 'Basic')}
    <p>Pair the checkbox with <code>fieldClass()</code> and <code>fieldLabelClass()</code> for proper layout and labeling.</p>
    ${await componentPreview('checkbox-basic')}

    ${heading(toc, 2, 'Description')}
    <p>Use <code>fieldContentClass()</code> and <code>fieldDescriptionClass()</code> for helper text.</p>
    ${await componentPreview('checkbox-description')}

    ${heading(toc, 2, 'Disabled')}
    <p>Use the <code>disabled</code> attribute to prevent interaction and add the <code>data-disabled</code> attribute to the field for disabled styles.</p>
    ${await componentPreview('checkbox-disabled')}

    ${heading(toc, 2, 'Group')}
    <p>Use multiple fields to create a checkbox list.</p>
    ${await componentPreview('checkbox-group')}

    ${heading(toc, 2, 'Table')}
    ${await componentPreview('checkbox-table', { previewClass: 'p-4 md:p-8' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('checkbox-rtl', { direction: 'rtl', previewClass: 'h-80' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'checkboxClass')}
    <p><code>checkboxClass()</code> returns the classes for a native <code>&lt;input type="checkbox"&gt;</code> and takes no options. The checkbox is a real form control, so it submits with its <code>&lt;form&gt;</code> and supports every native attribute.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>data-slot</code></td><td><code>"checkbox"</code></td><td>required</td></tr>
          <tr><td><code>checked</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>required</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>name</code></td><td><code>string</code></td><td>-</td></tr>
          <tr><td><code>value</code></td><td><code>string</code></td><td><code>"on"</code></td></tr>
          <tr><td><code>aria-invalid</code></td><td><code>"true"</code></td><td>-</td></tr>
        </tbody>
      </table>
    </div>
    <p><code>data-slot="checkbox"</code> is required: the checkmark is drawn by a stylesheet keyed on it. The indeterminate state is the <code>indeterminate</code> property (<code>el.indeterminate = true</code>), not an attribute.</p>
  `;
}
