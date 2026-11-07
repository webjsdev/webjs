import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Textarea docs page, ported from shadcn's
 * content/docs/components/radix/textarea.mdx (#1666, D15): the same sections
 * in the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'textarea-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { textareaClass } from '#components/ui/textarea.ts';`)}
    ${codeFigure(`<textarea class=\${textareaClass()}></textarea>`)}

    ${heading(toc, 2, 'Field')}
    <p>Use <code>fieldClass()</code>, <code>fieldLabelClass()</code>, and <code>fieldDescriptionClass()</code> to create a textarea with a label and description.</p>
    ${await componentPreview('textarea-field', { previewClass: '*:max-w-xs' })}

    ${heading(toc, 2, 'Disabled')}
    <p>Use the <code>disabled</code> attribute to disable the textarea. To style the disabled state, add the <code>data-disabled</code> attribute to the field.</p>
    ${await componentPreview('textarea-disabled', { previewClass: '*:max-w-xs' })}

    ${heading(toc, 2, 'Invalid')}
    <p>Use the <code>aria-invalid</code> attribute to mark the textarea as invalid. To style the invalid state, add the <code>data-invalid</code> attribute to the field.</p>
    ${await componentPreview('textarea-invalid', { previewClass: '*:max-w-xs' })}

    ${heading(toc, 2, 'Button')}
    <p>Pair with <code>buttonClass()</code> to create a textarea with a submit button.</p>
    ${await componentPreview('textarea-button', { previewClass: '*:max-w-xs' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('textarea-rtl', { direction: 'rtl' })}
  `;
}
