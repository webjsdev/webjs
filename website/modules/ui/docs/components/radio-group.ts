import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Radio Group docs page, ported from shadcn's
 * content/docs/components/radix/radio-group.mdx (#1666, D15): the same
 * sections in the same order, the prose rewritten where it describes React.
 */
export const demo = 'radio-group-demo';

const TABLE = 'typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { labelClass } from '#components/ui/label.ts';
import { radioGroupClass, radioClass } from '#components/ui/radio-group.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div role="radiogroup" aria-label="Options" class=\${radioGroupClass()}>
  <div class="flex items-center gap-3">
    <input type="radio" data-slot="radio" name="option" value="option-one" id="option-one" checked class=\${radioClass()}>
    <label for="option-one" class=\${labelClass()}>Option One</label>
  </div>
  <div class="flex items-center gap-3">
    <input type="radio" data-slot="radio" name="option" value="option-two" id="option-two" class=\${radioClass()}>
    <label for="option-two" class=\${labelClass()}>Option Two</label>
  </div>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a radio group:</p>
    ${codeFigure(`radioGroupClass(), on a div with role="radiogroup"
├── radioClass(), on an input with type="radio"
└── radioClass(), on an input with type="radio"`, { lang: 'text' })}
    <p>The items are native radio inputs sharing one <code>name</code>, so the browser supplies single selection, arrow key navigation, a single tab stop and form submission, with no script. Keep <code>data-slot="radio"</code> on each input: it draws the dot of a checked radio.</p>

    ${heading(toc, 2, 'Description')}
    <p>Radio group items with a description using the <a href="/ui/docs/components/field">Field</a> helpers.</p>
    ${await componentPreview('radio-group-description')}

    ${heading(toc, 2, 'Choice Card')}
    <p>Use a <code>fieldLabelClass()</code> label to wrap the entire field for a clickable card-style selection.</p>
    ${await componentPreview('radio-group-choice-card')}

    ${heading(toc, 2, 'Fieldset')}
    <p>Use <code>fieldSetClass()</code> on a <code>&lt;fieldset&gt;</code> and <code>fieldLegendClass()</code> on its <code>&lt;legend&gt;</code> to group radio items with a label and description.</p>
    ${await componentPreview('radio-group-fieldset')}

    ${heading(toc, 2, 'Disabled')}
    <p>Use the <code>disabled</code> attribute on a radio input to disable that item, and <code>data-disabled="true"</code> on its field to fade the label.</p>
    ${await componentPreview('radio-group-disabled')}

    ${heading(toc, 2, 'Invalid')}
    <p>Use <code>aria-invalid</code> on the radio inputs and <code>data-invalid</code> on the field to show validation errors.</p>
    ${await componentPreview('radio-group-invalid')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('radio-group-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    <p>shadcn's radio group wraps Radix UI. The kit's is two class helpers over native radio inputs, so the state is the inputs' own: <code>checked</code> sets the default value, the shared <code>name</code> groups them, and a <code>change</code> event reports a new selection.</p>

    ${heading(toc, 3, 'radioGroupClass')}
    <p>The classes for the group container, a <code>&lt;div role="radiogroup"&gt;</code>. Name the group with <code>aria-label</code> or <code>aria-labelledby</code>, or use a <code>&lt;fieldset&gt;</code> with a <code>&lt;legend&gt;</code> instead.</p>
    <div class=${TABLE}>
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>orientation</code></td><td><code>"vertical" | "horizontal"</code></td><td><code>"vertical"</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'radioClass')}
    <p>The classes for one native <code>&lt;input type="radio"&gt;</code>. It takes no options; the input's own attributes carry the state.</p>
    <div class=${TABLE}>
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>name</code></td><td><code>string</code></td><td></td></tr>
          <tr><td><code>value</code></td><td><code>string</code></td><td></td></tr>
          <tr><td><code>checked</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>required</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>data-slot</code></td><td><code>"radio"</code></td><td>Required</td></tr>
        </tbody>
      </table>
    </div>
  `;
}
