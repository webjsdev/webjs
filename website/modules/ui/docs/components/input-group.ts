import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';
import { IconInfoCircle } from '#lib/ui/tabler.ts';

/**
 * The Input Group docs page body, ported from shadcn's
 * content/docs/components/radix/input-group.mdx (#1666, D15): the same
 * sections in the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'input-group-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  inputGroupClass,
  inputGroupAddonClass,
  inputGroupButtonClass,
  inputGroupInputClass,
  inputGroupTextClass,
  inputGroupTextareaClass,
} from '#components/ui/input-group.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="input-group" role="group" class=\${inputGroupClass()}>
  <input data-slot="input-group-control" id="search" placeholder="Search..." aria-label="Search" class=\${inputGroupInputClass()}>
  <label data-slot="input-group-addon" data-align="inline-start" for="search" class=\${inputGroupAddonClass()}>
    <svg aria-hidden="true"><!-- search icon --></svg>
  </label>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build an input group:</p>
    ${codeFigure(`inputGroupClass()
├── inputGroupInputClass() or inputGroupTextareaClass()
├── inputGroupAddonClass()
├── inputGroupButtonClass()
└── inputGroupTextClass()`, { lang: 'text' })}

    ${heading(toc, 2, 'Align')}
    <p>Use the <code>align</code> option of <code>inputGroupAddonClass()</code>, with a matching <code>data-align</code> attribute, to position the addon relative to the input.</p>
    ${callout(html`For proper focus management, the addon should always be placed after the input or textarea in the DOM. Use the <code>align</code> option to visually position the addon.`)}

    ${heading(toc, 3, 'inline-start')}
    <p>Use <code>align: 'inline-start'</code> to position the addon at the start of the input. This is the default.</p>
    ${await componentPreview('input-group-inline-start', { previewClass: 'h-48' })}

    ${heading(toc, 3, 'inline-end')}
    <p>Use <code>align: 'inline-end'</code> to position the addon at the end of the input.</p>
    ${await componentPreview('input-group-inline-end', { previewClass: 'h-48' })}

    ${heading(toc, 3, 'block-start')}
    <p>Use <code>align: 'block-start'</code> to position the addon above the input.</p>
    ${await componentPreview('input-group-block-start', { previewClass: 'h-96' })}

    ${heading(toc, 3, 'block-end')}
    <p>Use <code>align: 'block-end'</code> to position the addon below the input.</p>
    ${await componentPreview('input-group-block-end', { previewClass: 'h-[26rem]' })}

    ${heading(toc, 2, 'Icon')}
    ${await componentPreview('input-group-icon', { previewClass: 'h-80' })}

    ${heading(toc, 2, 'Text')}
    ${await componentPreview('input-group-text', { previewClass: 'h-80' })}

    ${heading(toc, 2, 'Button')}
    ${await componentPreview('input-group-button', { previewClass: 'h-72' })}

    ${heading(toc, 2, 'Kbd')}
    ${await componentPreview('input-group-kbd', { previewClass: 'h-40' })}

    ${heading(toc, 2, 'Dropdown')}
    ${await componentPreview('input-group-dropdown', { previewClass: 'h-56' })}

    ${heading(toc, 2, 'Spinner')}
    ${await componentPreview('input-group-spinner', { previewClass: 'h-80' })}

    ${heading(toc, 2, 'Textarea')}
    ${await componentPreview('input-group-textarea', { previewClass: 'h-96' })}

    ${heading(toc, 2, 'Custom Input')}
    <p>Add the <code>data-slot="input-group-control"</code> attribute to your custom input for automatic focus state handling.</p>
    <p>Here's an example of a textarea that grows with its text through <code>field-sizing-content</code>, with its own classes in place of <code>inputGroupTextareaClass()</code>.</p>
    ${await componentPreview('input-group-custom', { previewClass: 'h-56' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('input-group-rtl', { direction: 'rtl', previewClass: 'h-[30rem]' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'inputGroupClass')}
    <p>The classes for the element that wraps inputs and addons. Put <code>data-slot="input-group"</code> and <code>role="group"</code> on it. It takes no options.</p>
    ${codeFigure(`<div data-slot="input-group" role="group" class=\${inputGroupClass()}>
  <input data-slot="input-group-control" class=\${inputGroupInputClass()}>
  <label data-slot="input-group-addon" class=\${inputGroupAddonClass()}></label>
</div>`)}

    ${heading(toc, 3, 'inputGroupAddonClass')}
    <p>Displays icons, text, buttons, or other content alongside inputs. Set <code>data-slot="input-group-addon"</code> and a <code>data-align</code> that matches the <code>align</code> option, since the group reads it to lay itself out. An addon holding only icons or text can be a <code>&lt;label for&gt;</code> pointing at the control, so a click on it focuses the control with no script. An addon holding a button is a <code>&lt;div role="group"&gt;</code>, because a label may not contain a second control. <code>inputGroupAddonVariants()</code> is the same helper under shadcn's name.</p>
    ${callout(html`For proper focus navigation, the addon should be placed after the input. Set the <code>align</code> option to position the addon.`, { icon: IconInfoCircle(), title: 'Focus Navigation' })}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>align</code></td><td><code>"inline-start" | "inline-end" | "block-start" | "block-end"</code></td><td><code>"inline-start"</code></td></tr>
        </tbody>
      </table>
    </div>
    ${codeFigure(`<label data-slot="input-group-addon" data-align="inline-end" for="search" class=\${inputGroupAddonClass({ align: 'inline-end' })}>
  <svg aria-hidden="true"><!-- search icon --></svg>
</label>`)}
    <p><strong>For an input, use the <code>inline-start</code> or <code>inline-end</code> alignment. For a textarea, use the <code>block-start</code> or <code>block-end</code> alignment.</strong></p>
    <p>An addon can hold several buttons and icons.</p>
    ${codeFigure(`<div role="group" data-slot="input-group-addon" data-align="inline-start" class=\${inputGroupAddonClass()}>
  <button type="button" class=\${inputGroupButtonClass()}>Button</button>
  <button type="button" class=\${inputGroupButtonClass()}>Button</button>
</div>`)}

    ${heading(toc, 3, 'inputGroupButtonClass')}
    <p>Displays buttons within input groups. It is the button's own classes with the group's size on top, so put it on a real <code>&lt;button type="button"&gt;</code>, and give an icon-only button an <code>aria-label</code>. <code>inputGroupButtonVariants()</code> is the same helper under shadcn's name.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>size</code></td><td><code>"xs" | "icon-xs" | "sm" | "icon-sm"</code></td><td><code>"xs"</code></td></tr>
          <tr><td><code>variant</code></td><td><code>"default" | "destructive" | "outline" | "secondary" | "ghost" | "link"</code></td><td><code>"ghost"</code></td></tr>
        </tbody>
      </table>
    </div>
    ${codeFigure(`<button type="button" class=\${inputGroupButtonClass()}>Button</button>
<button type="button" aria-label="Copy" class=\${inputGroupButtonClass({ size: 'icon-xs' })}>
  <svg aria-hidden="true"><!-- copy icon --></svg>
</button>`)}

    ${heading(toc, 3, 'inputGroupInputClass')}
    <p>The classes for an <code>&lt;input&gt;</code> inside an input group: the input's own classes with the group styles on top. Set the unified <code>data-slot="input-group-control"</code> on it, which the group reads for its focus state. It takes no options, and every native input attribute works as usual.</p>
    ${codeFigure(`<div data-slot="input-group" role="group" class=\${inputGroupClass()}>
  <input data-slot="input-group-control" id="q" placeholder="Enter text..." aria-label="Query" class=\${inputGroupInputClass()}>
  <label data-slot="input-group-addon" data-align="inline-start" for="q" class=\${inputGroupAddonClass()}>
    <svg aria-hidden="true"><!-- search icon --></svg>
  </label>
</div>`)}

    ${heading(toc, 3, 'inputGroupTextareaClass')}
    <p>The classes for a <code>&lt;textarea&gt;</code> inside an input group: the textarea's own classes with the group styles on top. Set <code>data-slot="input-group-control"</code> on it for the focus state. It takes no options, and every native textarea attribute works as usual.</p>
    ${codeFigure(`<div data-slot="input-group" role="group" class=\${inputGroupClass()}>
  <textarea data-slot="input-group-control" placeholder="Enter message..." aria-label="Message" class=\${inputGroupTextareaClass()}></textarea>
  <div role="group" data-slot="input-group-addon" data-align="block-end" class=\${inputGroupAddonClass({ align: 'block-end' })}>
    <button type="button" class=\${inputGroupButtonClass()}>Send</button>
  </div>
</div>`)}

    ${heading(toc, 2, 'Changelog')}
    ${heading(toc, 3, '2025-10-06 InputGroup', '2025-10-06-inputgroup')}
    <p>Add the <code>min-w-0</code> class to <code>inputGroupClass()</code>. See <a href="https://github.com/shadcn-ui/ui/pull/8341/files#diff-0e2ee95d0050ca4c5d82339df86c54e14a6739dc4638fdda0eec8f73aebc2da9">diff</a>.</p>
  `;
}
