import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Sheet docs page, ported from shadcn's
 * content/docs/components/radix/sheet.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'sheet-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  sheetDescriptionClass,
  sheetFooterClass,
  sheetHeaderClass,
  sheetTitleClass,
} from '#components/ui/sheet.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-sheet>
  <ui-sheet-trigger>
    <button type="button" class=\${buttonClass({ variant: 'outline' })}>Open</button>
  </ui-sheet-trigger>
  <ui-sheet-content>
    <div class=\${sheetHeaderClass()}>
      <h2 data-slot="sheet-title" class=\${sheetTitleClass()}>Are you absolutely sure?</h2>
      <p data-slot="sheet-description" class=\${sheetDescriptionClass()}>This action cannot be undone.</p>
    </div>
  </ui-sheet-content>
</ui-sheet>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a sheet:</p>
    ${codeFigure(`ui-sheet
├── ui-sheet-trigger
└── ui-sheet-content
    ├── div (sheetHeaderClass)
    │   ├── h2 (sheetTitleClass)
    │   └── p (sheetDescriptionClass)
    └── div (sheetFooterClass)
        └── ui-sheet-close`, { lang: 'text' })}

    ${heading(toc, 2, 'Side')}
    <p>Use the <code>side</code> attribute on <code>&lt;ui-sheet-content&gt;</code> to set the edge of the screen where the sheet appears. Values are <code>top</code>, <code>right</code>, <code>bottom</code>, or <code>left</code>.</p>
    ${await componentPreview('sheet-side')}

    ${heading(toc, 2, 'No Close Button')}
    <p>Use <code>show-close-button="false"</code> on <code>&lt;ui-sheet-content&gt;</code> to hide the close button.</p>
    ${await componentPreview('sheet-no-close-button')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>. <code>side</code> names a physical edge, so <code>side="right"</code> stays on the right under <code>dir="rtl"</code>: pick the side from the reading direction when the panel should follow it, as this demo does.</p>
    ${await componentPreview('sheet-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    <p>A sheet is a dialog attached to an edge of the screen: the same native <code>&lt;dialog&gt;</code> opened with <code>showModal()</code>, with the same focus trap, Escape and backdrop close, focus restoration and scroll lock. See the <a href="/ui/docs/components/dialog">Dialog</a> documentation.</p>
    ${heading(toc, 3, 'ui-sheet')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>open</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    ${heading(toc, 3, 'ui-sheet-content')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>side</code></td><td><code>"top" | "right" | "bottom" | "left"</code></td><td><code>"right"</code></td></tr>
          <tr><td><code>show-close-button</code></td><td><code>"true" | "false"</code></td><td><code>"true"</code></td></tr>
        </tbody>
      </table>
    </div>
    ${heading(toc, 3, 'ui-sheet-trigger and ui-sheet-close')}
    <p>Wrap a real <code>&lt;button&gt;</code>: a click on it opens or closes the sheet.</p>
    ${heading(toc, 3, 'Class helpers')}
    <p><code>sheetHeaderClass()</code>, <code>sheetFooterClass()</code>, <code>sheetTitleClass()</code> and <code>sheetDescriptionClass()</code> style the parts inside the content. Mark the title <code>data-slot="sheet-title"</code> and the description <code>data-slot="sheet-description"</code>, so the sheet is named and described by them.</p>
  `;
}
