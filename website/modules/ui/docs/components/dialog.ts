import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Dialog docs page, ported from shadcn's
 * content/docs/components/radix/dialog.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'dialog-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    <p>Importing the module registers the dialog elements and gives you the class helpers for the parts inside the panel.</p>
    ${codeFigure(`import { buttonClass } from '#components/ui/button.ts';
import {
  dialogHeaderClass,
  dialogTitleClass,
  dialogDescriptionClass,
} from '#components/ui/dialog.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-dialog>
  <ui-dialog-trigger>
    <button class=\${buttonClass({ variant: 'outline' })}>Open</button>
  </ui-dialog-trigger>
  <ui-dialog-content>
    <div class=\${dialogHeaderClass()}>
      <h2 data-slot="dialog-title" class=\${dialogTitleClass()}>Are you absolutely sure?</h2>
      <p data-slot="dialog-description" class=\${dialogDescriptionClass()}>
        This action cannot be undone. This will permanently delete your account
        and remove your data from our servers.
      </p>
    </div>
  </ui-dialog-content>
</ui-dialog>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a dialog:</p>
    ${codeFigure(`ui-dialog
├── ui-dialog-trigger
└── ui-dialog-content
    ├── dialogHeaderClass()
    │   ├── dialogTitleClass()
    │   └── dialogDescriptionClass()
    └── dialogFooterClass()`, { lang: 'text' })}

    ${heading(toc, 2, 'Custom Close Button')}
    <p>Replace the default close control with your own button.</p>
    ${await componentPreview('dialog-close-button')}

    ${heading(toc, 2, 'No Close Button')}
    <p>Use <code>show-close-button="false"</code> on <code>&lt;ui-dialog-content&gt;</code> to hide the close button.</p>
    ${await componentPreview('dialog-no-close-button')}

    ${heading(toc, 2, 'Sticky Footer')}
    <p>Keep actions visible while the content scrolls.</p>
    ${await componentPreview('dialog-sticky-footer')}

    ${heading(toc, 2, 'Scrollable Content')}
    <p>Long content can scroll while the header stays in view.</p>
    ${await componentPreview('dialog-scrollable-content')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('dialog-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    <p>The dialog is built on the native <code>&lt;dialog&gt;</code> element opened with <code>showModal()</code>, so top-layer rendering, the backdrop, the focus trap, Escape to close and focus return come from the platform. On open the panel is named and described from its <code>data-slot="dialog-title"</code> and <code>data-slot="dialog-description"</code> nodes, so give every dialog a title.</p>

    ${heading(toc, 3, 'ui-dialog')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Member</th><th>Type</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>open</code></td><td><code>boolean</code></td><td>Reflected. Presence shows the dialog.</td></tr>
          <tr><td><code>show()</code> / <code>hide()</code> / <code>toggle()</code></td><td>method</td><td>Open or close the dialog from code.</td></tr>
          <tr><td><code>ui-open-change</code></td><td>event</td><td><code>{ detail: { open } }</code> after the dialog opens or closes.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-dialog-trigger')}
    <p>Wraps the control that opens the dialog, usually a <code>&lt;button&gt;</code> with <code>buttonClass()</code>.</p>

    ${heading(toc, 3, 'ui-dialog-content')}
    <p>The panel. A class written on it lands on the panel, so <code>class="sm:max-w-md"</code> sets its width. An <code>aria-label</code> or <code>aria-labelledby</code> on it wins over the title.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>show-close-button</code></td><td><code>"true" | "false"</code></td><td><code>"true"</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-dialog-close')}
    <p>Wraps a control that closes the dialog when clicked.</p>

    ${heading(toc, 3, 'Class helpers')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Helper</th><th>Use on</th></tr></thead>
        <tbody>
          <tr><td><code>dialogHeaderClass()</code></td><td>A <code>&lt;div data-slot="dialog-header"&gt;</code> holding the title and description.</td></tr>
          <tr><td><code>dialogTitleClass()</code></td><td>A real heading with <code>data-slot="dialog-title"</code>.</td></tr>
          <tr><td><code>dialogDescriptionClass()</code></td><td>A <code>&lt;p data-slot="dialog-description"&gt;</code>.</td></tr>
          <tr><td><code>dialogFooterClass()</code></td><td>A <code>&lt;div data-slot="dialog-footer"&gt;</code> holding the actions.</td></tr>
        </tbody>
      </table>
    </div>
  `;
}
