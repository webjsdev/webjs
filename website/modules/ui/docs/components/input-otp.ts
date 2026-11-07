import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Input OTP docs page body, ported from shadcn's
 * content/docs/components/radix/input-otp.mdx (#1666, D15): the same
 * sections in the same order, the prose rewritten where it describes React
 * and the input-otp library the kit does not use.
 */
/** The demo shown above the Installation section. */
export const demo = 'input-otp-demo';

/** The About section, which shadcn places before Installation. */
export async function intro(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'About')}
    <p>Input OTP is built on one real <code>&lt;input&gt;</code> that you author. Without JavaScript it is an ordinary text field the form submits. With JavaScript the element lays that same input, transparent, over the slots and draws each character in its box, so typing, pasting, SMS autofill and the mobile keyboard all still go to the real input. It uses no library.</p>
  `;
}

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { inputClass } from '#components/ui/input.ts';
import '#components/ui/input-otp.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-input-otp>
  <input id="otp" name="otp" aria-label="One-time code" class=\${inputClass()} maxlength="6" inputmode="numeric" autocomplete="one-time-code">
  <ui-input-otp-group>
    <ui-input-otp-slot index="0"></ui-input-otp-slot>
    <ui-input-otp-slot index="1"></ui-input-otp-slot>
    <ui-input-otp-slot index="2"></ui-input-otp-slot>
  </ui-input-otp-group>
  <ui-input-otp-separator></ui-input-otp-separator>
  <ui-input-otp-group>
    <ui-input-otp-slot index="3"></ui-input-otp-slot>
    <ui-input-otp-slot index="4"></ui-input-otp-slot>
    <ui-input-otp-slot index="5"></ui-input-otp-slot>
  </ui-input-otp-group>
</ui-input-otp>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build an input OTP:</p>
    ${codeFigure(`<ui-input-otp>
├── <input>
├── <ui-input-otp-group>
│   ├── <ui-input-otp-slot>
│   ├── <ui-input-otp-slot>
│   └── <ui-input-otp-slot>
├── <ui-input-otp-separator>
├── <ui-input-otp-group>
│   ├── <ui-input-otp-slot>
│   ├── <ui-input-otp-slot>
│   └── <ui-input-otp-slot>
├── <ui-input-otp-separator>
└── <ui-input-otp-group>
    ├── <ui-input-otp-slot>
    └── <ui-input-otp-slot>`, { lang: 'text' })}

    ${heading(toc, 2, 'Pattern')}
    <p>Use the input's own <code>pattern</code> attribute to define a custom pattern for the OTP input. A keystroke that would make the value stop matching it is refused.</p>
    ${codeFigure(`<ui-input-otp>
  <input class=\${inputClass()} maxlength="6" pattern="[a-zA-Z0-9]*" autocomplete="one-time-code">
  ...
</ui-input-otp>`, { lineNumbers: true })}
    ${await componentPreview('input-otp-pattern')}

    ${heading(toc, 2, 'Separator')}
    <p>Use the <code>&lt;ui-input-otp-separator&gt;</code> element to add a separator between input groups.</p>
    ${await componentPreview('input-otp-separator')}

    ${heading(toc, 2, 'Disabled')}
    <p>Use the <code>disabled</code> attribute on the input to disable it.</p>
    ${await componentPreview('input-otp-disabled')}

    ${heading(toc, 2, 'Controlled')}
    <p>The input holds the value, so set its <code>value</code> attribute for the starting code and read <code>input.value</code> (or the element's <code>value</code>) for the current one. The element fires <code>ui-value-change</code> with <code>{ detail: { value } }</code> on every change, and the input fires its native <code>input</code> event.</p>
    ${await componentPreview('input-otp-controlled')}

    ${heading(toc, 2, 'Invalid')}
    <p>Use <code>aria-invalid="true"</code> on the input to show an error state. The element passes it on to every slot.</p>
    ${await componentPreview('input-otp-invalid')}

    ${heading(toc, 2, 'Four Digits')}
    <p>A common pattern for PIN codes. This uses <code>maxlength="4"</code> with a digits-only <code>pattern="[0-9]*"</code>.</p>
    ${await componentPreview('input-otp-four-digits')}

    ${heading(toc, 2, 'Alphanumeric')}
    <p>Use <code>pattern="[a-zA-Z0-9]*"</code> to accept both letters and numbers.</p>
    ${await componentPreview('input-otp-alphanumeric')}

    ${heading(toc, 2, 'Form')}
    ${await componentPreview('input-otp-form', { previewClass: 'h-[30rem]' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('input-otp-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    <p>The kit does not use the <a href="https://input-otp.rodz.dev">input-otp</a> library. <code>&lt;ui-input-otp&gt;</code> enhances one real <code>&lt;input&gt;</code> that you author: without JavaScript the page shows an ordinary text field the form submits. With JavaScript the element lays that same input, transparent, over the slots, so typing, pasting, SMS autofill and the mobile keyboard all still go to the real input.</p>

    ${heading(toc, 3, 'ui-input-otp')}
    <p>The root. It wraps the input and the groups, and is configured through the input's own attributes.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Input attribute</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><code>maxlength</code></td><td>How many characters the code has. Without it, the number of slots.</td></tr>
          <tr><td><code>pattern</code></td><td>A keystroke that would make the value stop matching is refused.</td></tr>
          <tr><td><code>value</code></td><td>The starting code.</td></tr>
          <tr><td><code>disabled</code></td><td>Disables the input and dims the slots.</td></tr>
          <tr><td><code>aria-invalid</code></td><td><code>"true"</code> shows the error state on every slot.</td></tr>
          <tr><td><code>autocomplete="one-time-code"</code></td><td>Lets the browser fill the code from an SMS.</td></tr>
          <tr><td><code>inputmode="numeric"</code></td><td>Shows the number pad on phones for a numeric code.</td></tr>
        </tbody>
      </table>
    </div>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Event</th><th>Detail</th><th>When</th></tr></thead>
        <tbody>
          <tr><td><code>ui-value-change</code></td><td><code>{ value: string }</code></td><td>The code changed.</td></tr>
          <tr><td><code>ui-complete</code></td><td><code>{ value: string }</code></td><td>Every slot is filled.</td></tr>
        </tbody>
      </table>
    </div>
    <p>The element also exposes <code>value</code>, <code>maxLength</code> and <code>input</code> (the enhanced input) as properties.</p>

    ${heading(toc, 3, 'ui-input-otp-group')}
    <p>Groups slots into one joined row. A class written on it stays on the host.</p>

    ${heading(toc, 3, 'ui-input-otp-slot')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>index</code></td><td><code>number</code></td><td><code>0</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>Draws the character at <code>index</code> and the blinking caret. The slot styles its own host, so a class written on it is kept, and it carries <code>data-slot="input-otp-slot"</code> and <code>data-active</code>.</p>

    ${heading(toc, 3, 'ui-input-otp-separator')}
    <p>A dash between groups. It takes no attributes.</p>

    <p>The slots, groups and separator are decoration hidden from assistive technology. The real input is what a screen reader meets, so give it a <code>&lt;label for&gt;</code> or an <code>aria-label</code>.</p>
  `;
}
