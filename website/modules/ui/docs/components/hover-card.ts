import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Hover Card docs page body, ported from shadcn's
 * content/docs/components/radix/hover-card.mdx (#1666, D15): the same
 * sections in the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'hover-card-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import '#components/ui/hover-card.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-hover-card>
  <ui-hover-card-trigger>
    <a href="https://nextjs.org">Hover</a>
  </ui-hover-card-trigger>
  <ui-hover-card-content>
    The React Framework – created and maintained by @vercel.
  </ui-hover-card-content>
</ui-hover-card>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a hover card:</p>
    ${codeFigure(`ui-hover-card
├── ui-hover-card-trigger
└── ui-hover-card-content`, { lang: 'text' })}

    ${heading(toc, 2, 'Trigger Delays')}
    <p>Use <code>open-delay</code> and <code>close-delay</code> on <code>&lt;ui-hover-card&gt;</code> to control when the card opens and closes.</p>
    ${codeFigure(`<ui-hover-card open-delay="100" close-delay="200">
  <ui-hover-card-trigger><a href="#">Hover</a></ui-hover-card-trigger>
  <ui-hover-card-content>Content</ui-hover-card-content>
</ui-hover-card>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Positioning')}
    <p>Use the <code>side</code> and <code>align</code> attributes on <code>&lt;ui-hover-card-content&gt;</code> to control placement.</p>
    ${codeFigure(`<ui-hover-card>
  <ui-hover-card-trigger><a href="#">Hover</a></ui-hover-card-trigger>
  <ui-hover-card-content side="top" align="start">
    Content
  </ui-hover-card-content>
</ui-hover-card>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Basic')}
    ${await componentPreview('hover-card-demo', { previewClass: 'h-80' })}

    ${heading(toc, 2, 'Sides')}
    ${await componentPreview('hover-card-sides', { previewClass: 'h-[22rem]' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('hover-card-rtl', { direction: 'rtl', previewClass: 'h-80' })}

    ${heading(toc, 2, 'API Reference')}
    <p>The card is a native <code>popover="manual"</code> element in the top layer, positioned against its trigger. The trigger opens it on hover and on focus, and Escape dismisses it. On a device with no hover the card opens on a tap and closes on an outside tap.</p>

    ${heading(toc, 3, 'ui-hover-card')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>open</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>open-delay</code></td><td><code>number</code> (ms)</td><td><code>700</code></td></tr>
          <tr><td><code>close-delay</code></td><td><code>number</code> (ms)</td><td><code>300</code></td></tr>
        </tbody>
      </table>
    </div>
    <p><code>open</code> is reflected, so CSS and scripts can observe it. The element dispatches no events, and has <code>.show()</code> and <code>.hide()</code> methods.</p>

    ${heading(toc, 3, 'ui-hover-card-trigger')}
    <p>Wraps the link or button the card describes. It carries <code>aria-haspopup</code>, <code>aria-expanded</code> and <code>aria-controls</code>.</p>

    ${heading(toc, 3, 'ui-hover-card-content')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>side</code></td><td><code>"top" | "right" | "bottom" | "left"</code></td><td><code>"bottom"</code></td></tr>
          <tr><td><code>align</code></td><td><code>"start" | "center" | "end"</code></td><td><code>"center"</code></td></tr>
          <tr><td><code>side-offset</code></td><td><code>number</code></td><td><code>4</code></td></tr>
          <tr><td><code>align-offset</code></td><td><code>number</code></td><td><code>0</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>The panel is a <code>role="dialog"</code> and always has a name: an <code>aria-label</code> or <code>aria-labelledby</code> you put on it, else a <code>data-slot="hover-card-title"</code> node or heading inside it, else the trigger's text.</p>
  `;
}
