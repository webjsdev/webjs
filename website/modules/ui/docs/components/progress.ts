import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Progress docs page, ported from shadcn's
 * content/docs/components/radix/progress.mdx (#1666, D15): the same sections
 * in the same order, the prose rewritten where it describes React.
 */
export const demo = 'progress-demo';

const TABLE = 'typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { progressClass } from '#components/ui/progress.ts';`, { lineNumbers: true })}
    ${codeFigure(`<progress value="33" max="100" aria-label="Progress" class=\${progressClass()}></progress>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Label')}
    <p>Use a <a href="/ui/docs/components/field">Field</a> to add a label to the progress bar, linked by the <code>for</code> and <code>id</code> pair.</p>
    ${await componentPreview('progress-label')}

    ${heading(toc, 2, 'Controlled')}
    <p>A progress bar that can be controlled by a slider.</p>
    ${await componentPreview('progress-controlled')}
    <p>The bar is a native <code>&lt;progress&gt;</code>, so setting its <code>value</code> is the whole update. Listen for the slider's <code>ui-value-change</code> event and write the value across:</p>
    ${codeFigure(`const slider = document.querySelector('ui-slider');
const bar = document.querySelector('progress');
slider.addEventListener('ui-value-change', (event) => {
  bar.value = event.detail.value[0];
});`, { lineNumbers: true })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('progress-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'progressClass')}
    <p><code>progressClass()</code> returns the classes for a native <code>&lt;progress&gt;</code> element. It takes no options. The element supplies the <code>progressbar</code> role and its value to assistive technology on its own, so the one thing to add is an accessible name, an <code>aria-label</code> or a <code>&lt;label for&gt;</code>.</p>
    <div class=${TABLE}>
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>value</code></td><td><code>number</code></td><td></td></tr>
          <tr><td><code>max</code></td><td><code>number</code></td><td><code>1</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>Leave <code>value</code> off for the indeterminate state, which pulses.</p>
  `;
}
