import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Toggle Group docs page, ported from shadcn's
 * content/docs/components/radix/toggle-group.mdx (#1666, D15): the same
 * sections in the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'toggle-group-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import '#components/ui/toggle-group.ts';`)}
    ${codeFigure(`<ui-toggle-group type="single">
  <ui-toggle-group-item value="a">A</ui-toggle-group-item>
  <ui-toggle-group-item value="b">B</ui-toggle-group-item>
  <ui-toggle-group-item value="c">C</ui-toggle-group-item>
</ui-toggle-group>`, { lang: 'html' })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a <code>&lt;ui-toggle-group&gt;</code>:</p>
    ${codeFigure(`ui-toggle-group
├── ui-toggle-group-item
└── ui-toggle-group-item`, { lang: 'text' })}

    ${heading(toc, 2, 'Outline')}
    <p>Use <code>variant="outline"</code> for an outline style.</p>
    ${await componentPreview('toggle-group-outline')}

    ${heading(toc, 2, 'Size')}
    <p>Use the <code>size</code> attribute to change the size of the toggle group.</p>
    ${await componentPreview('toggle-group-sizes')}

    ${heading(toc, 2, 'Spacing')}
    <p>Use <code>spacing</code> to add spacing between toggle group items. In the kit any value other than <code>"0"</code> separates the items with the same gap.</p>
    ${await componentPreview('toggle-group-spacing')}

    ${heading(toc, 2, 'Vertical')}
    <p>Use <code>orientation="vertical"</code> for vertical toggle groups.</p>
    ${await componentPreview('toggle-group-vertical')}

    ${heading(toc, 2, 'Disabled')}
    <p>The group has no <code>disabled</code> attribute of its own. Put <code>disabled</code> on each item instead: a disabled item refuses clicks and is skipped by the arrow keys.</p>
    ${await componentPreview('toggle-group-disabled')}

    ${heading(toc, 2, 'Custom')}
    <p>A custom toggle group example.</p>
    ${await componentPreview('toggle-group-font-weight-selector', { previewClass: '*:data-[slot=field]:max-w-xs' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('toggle-group-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'ui-toggle-group')}
    <p>The group. It owns the selection and reflects it onto its items, and it is a single Tab stop: the arrow keys move between items, Home and End jump to the first and last.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>type</code></td><td><code>"single" | "multiple"</code></td><td><code>"single"</code></td></tr>
          <tr><td><code>value</code></td><td><code>string</code>, comma separated when <code>type="multiple"</code></td><td><code>""</code></td></tr>
          <tr><td><code>variant</code></td><td><code>"default" | "outline"</code></td><td><code>"default"</code></td></tr>
          <tr><td><code>size</code></td><td><code>"default" | "sm" | "lg"</code></td><td><code>"default"</code></td></tr>
          <tr><td><code>spacing</code></td><td><code>string</code>, <code>"0"</code> for joined items</td><td><code>"0"</code></td></tr>
          <tr><td><code>orientation</code></td><td><code>"horizontal" | "vertical"</code></td><td><code>"horizontal"</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>It dispatches <code>ui-value-change</code> with <code>{ detail: { value } }</code> after the selection changes.</p>

    ${heading(toc, 3, 'ui-toggle-group-item')}
    <p>One item, styled like a <a href="/ui/docs/components/toggle">Toggle</a>. An icon-only item needs an <code>aria-label</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>value</code></td><td><code>string</code></td><td><code>""</code></td></tr>
          <tr><td><code>pressed</code></td><td><code>boolean</code>, set by the group</td><td><code>false</code></td></tr>
          <tr><td><code>disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 2, 'Changelog')}
    ${heading(toc, 3, '2026-05-17 Default Spacing')}
    <p>The default spacing is now <code>2</code>, so toggle groups render with space between items. With <code>spacing</code> left out the style decides: every style but new-york gaps the items by 2 spacing units, and new-york joins them. Set <code>spacing="0"</code> to join the items in any style.</p>
  `;
}
