import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * The Label docs page body, ported from shadcn's
 * content/docs/components/radix/label.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'label-demo';

/** The Callout shadcn places before Installation. */
export async function intro(_toc: TocEntry[]) {
  return callout(html`For form fields, use the <a href="/ui/docs/components/field">Field</a> component which includes built-in label, description, and error handling.`);
}

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { labelClass } from '#components/ui/label.ts';`)}
    ${codeFigure(`<label class=\${labelClass()} for="email">Your email address</label>`)}

    ${heading(toc, 2, 'Label in Field')}
    <p>For form fields, use the <a href="/ui/docs/components/field">Field</a> component which includes built-in <code>fieldLabelClass()</code>, <code>fieldDescriptionClass()</code>, and <code>fieldErrorClass()</code> helpers.</p>
    ${codeFigure(`<div role="group" data-slot="field" class=\${fieldClass()}>
  <label data-slot="field-label" for="email" class=\${fieldLabelClass()}>Your email address</label>
  <input data-slot="input" id="email" class=\${inputClass()}>
</div>`)}
    ${await componentPreview('field-demo', { previewClass: 'h-[44rem]' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('label-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'labelClass')}
    <p><code>labelClass()</code> returns the classes for a native <code>&lt;label&gt;</code> and takes no options. Link the label to its control with <code>for</code> pointing at the control's <code>id</code>, or nest the control inside the label. That link supplies the control's accessible name and makes clicking the text focus the control, with no script.</p>
    <p>The label dims on its own inside a container marked <code>data-disabled="true"</code>, or next to a disabled <code>peer</code> control. The dimming is visual only, so disable the control itself.</p>
  `;
}
