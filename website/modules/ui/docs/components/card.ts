import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Card docs page, ported from shadcn's
 * content/docs/components/radix/card.mdx (#1666): the same sections in the
 * same order, the prose rewritten where it describes React.
 */
export const demo = 'card-demo';

const noOptions = (slot: string, element: string) => html`
  <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
    <table>
      <thead><tr><th>Element</th><th>Attributes</th><th>Options</th></tr></thead>
      <tbody><tr><td><code>${element}</code></td><td><code>data-slot="${slot}"</code></td><td>none</td></tr></tbody>
    </table>
  </div>`;

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  cardClass,
  cardActionClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '#components/ui/card.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="card" data-size="default" class=\${cardClass()}>
  <div data-slot="card-header" class=\${cardHeaderClass()}>
    <div data-slot="card-title" class=\${cardTitleClass()}>Card Title</div>
    <div data-slot="card-description" class=\${cardDescriptionClass()}>Card Description</div>
    <div data-slot="card-action" class=\${cardActionClass()}>Card Action</div>
  </div>
  <div data-slot="card-content" class=\${cardContentClass()}>
    <p>Card Content</p>
  </div>
  <div data-slot="card-footer" class=\${cardFooterClass()}>
    <p>Card Footer</p>
  </div>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a card:</p>
    ${codeFigure(`cardClass()
├── cardHeaderClass()
│   ├── cardTitleClass()
│   ├── cardDescriptionClass()
│   └── cardActionClass()
├── cardContentClass()
└── cardFooterClass()`, { lang: 'text' })}

    ${heading(toc, 2, 'Size')}
    <p>Pass <code>size: 'sm'</code> to <code>cardClass()</code> and set <code>data-size="sm"</code> on the same element to set the size of the card to small. The small size variant uses smaller spacing.</p>
    ${await componentPreview('card-small', { previewClass: 'h-96' })}

    ${heading(toc, 2, 'Spacing')}
    <p>In addition to the <code>size</code> option, you can use the <code>--card-spacing</code> CSS variable to control the spacing between sections and the inset of card parts. Every style carries it except new-york.</p>
    ${await componentPreview('card-spacing', { previewClass: 'h-[34rem]' })}
    <p>Use negative margins with <code>-mx-(--card-spacing)</code> to make content go edge to edge while keeping it aligned with the card inset. When the edge-to-edge content sits above a footer, use <code>-mb-(--card-spacing)</code> on the card content to remove the section gap.</p>
    ${await componentPreview('card-edge-to-edge', { previewClass: 'h-[24rem]' })}

    ${heading(toc, 2, 'Image')}
    <p>Add an image before the card header to create a card with an image.</p>
    ${await componentPreview('card-image', { previewClass: 'h-[32rem]' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('card-rtl', { direction: 'rtl', previewClass: 'h-[30rem]' })}

    ${heading(toc, 2, 'API Reference')}
    <p>Every part is a class helper you put on a native element, with the <code>data-slot</code> its styles key on.</p>

    ${heading(toc, 3, 'cardClass')}
    <p><code>cardClass()</code> is the root container for card content. Put it on a <code>&lt;div&gt;</code> and set <code>data-size</code> to the same size, which is what the parts read.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option / Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>size</code> / <code>data-size</code></td><td><code>"default" | "sm"</code></td><td><code>"default"</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'cardHeaderClass')}
    <p><code>cardHeaderClass()</code> is used for a title, description, and optional action.</p>
    ${noOptions('card-header', '<div>')}

    ${heading(toc, 3, 'cardTitleClass')}
    <p><code>cardTitleClass()</code> is used for the card title. Put it on a real heading when the card has a meaningful title, at the level that fits the page.</p>
    ${noOptions('card-title', '<div> or <h2>-<h6>')}

    ${heading(toc, 3, 'cardDescriptionClass')}
    <p><code>cardDescriptionClass()</code> is used for helper text under the title.</p>
    ${noOptions('card-description', '<div>')}

    ${heading(toc, 3, 'cardActionClass')}
    <p><code>cardActionClass()</code> places content in the top-right of the header (for example, a button or a badge). Keep it after the title and description in the markup, so it is announced after them.</p>
    ${noOptions('card-action', '<div>')}

    ${heading(toc, 3, 'cardContentClass')}
    <p><code>cardContentClass()</code> is used for the main card body.</p>
    ${noOptions('card-content', '<div>')}

    ${heading(toc, 3, 'cardFooterClass')}
    <p><code>cardFooterClass()</code> is used for actions and secondary content at the bottom of the card.</p>
    ${noOptions('card-footer', '<div>')}

    ${heading(toc, 2, 'Changelog')}
    ${heading(toc, 3, 'Spacing Variable')}
    <p>If you added the card before your style carried the <code>--card-spacing</code> variable, run <code>webjs ui diff card</code> to see the drift, then re-add it with <code>webjs ui add card --overwrite</code> or apply the following updates to the class strings in <code>components/ui/card.ts</code>:</p>
    <div class="steps mb-12 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step">
      <h3>Update the card root spacing classes.</h3>
      <p>Replace the hard-coded gap and vertical padding with <code>--card-spacing</code>, and set the default and small size values on the root:</p>
      ${codeFigure(`  const base =
-   'group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl';
+   'group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl';`, { lang: 'diff' })}
      <h3>Update the card header spacing classes.</h3>
      <p>Replace the horizontal padding and border spacing with the shared variable:</p>
      ${codeFigure(`  export const cardHeaderClass = (): string =>
-   'group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3';
+   'group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)';`, { lang: 'diff' })}
      <h3>Update the card content and footer spacing classes.</h3>
      <p>Use <code>--card-spacing</code> for the content inset and footer padding:</p>
      ${codeFigure(`  export const cardContentClass = (): string =>
-   'px-4 group-data-[size=sm]/card:px-3';
+   'px-(--card-spacing)';`, { lang: 'diff' })}
      ${codeFigure(`  export const cardFooterClass = (): string =>
-   'flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3';
+   'flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)';`, { lang: 'diff' })}
    </div>
    <p>After applying these changes, you can customize card spacing by setting <code>--card-spacing</code> on the card with an arbitrary property class:</p>
    ${codeFigure(`<div data-slot="card" data-size="default" class=\${cn(cardClass(), '[--card-spacing:--spacing(6)]')}>...</div>`)}
  `;
}
