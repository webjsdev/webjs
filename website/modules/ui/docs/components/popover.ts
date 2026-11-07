import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Popover docs page, ported from shadcn's
 * content/docs/components/radix/popover.mdx (#1666, D15): the same sections
 * in the same order, the prose rewritten where it describes React.
 */
export const demo = 'popover-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { buttonClass } from '#components/ui/button.ts';
import {
  popoverContentClass,
  popoverDescriptionClass,
  popoverHeaderClass,
  popoverTitleClass,
} from '#components/ui/popover.ts';`, { lineNumbers: true })}
    ${codeFigure(`<button
  popovertarget="popover"
  aria-haspopup="dialog"
  aria-expanded="false"
  class=\${buttonClass({ variant: 'outline' })}
>
  Open Popover
</button>
<div
  id="popover"
  popover
  role="dialog"
  aria-labelledby="popover-title"
  class=\${popoverContentClass()}
>
  <div class=\${popoverHeaderClass()}>
    <h3 id="popover-title" class=\${popoverTitleClass()}>Title</h3>
    <p class=\${popoverDescriptionClass()}>Description text here.</p>
  </div>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a popover:</p>
    ${codeFigure(`button popovertarget="id"
div popover id="id"          popoverContentClass()
└── div                      popoverHeaderClass()
    ├── h3                   popoverTitleClass()
    └── p                    popoverDescriptionClass()`, { lang: 'text' })}
    <p>The popover is the browser's own Popover API. The <code>popovertarget</code> button opens the panel, which renders in the top layer, closes on an outside click or Escape, returns focus to the button, and is anchored to the button by CSS Anchor Positioning, all with no script.</p>

    ${heading(toc, 2, 'Basic')}
    <p>A simple popover with a header, title, and description.</p>
    ${await componentPreview('popover-basic')}

    ${heading(toc, 2, 'Align')}
    <p>Use the <code>align</code> option of <code>popoverContentClass()</code> to control the horizontal alignment.</p>
    ${await componentPreview('popover-alignments')}

    ${heading(toc, 2, 'With Form')}
    <p>A popover with form fields inside.</p>
    ${await componentPreview('popover-form')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('popover-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'popoverContentClass')}
    <p><code>popoverContentClass()</code> returns the classes for the panel, a <code>&lt;div popover&gt;</code> opened by a button whose <code>popovertarget</code> names its <code>id</code>. Placement is CSS Anchor Positioning, so the options are a fixed set the stylesheet carries. For any other offset, set the margin inline.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>side</code></td><td><code>"top" | "right" | "bottom" | "left"</code></td><td><code>"bottom"</code></td></tr>
          <tr><td><code>align</code></td><td><code>"start" | "center" | "end"</code></td><td><code>"center"</code></td></tr>
          <tr><td><code>sideOffset</code></td><td><code>0 | 2 | 4 | 6 | 8 | 12 | 16 | 20 | 24</code></td><td><code>4</code></td></tr>
          <tr><td><code>alignOffset</code></td><td><code>0 | 2 | 4 | 6 | 8 | 12 | 16 | 20 | 24</code></td><td><code>0</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'Header, Title, Description')}
    <p><code>popoverHeaderClass()</code>, <code>popoverTitleClass()</code> and <code>popoverDescriptionClass()</code> take no options. Make the title a real heading at the right level for its place in the page.</p>

    ${heading(toc, 3, 'Accessibility')}
    <p>A class helper returns only classes, so the panel's role and name are yours to supply. Give the panel <code>role="dialog"</code> and name it with <code>aria-labelledby</code> pointing at the title, and <code>aria-describedby</code> pointing at the description when there is one. Give the button <code>aria-haspopup="dialog"</code> and an <code>aria-expanded</code> kept in sync from the panel's native <code>toggle</code> event.</p>
    ${codeFigure(`const panel = document.getElementById('popover');
const trigger = document.querySelector('[popovertarget="popover"]');
panel.addEventListener('toggle', (e) => {
  trigger.setAttribute('aria-expanded', String(e.newState === 'open'));
});`, { lineNumbers: true })}
  `;
}
