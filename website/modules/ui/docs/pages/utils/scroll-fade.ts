import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';

/**
 * scroll-fade, ported from shadcn's content/docs/utils/scroll-fade.mdx
 * (#1666). The utilities are shadcn's, vendored unchanged in
 * packages/ui/packages/registry/styles/shadcn-tailwind.css. Neither `init`
 * nor `add` installs that file today, so Installation tells the reader to
 * copy and import it. shadcn's demos use `scrollbar-none`, a site utility;
 * the demos here use `no-scrollbar`, which ships in the same file as
 * scroll-fade, so the source a reader copies works.
 */
export const title = 'scroll-fade';
export const description = 'Utilities for adding a fade effect to the edges of a scroll container.';

const css = (text: string) => codeFigure(text, { lang: 'css' });

const rows: [string, unknown][] = [
  ['scroll-fade', html`<code>mask-image: var(--scroll-fade-mask, var(--scroll-fade-block));</code><br><code>animation-timeline: scroll(self y);</code>`],
  ['scroll-fade-y', html`<code>mask-image: var(--scroll-fade-mask, var(--scroll-fade-block));</code><br><code>animation-timeline: scroll(self y);</code>`],
  ['scroll-fade-x', html`<code>mask-image: var(--scroll-fade-mask, var(--scroll-fade-inline));</code><br><code>animation-timeline: scroll(self inline);</code>`],
  ['scroll-fade-t', html`Fade mask on the top edge.<br><code>animation-timeline: scroll(self y);</code>`],
  ['scroll-fade-b', html`Fade mask on the bottom edge.<br><code>animation-timeline: scroll(self y);</code>`],
  ['scroll-fade-l', html`Fade mask on the left edge.<br><code>animation-timeline: scroll(self x);</code>`],
  ['scroll-fade-r', html`Fade mask on the right edge.<br><code>animation-timeline: scroll(self x);</code>`],
  ['scroll-fade-s', html`Fade mask on the start edge, mirrors in RTL.<br><code>animation-timeline: scroll(self inline);</code>`],
  ['scroll-fade-e', html`Fade mask on the end edge, mirrors in RTL.<br><code>animation-timeline: scroll(self inline);</code>`],
  ['scroll-fade-<number>', html`<code>--scroll-fade-size: calc(var(--spacing) * &lt;number&gt;);</code>`],
  ['scroll-fade-[<value>]', html`<code>--scroll-fade-size: &lt;value&gt;;</code>`],
  ['scroll-fade-{t,b,s,e}-<number>', html`<code>--scroll-fade-{t,b,s,e}-size: calc(var(--spacing) * &lt;number&gt;);</code>`],
  ['scroll-fade-{t,b,s,e}-[<value>]', html`<code>--scroll-fade-{t,b,s,e}-size: &lt;value&gt;;</code>`],
  ['scroll-fade-none', html`<code>--scroll-fade-mask: none;</code>`],
];

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('scroll-fade-demo', { previewClass: 'h-auto' })}

    ${heading(toc, 2, 'Installation')}
    <p><code>scroll-fade</code> ships in <code>shadcn-tailwind.css</code>, the kit's shared Tailwind stylesheet of utilities and variants. It lives in the <code>@webjsdev/ui</code> package at <code>packages/registry/styles/shadcn-tailwind.css</code>, which a WebJs app has through the WebJs CLI. <code>webjs ui init</code> does not copy it into your app yet, so copy it next to your stylesheet:</p>
    ${codeFigure('cp node_modules/@webjsdev/ui/packages/registry/styles/shadcn-tailwind.css styles/', { lang: 'bash' })}
    <p>Then import it after Tailwind in your global CSS file:</p>
    ${css(`@import "tailwindcss";
@import "./shadcn-tailwind.css";`)}
    <p>The same file carries the <code>shimmer</code> and <code>no-scrollbar</code> utilities and the <code>data-open</code> and <code>data-checked</code> variants the kit's styles use.</p>

    ${heading(toc, 2, 'Usage')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Class</th><th>Styles</th></tr></thead>
        <tbody>${rows.map(([cls, styles]) => html`<tr><td><code>${cls}</code></td><td>${styles}</td></tr>`)}</tbody>
      </table>
    </div>
    <p>Add <code>scroll-fade</code> or <code>scroll-fade-y</code> to the scroll container, i.e. the element that has <code>overflow-y-auto</code>.</p>
    ${codeFigure(`<div class="scroll-fade overflow-y-auto">...</div>`, { lang: 'html' })}
    <p>The fade is scroll-aware and tracks the scroll position:</p>
    <ul>
      <li>At rest, the top edge is crisp and the bottom edge fades to hint at more content.</li>
      <li>As you scroll, a fade appears at the top and both edges stay faded mid-scroll.</li>
      <li>At the end, the bottom edge sharpens to show you have reached the last item.</li>
    </ul>
    <p>The fade is applied with <code>mask-image</code>, so it dissolves the content itself rather than overlaying a color. The mask uses a linear fade from transparent to black, so it adapts to any background without configuration. If your scroll area sits inside a card, put the background and border on a wrapper and <code>scroll-fade</code> on the inner scroller, so the fade dissolves the content and not the card.</p>
    <p>The <a href="/ui/docs/components/scroll-area">Scroll Area</a> and <a href="/ui/docs/components/message-scroller">Message Scroller</a> components can use <code>scroll-fade</code> on their scrollable viewport.</p>

    ${heading(toc, 2, 'No Overflow, No Fade')}
    <p>If the content does not overflow, no fade is shown. You can apply <code>scroll-fade</code> to any list without checking whether it scrolls.</p>
    ${await componentPreview('scroll-fade-overflow', { previewClass: 'h-auto' })}

    ${heading(toc, 2, 'Horizontal Scrolling')}
    <p>Use <code>scroll-fade-x</code> on containers that scroll horizontally, i.e. the element that has <code>overflow-x-auto</code>.</p>
    ${await componentPreview('scroll-fade-horizontal', { previewClass: 'h-64' })}
    ${codeFigure(`<div class="flex scroll-fade-x overflow-x-auto">...</div>`, { lang: 'html' })}
    <p>The horizontal fade is direction-aware. In RTL layouts, the crisp edge and the fade follow the reading direction with no extra classes needed. <code>scroll-fade-&lt;number&gt;</code> and <code>scroll-fade-none</code> work the same for both axes.</p>

    ${heading(toc, 2, 'Edge Fades')}
    <p>Use edge utilities when only one edge should track the scroll position.</p>
    ${await componentPreview('scroll-fade-edge', { previewClass: 'h-auto' })}
    ${codeFigure(`<div class="scroll-fade-b overflow-y-auto">...</div>`, { lang: 'html' })}
    <p>The edge utilities are scroll-aware. Start edges fade in after you scroll away from the start, and end edges fade out when you reach the end. Use <code>scroll-fade-t</code>, <code>scroll-fade-b</code>, <code>scroll-fade-l</code>, and <code>scroll-fade-r</code> for physical edges. Use <code>scroll-fade-s</code> and <code>scroll-fade-e</code> for logical inline edges that mirror in RTL.</p>

    ${heading(toc, 2, 'Fade Size')}
    <p>The fade depth defaults to <code>12%</code> of the container, capped at <code>40px</code> so tall scrollers stay subtle. Use <code>scroll-fade-&lt;number&gt;</code> to set a fixed size on the spacing scale instead, the same way <code>scroll-mt-&lt;number&gt;</code> works.</p>
    ${await componentPreview('scroll-fade-size', { previewClass: 'h-auto' })}
    ${codeFigure(`<div class="scroll-fade overflow-y-auto scroll-fade-24">...</div>`, { lang: 'html' })}
    <p>For one-off values, use an arbitrary length or percentage:</p>
    ${codeFigure(`<div class="scroll-fade overflow-y-auto scroll-fade-[15%]">...</div>`, { lang: 'html' })}
    <p>To fade opposite edges by different amounts, use the per-edge modifiers <code>scroll-fade-t-&lt;number&gt;</code>, <code>scroll-fade-b-&lt;number&gt;</code>, <code>scroll-fade-s-&lt;number&gt;</code>, and <code>scroll-fade-e-&lt;number&gt;</code>. They override <code>scroll-fade-&lt;number&gt;</code> on the edge they target and accept arbitrary values too.</p>
    ${codeFigure(`<div class="scroll-fade overflow-y-auto scroll-fade-b-8 scroll-fade-t-2">
  ...
</div>`, { lang: 'html' })}
    <p>Use the logical <code>s</code>/<code>e</code> modifiers for horizontal scrollers so the sizes mirror in RTL.</p>
    <p>The fade eases in and out over a fixed scroll distance rather than appearing instantly. That distance is the <code>--scroll-fade-reveal</code> variable, <code>96px</code> by default and independent of the fade depth. Lower it for a snappier reveal or raise it for a more gradual one:</p>
    ${codeFigure(`<div class="scroll-fade overflow-y-auto [--scroll-fade-reveal:64px]">
  ...
</div>`, { lang: 'html' })}

    ${heading(toc, 2, 'Disabling the Fade')}
    <p>Use <code>scroll-fade-none</code> to remove the fade. It works in any class order, so the typical use is responsive or stateful:</p>
    ${codeFigure(`<div class="scroll-fade overflow-y-auto md:scroll-fade-none">
  ...
</div>`, { lang: 'html' })}
    ${await componentPreview('scroll-fade-none', { previewClass: 'h-auto' })}

    ${heading(toc, 2, 'Fallback')}
    <p>The scroll-aware behavior is implemented with <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations">CSS scroll-driven animations</a>, with no JavaScript and no scroll listeners. In browsers that do not support scroll-driven animations, <code>scroll-fade</code> falls back to a static fade on both edges, and edge utilities fall back to a static fade on the selected edge.</p>
    <p>Since the mask is applied to the scroll container itself, a visible scrollbar fades with the content at the edges. Pair <code>scroll-fade</code> with <code>no-scrollbar</code>, which ships in the same file, if you want to hide the scrollbar entirely.</p>

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support in WebJs UI, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    <p><code>scroll-fade-x</code> follows the reading direction. At rest, the start edge is crisp and the end edge fades. In RTL layouts that means a crisp right edge and a fade on the left, mirrored from LTR.</p>
    ${await componentPreview('scroll-fade-rtl', { direction: 'rtl' })}
  `;
}
