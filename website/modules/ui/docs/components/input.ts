import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Input docs page body, ported from shadcn's
 * content/docs/components/radix/input.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'input-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  const narrow = { previewClass: '*:max-w-xs' };
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { inputClass } from '#components/ui/input.ts';`)}
    ${codeFigure(`<input data-slot="input" class=\${inputClass()}>`)}

    ${heading(toc, 2, 'Basic')}
    ${await componentPreview('input-basic', narrow)}

    ${heading(toc, 2, 'Field')}
    <p>Use <code>fieldClass()</code>, <code>fieldLabelClass()</code>, and <code>fieldDescriptionClass()</code> to create an input with a label and description.</p>
    ${await componentPreview('input-field', narrow)}

    ${heading(toc, 2, 'Field Group')}
    <p>Use <code>fieldGroupClass()</code> to show multiple fields and to build forms.</p>
    ${await componentPreview('input-fieldgroup', narrow)}

    ${heading(toc, 2, 'Disabled')}
    <p>Use the <code>disabled</code> attribute to disable the input. To style the disabled state, add <code>data-disabled="true"</code> to the field.</p>
    ${await componentPreview('input-disabled', narrow)}

    ${heading(toc, 2, 'Invalid')}
    <p>Use the <code>aria-invalid="true"</code> attribute to mark the input as invalid. To style the invalid state, add <code>data-invalid="true"</code> to the field.</p>
    ${await componentPreview('input-invalid', narrow)}

    ${heading(toc, 2, 'File')}
    <p>Use the <code>type="file"</code> attribute to create a file input.</p>
    ${await componentPreview('input-file', narrow)}

    ${heading(toc, 2, 'Inline')}
    <p>Use <code>fieldClass({ orientation: 'horizontal' })</code> to create an inline input. Pair with a button to create a search input with a button.</p>
    ${await componentPreview('input-inline', narrow)}

    ${heading(toc, 2, 'Grid')}
    <p>Use a grid layout to place multiple inputs side by side.</p>
    ${await componentPreview('input-grid', { previewClass: 'p-6' })}

    ${heading(toc, 2, 'Required')}
    <p>Use the <code>required</code> attribute to indicate required inputs.</p>
    ${await componentPreview('input-required', narrow)}

    ${heading(toc, 2, 'Badge')}
    <p>Use a <code>badgeClass()</code> element in the label to highlight a recommended field.</p>
    ${await componentPreview('input-badge', narrow)}

    ${heading(toc, 2, 'Input Group')}
    <p>To add icons, text, or buttons inside an input, use the Input Group helpers. See the <a href="/ui/docs/components/input-group">Input Group</a> component for more examples.</p>
    ${await componentPreview('input-input-group', narrow)}

    ${heading(toc, 2, 'Button Group')}
    <p>To add buttons to an input, use the <code>buttonGroupClass()</code> helper. See the <a href="/ui/docs/components/button-group">Button Group</a> component for more examples.</p>
    ${await componentPreview('input-button-group', narrow)}

    ${heading(toc, 2, 'Form')}
    <p>A full form example with multiple inputs, a select, and a button.</p>
    ${await componentPreview('input-form', { previewClass: 'h-[32rem]' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('input-rtl', { direction: 'rtl', ...narrow })}
  `;
}
