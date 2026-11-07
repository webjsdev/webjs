import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Alert Dialog docs page, ported from shadcn's
 * content/docs/components/radix/alert-dialog.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'alert-dialog-demo';

const PREVIEW = { previewClass: 'h-56' };

export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  alertDialogHeaderClass,
  alertDialogFooterClass,
  alertDialogTitleClass,
  alertDialogDescriptionClass,
} from '#components/ui/alert-dialog.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-alert-dialog>
  <ui-alert-dialog-trigger>
    <button class=\${buttonClass({ variant: 'outline' })}>Show Dialog</button>
  </ui-alert-dialog-trigger>
  <ui-alert-dialog-content>
    <div data-slot="alert-dialog-header" class=\${alertDialogHeaderClass()}>
      <h2 data-slot="alert-dialog-title" class=\${alertDialogTitleClass()}>Are you absolutely sure?</h2>
      <p data-slot="alert-dialog-description" class=\${alertDialogDescriptionClass()}>
        This action cannot be undone. This will permanently delete your account
        from our servers.
      </p>
    </div>
    <div data-slot="alert-dialog-footer" class=\${alertDialogFooterClass()}>
      <ui-alert-dialog-cancel>Cancel</ui-alert-dialog-cancel>
      <ui-alert-dialog-action>Continue</ui-alert-dialog-action>
    </div>
  </ui-alert-dialog-content>
</ui-alert-dialog>`, { lineNumbers: true })}
    <p>Importing the module registers the <code>&lt;ui-alert-dialog&gt;</code> elements. The trigger wraps your own button, and the content renders a native <code>&lt;dialog&gt;</code> opened with <code>showModal()</code>.</p>

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build an alert dialog:</p>
    ${codeFigure(`<ui-alert-dialog>
├── <ui-alert-dialog-trigger>
└── <ui-alert-dialog-content>
    ├── alertDialogHeaderClass()
    │   ├── alertDialogMediaClass()
    │   ├── alertDialogTitleClass()
    │   └── alertDialogDescriptionClass()
    └── alertDialogFooterClass()
        ├── <ui-alert-dialog-cancel>
        └── <ui-alert-dialog-action>`, { lang: 'text' })}

    ${heading(toc, 2, 'Basic')}
    <p>A basic alert dialog with a title, description, and cancel and continue buttons.</p>
    ${await componentPreview('alert-dialog-basic', PREVIEW)}

    ${heading(toc, 2, 'Small')}
    <p>Use the <code>size="sm"</code> attribute on <code>&lt;ui-alert-dialog-content&gt;</code> to make the alert dialog smaller.</p>
    ${await componentPreview('alert-dialog-small', PREVIEW)}

    ${heading(toc, 2, 'Media')}
    <p>Use <code>alertDialogMediaClass()</code> on an element marked <code>data-slot="alert-dialog-media"</code> to add a media element such as an icon or image to the alert dialog.</p>
    ${await componentPreview('alert-dialog-media', PREVIEW)}

    ${heading(toc, 2, 'Small with Media')}
    <p>Use the <code>size="sm"</code> attribute to make the alert dialog smaller and <code>alertDialogMediaClass()</code> to add a media element such as an icon or image to the alert dialog.</p>
    ${await componentPreview('alert-dialog-small-media', PREVIEW)}

    ${heading(toc, 2, 'Destructive')}
    <p>Use <code>variant="destructive"</code> on <code>&lt;ui-alert-dialog-action&gt;</code> to add a destructive action button to the alert dialog.</p>
    ${await componentPreview('alert-dialog-destructive', PREVIEW)}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('alert-dialog-rtl', { ...PREVIEW, direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'size')}
    <p>Use the <code>size</code> attribute on <code>&lt;ui-alert-dialog-content&gt;</code> to control the size of the alert dialog. The small size lays the footer out as two full-width columns. It accepts the following values:</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>size</code></td><td><code>"default" | "sm"</code></td><td><code>"default"</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-alert-dialog')}
    <p>The root element. It tracks the open state and opens the content when the trigger is activated. Escape and a click outside do not close it: an alert dialog waits for an explicit choice. It dispatches no events, so observe the reflected <code>open</code> attribute.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute / Method</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>open</code></td><td><code>boolean</code> (reflected)</td><td><code>false</code></td></tr>
          <tr><td><code>show()</code> / <code>hide()</code></td><td><code>() =&gt; void</code></td><td></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-alert-dialog-action and ui-alert-dialog-cancel')}
    <p>The footer buttons. Both close the dialog. They render a button with the button classes, so they take the button's <code>variant</code> and <code>size</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"default" | "outline" | "ghost" | "destructive" | "secondary" | "link"</code></td><td><code>"default"</code> on the action, <code>"outline"</code> on the cancel</td></tr>
          <tr><td><code>size</code></td><td><code>"default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"</code></td><td><code>"default"</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'Class helpers')}
    <p><code>alertDialogHeaderClass()</code>, <code>alertDialogTitleClass()</code>, <code>alertDialogDescriptionClass()</code>, <code>alertDialogMediaClass()</code> and <code>alertDialogFooterClass()</code> take no options. Mark each element with its <code>data-slot</code>: the element names the dialog from <code>data-slot="alert-dialog-title"</code> and describes it from <code>data-slot="alert-dialog-description"</code>, so always give it a title.</p>
  `;
}
