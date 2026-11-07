import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Slider docs page, ported from shadcn's
 * content/docs/components/radix/slider.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'slider-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { sliderClass } from '#components/ui/slider.ts';`)}
    ${codeFigure(`<ui-slider>
  <input type="range" min="0" max="100" step="1" value="33" aria-label="Volume" class=\${sliderClass()}>
</ui-slider>`)}

    ${heading(toc, 2, 'Range')}
    <p>Use two range inputs for a range slider, one per thumb.</p>
    ${await componentPreview('slider-range')}

    ${heading(toc, 2, 'Multiple Thumbs')}
    <p>Use more range inputs for more thumbs. A thumb never passes its neighbour.</p>
    ${await componentPreview('slider-multiple')}

    ${heading(toc, 2, 'Vertical')}
    <p>Use <code>orientation="vertical"</code> for a vertical slider.</p>
    ${await componentPreview('slider-vertical')}

    ${heading(toc, 2, 'Controlled')}
    <p>The inputs hold the value, so the server renders the current one into them and into any readout beside them. Listen for <code>ui-value-change</code> to follow the thumbs as they move: its <code>detail.value</code> is every thumb's value, in order.</p>
    ${await componentPreview('slider-controlled')}

    ${heading(toc, 2, 'Disabled')}
    <p>Use the <code>disabled</code> attribute on the inputs to disable the slider.</p>
    ${await componentPreview('slider-disabled')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('slider-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'ui-slider')}
    <p><code>&lt;ui-slider&gt;</code> enhances one native <code>&lt;input type="range"&gt;</code> per thumb. Without JavaScript the page shows the inputs and the form submits them. With JavaScript the element hides them visually, draws shadcn's track, range and thumbs, and writes every move back into the inputs, so they still submit and reset with the form. <code>min</code>, <code>max</code> and <code>step</code> are read from the first input.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>orientation</code></td><td><code>"horizontal" | "vertical"</code></td><td><code>"horizontal"</code></td></tr>
        </tbody>
      </table>
    </div>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Event</th><th>Detail</th><th>shadcn</th></tr></thead>
        <tbody>
          <tr><td><code>ui-value-change</code></td><td><code>{ value: number[] }</code></td><td><code>onValueChange</code></td></tr>
          <tr><td><code>ui-value-commit</code></td><td><code>{ value: number[] }</code></td><td><code>onValueCommit</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>Each input also fires its own <code>input</code> and <code>change</code> events. Every thumb is a focusable <code>role="slider"</code> named by its input's label or <code>aria-label</code>, so give every input a name.</p>
    ${heading(toc, 3, 'sliderClass')}
    <p><code>sliderClass()</code> styles one native range input. A single value needs nothing more and works with no JavaScript at all.</p>
  `;
}
