import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Alert docs page, ported from shadcn's
 * content/docs/components/radix/alert.mdx (#1666): the same sections in the
 * same order, the prose rewritten where it describes React.
 */
export const demo = 'alert-demo';

const PREVIEW = { previewClass: 'h-auto sm:h-72 p-6' };

export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  alertClass,
  alertTitleClass,
  alertDescriptionClass,
} from '#components/ui/alert.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="alert" role="alert" class=\${alertClass()}>
  \${InfoIcon()}
  <div data-slot="alert-title" class=\${alertTitleClass()}>Heads up!</div>
  <div data-slot="alert-description" class=\${alertDescriptionClass()}>
    You can add components and dependencies to your app using the cli.
  </div>
  <div data-slot="alert-action" class="absolute top-2 right-2">
    <button class=\${buttonClass({ variant: 'outline' })}>Enable</button>
  </div>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build an alert:</p>
    ${codeFigure(`alertClass()
├── Icon
├── alertTitleClass()
├── alertDescriptionClass()
└── data-slot="alert-action"`, { lang: 'text' })}

    ${heading(toc, 2, 'Basic')}
    <p>A basic alert with an icon, title and description.</p>
    ${await componentPreview('alert-basic', PREVIEW)}

    ${heading(toc, 2, 'Destructive')}
    <p>Use <code>alertClass({ variant: 'destructive' })</code> to create a destructive alert.</p>
    ${await componentPreview('alert-destructive', PREVIEW)}

    ${heading(toc, 2, 'Action')}
    <p>Add an element marked <code>data-slot="alert-action"</code> to hold a button or other action element. The alert reserves room for it on the inline end, and <code>absolute top-2 right-2</code> places it in the corner. The kit has no class helper for this part.</p>
    ${await componentPreview('alert-action', PREVIEW)}

    ${heading(toc, 2, 'Custom Colors')}
    <p>You can customize the alert colors by adding custom classes such as <code>bg-amber-50 dark:bg-amber-950</code>, merged with <code>alertClass()</code> through <code>cn()</code>.</p>
    ${await componentPreview('alert-colors', PREVIEW)}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('alert-rtl', { ...PREVIEW, direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    <p>An alert is a native <code>&lt;div&gt;</code> with the classes below. The helpers set no role, so put <code>role="alert"</code> on an urgent, interrupting message, or <code>role="status"</code> on a polite, non-urgent update.</p>

    ${heading(toc, 3, 'alertClass')}
    <p><code>alertClass()</code> returns the classes for the alert container, which displays a callout for user attention.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"default" | "destructive"</code></td><td><code>"default"</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'alertTitleClass')}
    <p><code>alertTitleClass()</code> returns the classes for the title of the alert. It takes no options. Mark the element <code>data-slot="alert-title"</code>.</p>

    ${heading(toc, 3, 'alertDescriptionClass')}
    <p><code>alertDescriptionClass()</code> returns the classes for the description or content of the alert. It takes no options. Mark the element <code>data-slot="alert-description"</code>.</p>

    ${heading(toc, 3, 'Alert action')}
    <p>An action element (like a button) positioned absolutely in the top-right corner of the alert. Mark the element <code>data-slot="alert-action"</code> and position it with <code>absolute top-2 right-2</code>.</p>
  `;
}
