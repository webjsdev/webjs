import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';

/**
 * shimmer, ported from shadcn's content/docs/utils/shimmer.mdx (#1666). The
 * utilities are shadcn's, vendored unchanged in
 * packages/ui/packages/registry/styles/shadcn-tailwind.css, which `init`
 * does not install yet, so Installation tells the reader to copy and import
 * it. shadcn's Play Once demo replays through React state; the demo here
 * replays with a checkbox, so it works with no script.
 */
export const title = 'shimmer';
export const description = 'Utilities for adding a shimmer effect to text elements.';

const sample = (text: string) => codeFigure(text, { lang: 'html' });

const rows: [string, unknown][] = [
  ['shimmer', html`<code>background-clip: text;</code><br><code>animation: tw-shimmer var(--shimmer-duration, 2s) linear infinite;</code>`],
  ['shimmer-once', html`<code>animation-iteration-count: 1;</code>`],
  ['shimmer-reverse', html`<code>animation-direction: reverse;</code>`],
  ['shimmer-none', html`<code>--shimmer-image: none;</code><br><code>--shimmer-text-fill: currentColor;</code>`],
  ['shimmer-color-<color>', html`<code>--shimmer-color: &lt;color&gt;;</code>`],
  ['shimmer-color-[<value>]', html`<code>--shimmer-color: &lt;value&gt;;</code>`],
  ['shimmer-color-<color>/<pct>', html`<code>--shimmer-color: color-mix(in oklch, &lt;color&gt; &lt;pct&gt;, transparent);</code>`],
  ['shimmer-duration-<number>', html`<code>--shimmer-duration: calc(&lt;number&gt; * 1ms);</code>`],
  ['shimmer-spread-<number>', html`<code>--shimmer-spread: calc(var(--spacing) * &lt;number&gt;);</code>`],
  ['shimmer-spread-[<value>]', html`<code>--shimmer-spread: &lt;value&gt;;</code>`],
  ['shimmer-angle-<number>', html`<code>--shimmer-angle: calc(&lt;number&gt; * 1deg);</code>`],
];

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('shimmer-demo')}

    ${heading(toc, 2, 'Installation')}
    <p><code>shimmer</code> ships in <code>shadcn-tailwind.css</code>, the kit's shared Tailwind stylesheet of utilities and variants. It lives in the <code>@webjsdev/ui</code> package at <code>packages/registry/styles/shadcn-tailwind.css</code>, which a WebJs app has through the WebJs CLI. <code>webjs ui init</code> does not copy it into your app yet, so copy it next to your stylesheet:</p>
    ${codeFigure('cp node_modules/@webjsdev/ui/packages/registry/styles/shadcn-tailwind.css styles/', { lang: 'bash' })}
    <p>Then import it after Tailwind in your global CSS file:</p>
    ${codeFigure(`@import "tailwindcss";
@import "./shadcn-tailwind.css";`, { lang: 'css' })}

    ${heading(toc, 2, 'Usage')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Class</th><th>Styles</th></tr></thead>
        <tbody>${rows.map(([cls, styles]) => html`<tr><td><code>${cls}</code></td><td>${styles}</td></tr>`)}</tbody>
      </table>
    </div>
    <p>Add <code>shimmer</code> to a text element.</p>
    ${sample(`<p class="shimmer text-muted-foreground">Generating response&hellip;</p>`)}
    <p>The shimmer is built on <code>currentColor</code>, so it adapts to the element:</p>
    <ul>
      <li>The highlight is derived from the text color, with no configuration needed.</li>
      <li>It works on any color, from <code>text-muted-foreground</code> to brand colors.</li>
      <li>In dark mode, the highlight automatically brightens to stay visible.</li>
    </ul>
    <p>The effect is pure CSS. The text is painted with <code>background-clip: text</code>, and the highlight sweeps across it in a seamless loop.</p>

    ${heading(toc, 2, 'With Marker')}
    <p>The shimmer composes with any component that renders text. A common pattern is a <a href="/ui/docs/components/marker">Marker</a> showing a live status while the assistant is working:</p>
    ${await componentPreview('shimmer-marker')}
    ${sample(`<div data-slot="marker" role="status" class=\${markerClass()}>
  <span data-slot="marker-icon" aria-hidden="true" class=\${markerIconClass()}>
    \${spinner({ decorative: true })}
  </span>
  <span data-slot="marker-content" class=\${cn(markerContentClass(), 'shimmer')}>Thinking&hellip;</span>
</div>`)}

    ${heading(toc, 2, 'Color')}
    <p>Use <code>shimmer-color-&lt;color&gt;</code> to set the highlight color explicitly. It accepts theme colors with an optional opacity modifier, or any arbitrary color value.</p>
    ${await componentPreview('shimmer-color')}
    ${sample(`<p class="shimmer shimmer-color-blue-500/60">Generating response&hellip;</p>
<p class="shimmer shimmer-color-[#378ADD]">Generating response&hellip;</p>`)}

    ${heading(toc, 2, 'Duration')}
    <p>Use <code>shimmer-duration-&lt;number&gt;</code> to set the duration of one sweep in milliseconds. The default is <code>2000</code>, i.e. <code>2s</code>.</p>
    ${await componentPreview('shimmer-duration')}
    ${sample(`<p class="shimmer shimmer-duration-1000">Generating response&hellip;</p>`)}

    ${heading(toc, 2, 'Spread')}
    <p>Use <code>shimmer-spread-&lt;number&gt;</code> to set the width of the highlight band using the spacing scale. The default is <code>calc(3ch + 40px)</code>, a fixed base plus a <code>3ch</code> term that scales with the font size.</p>
    ${await componentPreview('shimmer-spread')}
    ${sample(`<p class="shimmer shimmer-spread-24">Generating response&hellip;</p>`)}
    <p>For one-off values, use an arbitrary length or percentage:</p>
    ${sample(`<p class="shimmer shimmer-spread-[5rem]">Generating response&hellip;</p>`)}

    ${heading(toc, 2, 'Angle')}
    <p>Use <code>shimmer-angle-&lt;number&gt;</code> to set the tilt of the highlight band in degrees. The default is <code>20</code>.</p>
    ${await componentPreview('shimmer-angle')}
    ${sample(`<p class="shimmer shimmer-angle-45">Generating response&hellip;</p>`)}

    ${heading(toc, 2, 'Reverse')}
    <p>Use <code>shimmer-reverse</code> to sweep the highlight in the opposite direction. In RTL layouts the sweep already follows the reading direction. See <a href="#rtl">RTL</a>.</p>
    ${sample(`<p class="shimmer shimmer-reverse">Generating response&hellip;</p>`)}

    ${heading(toc, 2, 'Play Once')}
    <p>Use <code>shimmer-once</code> to play a single sweep instead of looping, useful as a reveal when streaming completes. Pair it with <code>shimmer-duration-&lt;number&gt;</code> to control how long the sweep takes. The Replay button below toggles a checkbox that swaps two copies of the text, since an element that becomes visible starts its animation over.</p>
    ${await componentPreview('shimmer-once')}
    ${sample(`<p class="shimmer shimmer-duration-1100 shimmer-once">
  Response generated.
</p>`)}

    ${heading(toc, 2, 'Disabling the Shimmer')}
    <p>Use <code>shimmer-none</code> to turn the effect off and render the text normally. It works in any class order, so the typical use is responsive or stateful:</p>
    ${await componentPreview('shimmer-none')}
    ${sample(`<p class="shimmer md:shimmer-none">Generating response&hellip;</p>`)}

    ${heading(toc, 2, 'Fallback')}
    <p>The shimmer is built on modern color features, <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_colors/Relative_colors">relative color syntax</a> and <code>color-mix()</code>, which are available in all current browsers. In older browsers without support, the highlight gradient is dropped and the text can render transparent. If you target older browsers, apply <code>shimmer</code> conditionally with a <code>supports-*</code> variant:</p>
    ${sample(`<p class="supports-[color:oklch(from_white_l_c_h)]:shimmer">
  Generating response&hellip;
</p>`)}

    ${heading(toc, 2, 'Reduced Motion')}
    <p>When the user prefers reduced motion, the animation is disabled automatically and the text renders normally. There is nothing to configure.</p>

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support in WebJs UI, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    <p>The sweep follows the reading direction, left to right in LTR and right to left in RTL, with no extra classes. Use <code>shimmer-reverse</code> to flip the direction manually.</p>
    ${await componentPreview('shimmer-rtl')}
  `;
}
