import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * The Resizable docs page, ported from shadcn's
 * content/docs/components/radix/resizable.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'resizable-demo';

/** The About section, before Installation. */
export async function intro(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'About')}
    <p>The Resizable component is built on flex shares and Pointer Events, with no library. The server renders each panel's default size, so the layout is in the first paint, and the handles follow the WAI-ARIA window splitter pattern for the keyboard.</p>
  `;
}

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import '#components/ui/resizable.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-resizable-panel-group orientation="horizontal">
  <ui-resizable-panel>One</ui-resizable-panel>
  <ui-resizable-handle></ui-resizable-handle>
  <ui-resizable-panel>Two</ui-resizable-panel>
</ui-resizable-panel-group>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a <code>&lt;ui-resizable-panel-group&gt;</code>:</p>
    ${codeFigure(`ui-resizable-panel-group
├── ui-resizable-panel
├── ui-resizable-handle
└── ui-resizable-panel`, { lang: 'text' })}

    ${heading(toc, 2, 'Vertical')}
    <p>Use <code>orientation="vertical"</code> for vertical resizing.</p>
    ${await componentPreview('resizable-vertical')}

    ${heading(toc, 2, 'Handle')}
    <p>Use the <code>with-handle</code> attribute on <code>&lt;ui-resizable-handle&gt;</code> to show a visible handle.</p>
    ${await componentPreview('resizable-handle')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('resizable-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    <p>Sizes are percentages. The layout renders without JavaScript, and resizing needs it.</p>
    ${heading(toc, 3, 'ui-resizable-panel-group')}
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
        <thead><tr><th>Event</th><th>Detail</th></tr></thead>
        <tbody>
          <tr><td><code>ui-layout-change</code></td><td><code>{ sizes: number[] }</code>, percentages in panel order</td></tr>
        </tbody>
      </table>
    </div>
    ${heading(toc, 3, 'ui-resizable-panel')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>default-size</code></td><td><code>number</code> (percent)</td><td>an equal share of what is left</td></tr>
          <tr><td><code>min-size</code></td><td><code>number</code> (percent)</td><td>-</td></tr>
          <tr><td><code>max-size</code></td><td><code>number</code> (percent)</td><td>-</td></tr>
        </tbody>
      </table>
    </div>
    <p>Give every panel a <code>default-size</code> for an exact server-rendered first paint.</p>
    ${heading(toc, 3, 'ui-resizable-handle')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>with-handle</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>A handle is a focusable <code>role="separator"</code> (the WAI-ARIA window splitter). The arrow keys across the group move it 10 points, with Left and Right swapped under <code>dir="rtl"</code>, and Home and End move it as far as the panel before it allows.</p>

    ${heading(toc, 2, 'Changelog')}
    ${heading(toc, 3, 'react-resizable-panels v4 names')}
    <p>shadcn moved to react-resizable-panels v4 on 2025-02-02. The kit does not use that library, but its attributes follow the v4 names:</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>react-resizable-panels v4</th><th>Kit</th></tr></thead>
        <tbody>
          <tr><td><code>Group</code></td><td><code>&lt;ui-resizable-panel-group&gt;</code></td></tr>
          <tr><td><code>Separator</code></td><td><code>&lt;ui-resizable-handle&gt;</code></td></tr>
          <tr><td><code>orientation</code> prop</td><td><code>orientation</code> attribute</td></tr>
          <tr><td><code>defaultSize="50%"</code></td><td><code>default-size="50"</code></td></tr>
          <tr><td><code>onLayoutChange</code></td><td><code>ui-layout-change</code> event</td></tr>
          <tr><td><code>aria-orientation</code></td><td><code>aria-orientation</code></td></tr>
        </tbody>
      </table>
    </div>
    ${callout(html`The element names (<code>&lt;ui-resizable-panel-group&gt;</code>, <code>&lt;ui-resizable-panel&gt;</code>, <code>&lt;ui-resizable-handle&gt;</code>) match shadcn's wrapper components, which remain unchanged.`)}
  `;
}
