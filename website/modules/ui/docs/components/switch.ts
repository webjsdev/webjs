import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Switch docs page, ported from shadcn's
 * content/docs/components/radix/switch.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'switch-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import '#components/ui/switch.ts';`)}
    ${codeFigure(`<ui-switch aria-label="Airplane mode"></ui-switch>`)}

    ${heading(toc, 2, 'Description')}
    ${await componentPreview('switch-description')}

    ${heading(toc, 2, 'Choice Card')}
    <p>Card-style selection where the field label wraps the entire field for a clickable card pattern.</p>
    ${await componentPreview('switch-choice-card')}

    ${heading(toc, 2, 'Disabled')}
    <p>Add the <code>disabled</code> attribute to <code>&lt;ui-switch&gt;</code> to disable the switch. Add the <code>data-disabled</code> attribute to the field for styling.</p>
    ${await componentPreview('switch-disabled')}

    ${heading(toc, 2, 'Invalid')}
    <p>Add the <code>aria-invalid</code> attribute to <code>&lt;ui-switch&gt;</code> to indicate an invalid state. Add the <code>data-invalid</code> attribute to the field for styling.</p>
    ${await componentPreview('switch-invalid')}

    ${heading(toc, 2, 'Size')}
    <p>Use the <code>size</code> attribute to change the size of the switch.</p>
    ${await componentPreview('switch-sizes')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('switch-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'ui-switch')}
    <p><code>&lt;ui-switch&gt;</code> renders shadcn's switch, a root and a thumb, around a real <code>&lt;input type="checkbox" role="switch"&gt;</code>. The checkbox is rendered on the server, so the switch submits with its form, takes a <code>&lt;label for&gt;</code>, and toggles with JavaScript off.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>size</code></td><td><code>"default" | "sm"</code></td><td><code>"default"</code></td></tr>
          <tr><td><code>checked</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>required</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>name</code></td><td><code>string</code></td><td>-</td></tr>
          <tr><td><code>value</code></td><td><code>string</code></td><td>-</td></tr>
          <tr><td><code>input-id</code></td><td><code>string</code></td><td>-</td></tr>
        </tbody>
      </table>
    </div>
    <p><code>input-id</code> becomes the checkbox's <code>id</code>, for a <code>&lt;label for&gt;</code>. <code>aria-label</code>, <code>aria-labelledby</code> and <code>aria-describedby</code> on the element are passed to the checkbox. A switch with no label pointing at it needs an <code>aria-label</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Event</th><th>Detail</th></tr></thead>
        <tbody>
          <tr><td><code>ui-checked-change</code></td><td><code>{ checked: boolean }</code></td></tr>
        </tbody>
      </table>
    </div>
    ${heading(toc, 3, 'switchInputClass and switchTrackClass')}
    <p>For a switch as plain markup, put <code>switchInputClass()</code> on a hidden <code>&lt;input type="checkbox" role="switch"&gt;</code> and <code>switchTrackClass({ size })</code> on the <code>&lt;span&gt;</code> after it. <code>size</code> is <code>"default"</code> or <code>"sm"</code>.</p>
  `;
}
