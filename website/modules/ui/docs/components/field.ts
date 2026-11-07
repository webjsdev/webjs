import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Field docs page body, ported from shadcn's
 * content/docs/components/radix/field.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'field-demo';

const table = (rows: unknown) => html`
  <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
    <table>
      <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  fieldClass,
  fieldContentClass,
  fieldDescriptionClass,
  fieldErrorClass,
  fieldGroupClass,
  fieldLabelClass,
  fieldLegendClass,
  fieldSeparatorClass,
  fieldSetClass,
  fieldTitleClass,
} from '#components/ui/field.ts';`, { lineNumbers: true })}
    ${codeFigure(`<fieldset data-slot="field-set" class=\${fieldSetClass()}>
  <legend data-slot="field-legend" data-variant="legend" class=\${fieldLegendClass()}>Profile</legend>
  <p data-slot="field-description" class=\${fieldDescriptionClass()}>This appears on invoices and emails.</p>
  <div data-slot="field-group" class=\${fieldGroupClass()}>
    <div data-slot="field" data-orientation="vertical" class=\${fieldClass()}>
      <label data-slot="field-label" for="name" class=\${fieldLabelClass()}>Full name</label>
      <input data-slot="input" id="name" autocomplete="off" placeholder="Evil Rabbit" class=\${inputClass()}>
      <p data-slot="field-description" class=\${fieldDescriptionClass()}>This appears on invoices and emails.</p>
    </div>
    <div data-slot="field" data-orientation="vertical" data-invalid="true" class=\${fieldClass()}>
      <label data-slot="field-label" for="username" class=\${fieldLabelClass()}>Username</label>
      <input data-slot="input" id="username" autocomplete="off" aria-invalid="true" aria-describedby="username-error" class=\${inputClass()}>
      <div data-slot="field-error" id="username-error" role="alert" class=\${fieldErrorClass()}>Choose another username.</div>
    </div>
    <div data-slot="field" data-orientation="horizontal" class=\${fieldClass({ orientation: 'horizontal' })}>
      <ui-switch input-id="newsletter"></ui-switch>
      <label data-slot="field-label" for="newsletter" class=\${fieldLabelClass()}>Subscribe to the newsletter</label>
    </div>
  </div>
</fieldset>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    ${heading(toc, 3, 'Field')}
    <p>A single control with label, helper text, and validation.</p>
    ${codeFigure(`fieldClass()
├── fieldLabelClass()
├── inputClass() / textareaClass() / <ui-switch> / <ui-select>
├── fieldDescriptionClass()
└── fieldErrorClass()`, { lang: 'text' })}
    ${heading(toc, 3, 'FieldGroup')}
    <p>Related fields in one group. Use <code>fieldSeparatorClass()</code> between sections when needed.</p>
    ${codeFigure(`fieldGroupClass()
├── fieldClass()
│   ├── fieldLabelClass()
│   ├── inputClass() / textareaClass() / <ui-switch> / <ui-select>
│   ├── fieldDescriptionClass()
│   └── fieldErrorClass()
├── fieldSeparatorClass()
└── fieldClass()
    ├── fieldLabelClass()
    └── inputClass() / textareaClass() / <ui-switch> / <ui-select>`, { lang: 'text' })}
    ${heading(toc, 3, 'FieldSet')}
    <p>Semantic grouping with a legend and description, usually containing a field group.</p>
    ${codeFigure(`fieldSetClass()
├── fieldLegendClass()
├── fieldDescriptionClass()
└── fieldGroupClass()
    ├── fieldClass()
    │   ├── fieldLabelClass()
    │   ├── inputClass() / textareaClass() / <ui-switch> / <ui-select>
    │   ├── fieldDescriptionClass()
    │   └── fieldErrorClass()
    └── fieldClass()
        ├── fieldLabelClass()
        └── inputClass() / textareaClass() / <ui-switch> / <ui-select>`, { lang: 'text' })}

    ${heading(toc, 2, 'Anatomy')}
    <p>The Field helpers are designed for composing accessible forms. A typical field is structured as follows:</p>
    ${codeFigure(`<div data-slot="field" data-orientation="vertical" class=\${fieldClass()}>
  <label data-slot="field-label" for="input-id" class=\${fieldLabelClass()}>Label</label>
  <!-- Input, select, switch, etc. -->
  <p data-slot="field-description" class=\${fieldDescriptionClass()}>Optional helper text.</p>
  <div data-slot="field-error" class=\${fieldErrorClass()}>Validation message.</div>
</div>`, { lineNumbers: true })}
    <ul>
      <li><code>fieldClass()</code> is the core wrapper for a single field.</li>
      <li><code>fieldContentClass()</code> is a flex column that groups label and description. Not required if you have no description.</li>
      <li>Wrap related fields with <code>fieldGroupClass()</code>, and use a <code>&lt;fieldset&gt;</code> with <code>fieldSetClass()</code> and a <code>&lt;legend&gt;</code> with <code>fieldLegendClass()</code> for semantic grouping.</li>
    </ul>

    ${heading(toc, 2, 'Form')}
    <p>See the <a href="/ui/docs/forms">Form</a> documentation for building forms with the Field helpers. In WebJs a form binds a server action with <code>&lt;form action=\${action}&gt;</code>, works with JavaScript off, and re-renders with the action's field errors on a failed submission, so no form library is needed.</p>

    ${heading(toc, 2, 'Input')}
    ${await componentPreview('field-input')}

    ${heading(toc, 2, 'Textarea')}
    ${await componentPreview('field-textarea')}

    ${heading(toc, 2, 'Select')}
    ${await componentPreview('field-select')}

    ${heading(toc, 2, 'Slider')}
    ${await componentPreview('field-slider')}

    ${heading(toc, 2, 'Fieldset')}
    ${await componentPreview('field-fieldset')}

    ${heading(toc, 2, 'Checkbox')}
    ${await componentPreview('field-checkbox', { previewClass: 'h-[32rem]' })}

    ${heading(toc, 2, 'Radio')}
    ${await componentPreview('field-radio')}

    ${heading(toc, 2, 'Switch')}
    ${await componentPreview('field-switch')}

    ${heading(toc, 2, 'Choice Card')}
    <p>Wrap a field inside a <code>&lt;label&gt;</code> with <code>fieldLabelClass()</code> to create selectable field groups. This works with radio inputs, checkboxes and <code>&lt;ui-switch&gt;</code>.</p>
    ${await componentPreview('field-choice-card')}

    ${heading(toc, 2, 'Field Group')}
    <p>Stack fields with <code>fieldGroupClass()</code>. Add a <code>fieldSeparatorClass()</code> element to divide them.</p>
    ${await componentPreview('field-group', { previewClass: 'h-96' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('field-rtl', { direction: 'rtl', previewClass: 'h-auto p-6' })}

    ${heading(toc, 2, 'Responsive Layout')}
    <ul>
      <li><strong>Vertical fields:</strong> Default orientation stacks label, control, and helper text, ideal for mobile-first layouts.</li>
      <li><strong>Horizontal fields:</strong> Pass <code>{ orientation: 'horizontal' }</code> to <code>fieldClass()</code> (with <code>data-orientation="horizontal"</code>) to align the label and control side-by-side. Pair with <code>fieldContentClass()</code> to keep descriptions aligned.</li>
      <li><strong>Responsive fields:</strong> Pass <code>{ orientation: 'responsive' }</code> for automatic column layouts inside container-aware parents. <code>fieldGroupClass()</code> already carries <code>@container/field-group</code>, so a responsive field switches orientation at the group's <code>md</code> width.</li>
    </ul>
    ${await componentPreview('field-responsive', { previewClass: 'h-[650px] p-6 md:h-[500px] md:p-10' })}

    ${heading(toc, 2, 'Validation and Errors')}
    <ul>
      <li>Add <code>data-invalid="true"</code> to the field to switch the entire block into an error state.</li>
      <li>Add <code>aria-invalid="true"</code> on the input itself for assistive technologies.</li>
      <li>Render the <code>fieldErrorClass()</code> element immediately after the control or inside the field content to keep error messages aligned with the field, and list its id in the control's <code>aria-describedby</code>.</li>
    </ul>
    ${codeFigure(`<div data-slot="field" data-orientation="vertical" data-invalid="true" class=\${fieldClass()}>
  <label data-slot="field-label" for="email" class=\${fieldLabelClass()}>Email</label>
  <input data-slot="input" id="email" type="email" aria-invalid="true" aria-describedby="email-error" class=\${inputClass()}>
  <div data-slot="field-error" id="email-error" role="alert" class=\${fieldErrorClass()}>Enter a valid email address.</div>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Accessibility')}
    <ul>
      <li>A <code>&lt;fieldset&gt;</code> and <code>&lt;legend&gt;</code> keep related controls grouped for keyboard and assistive tech users.</li>
      <li>Add <code>role="group"</code> to a field that holds more than one control, so nested controls inherit labeling from the field's label and the set's legend when combined. A single-control field needs no role.</li>
      <li>Apply <code>fieldSeparatorClass()</code> sparingly to ensure screen readers encounter clear section boundaries.</li>
    </ul>

    ${heading(toc, 2, 'API Reference')}
    <p>Each helper returns the classes for one part. Put them on the native element named below, with the <code>data-slot</code> shown, since the group and sibling rules key on it.</p>

    ${heading(toc, 3, 'fieldSetClass')}
    <p>Classes for a semantic <code>&lt;fieldset data-slot="field-set"&gt;</code> with spacing presets. Takes no options.</p>
    ${codeFigure(`<fieldset data-slot="field-set" class=\${fieldSetClass()}>
  <legend data-slot="field-legend" data-variant="legend" class=\${fieldLegendClass()}>Delivery</legend>
  <div data-slot="field-group" class=\${fieldGroupClass()}><!-- Fields --></div>
</fieldset>`)}

    ${heading(toc, 3, 'fieldLegendClass')}
    <p>Classes for the <code>&lt;legend data-slot="field-legend"&gt;</code> of a field set. Switch to the <code>label</code> variant to align with label sizing, and set the same value on <code>data-variant</code>.</p>
    ${table(html`<tr><td><code>variant</code></td><td><code>"legend" | "label"</code></td><td><code>"legend"</code></td></tr>`)}
    ${codeFigure(`<legend data-slot="field-legend" data-variant="label" class=\${fieldLegendClass({ variant: 'label' })}>Notification Preferences</legend>`)}
    <p>The legend has two variants: <code>legend</code> and <code>label</code>. The <code>label</code> variant applies label sizing and alignment. Handy if you have a nested field set.</p>

    ${heading(toc, 3, 'fieldGroupClass')}
    <p>Classes for the <code>&lt;div data-slot="field-group"&gt;</code> that stacks fields. It carries <code>@container/field-group</code>, the container that responsive fields measure. Takes no options.</p>
    ${codeFigure(`<div data-slot="field-group" class=\${fieldGroupClass()}>
  <div data-slot="field" class=\${fieldClass()}>...</div>
  <div data-slot="field" class=\${fieldClass()}>...</div>
</div>`)}

    ${heading(toc, 3, 'fieldClass')}
    <p>Classes for the core wrapper of a single field, a <code>&lt;div data-slot="field"&gt;</code>. Provides orientation control, invalid state styling, and spacing. Set <code>data-orientation</code> to the same orientation, <code>data-invalid="true"</code> for the error state, and <code>data-disabled="true"</code> to fade the label.</p>
    ${table(html`<tr><td><code>orientation</code></td><td><code>"vertical" | "horizontal" | "responsive"</code></td><td><code>"vertical"</code></td></tr>`)}
    ${codeFigure(`<div data-slot="field" data-orientation="horizontal" class=\${fieldClass({ orientation: 'horizontal' })}>
  <label data-slot="field-label" for="remember" class=\${fieldLabelClass()}>Remember me</label>
  <ui-switch input-id="remember"></ui-switch>
</div>`)}

    ${heading(toc, 3, 'fieldContentClass')}
    <p>Classes for a <code>&lt;div data-slot="field-content"&gt;</code>, the flex column that groups label and descriptions when the label sits beside the control. Not required if you have no description. Takes no options.</p>
    ${codeFigure(`<div data-slot="field" data-orientation="horizontal" class=\${fieldClass({ orientation: 'horizontal' })}>
  <input type="checkbox" data-slot="checkbox" id="notifications" class=\${checkboxClass()}>
  <div data-slot="field-content" class=\${fieldContentClass()}>
    <label data-slot="field-label" for="notifications" class=\${fieldLabelClass()}>Notifications</label>
    <p data-slot="field-description" class=\${fieldDescriptionClass()}>Email, SMS, and push options.</p>
  </div>
</div>`)}

    ${heading(toc, 3, 'fieldLabelClass')}
    <p>Classes for the <code>&lt;label data-slot="field-label"&gt;</code>, styled for both direct inputs and nested fields. Takes no options. A class helper styles any element, so there is no <code>asChild</code>.</p>
    ${codeFigure(`<label data-slot="field-label" for="email" class=\${fieldLabelClass()}>Email</label>`)}

    ${heading(toc, 3, 'fieldTitleClass')}
    <p>Classes for a title with label styling inside the field content, on an element that is not a <code>&lt;label&gt;</code> (a choice card's heading). Takes no options.</p>
    ${codeFigure(`<div data-slot="field-content" class=\${fieldContentClass()}>
  <div data-slot="field-label" class=\${fieldTitleClass()}>Enable Touch ID</div>
  <p data-slot="field-description" class=\${fieldDescriptionClass()}>Unlock your device faster.</p>
</div>`)}

    ${heading(toc, 3, 'fieldDescriptionClass')}
    <p>Classes for the helper text, a <code>&lt;p data-slot="field-description"&gt;</code>, which balances long lines in horizontal layouts. Takes no options.</p>
    ${codeFigure(`<p data-slot="field-description" class=\${fieldDescriptionClass()}>We never share your email with anyone.</p>`)}

    ${heading(toc, 3, 'fieldSeparatorClass')}
    <p>Classes for a visual divider between sections inside a field group, a <code>&lt;div data-slot="field-separator"&gt;</code> that draws its own line. Put optional inline text in a span with <code>fieldSeparatorContentClass()</code>, and set <code>data-content</code> to say whether it has any.</p>
    ${codeFigure(`<div data-slot="field-separator" data-content="true" class=\${fieldSeparatorClass()}>
  <span data-slot="field-separator-content" class=\${fieldSeparatorContentClass()}>Or continue with</span>
</div>`)}

    ${heading(toc, 3, 'fieldErrorClass')}
    <p>Classes for the inline validation message, a <code>&lt;div data-slot="field-error" role="alert"&gt;</code>. Takes no options. There is no <code>errors</code> prop: render the messages your server action returned, and for several, a list inside the same element.</p>
    ${codeFigure(`\${actionData?.fieldErrors?.username
  ? html\`<div data-slot="field-error" id="username-error" role="alert" class=\${fieldErrorClass()}>\${actionData.fieldErrors.username}</div>\`
  : ''}`)}
    <p>Give the error an id and list it in the control's <code>aria-describedby</code> only while it is rendered, so the description never points at an id that does not exist.</p>
  `;
}
