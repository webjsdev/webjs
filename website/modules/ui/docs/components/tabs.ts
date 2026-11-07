import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Tabs docs page, ported from shadcn's
 * content/docs/components/radix/tabs.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'tabs-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    <p>The tabs are custom elements. Importing the module registers them, and the page renders them by tag.</p>
    ${codeFigure(`import '#components/ui/tabs.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-tabs value="account" class="w-[400px]">
  <ui-tabs-list>
    <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
    <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
  </ui-tabs-list>
  <ui-tabs-content value="account">Make changes to your account here.</ui-tabs-content>
  <ui-tabs-content value="password">Change your password here.</ui-tabs-content>
</ui-tabs>`, { lineNumbers: true, lang: 'html' })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build <code>&lt;ui-tabs&gt;</code>:</p>
    ${codeFigure(`ui-tabs
├── ui-tabs-list
│   ├── ui-tabs-trigger
│   └── ui-tabs-trigger
├── ui-tabs-content
└── ui-tabs-content`, { lang: 'text' })}

    ${heading(toc, 2, 'Line')}
    <p>Use the <code>variant="underline"</code> attribute on <code>&lt;ui-tabs-list&gt;</code> for a line style.</p>
    ${await componentPreview('tabs-line')}

    ${heading(toc, 2, 'Vertical')}
    <p>Use <code>orientation="vertical"</code> for vertical tabs.</p>
    ${await componentPreview('tabs-vertical')}

    ${heading(toc, 2, 'Disabled')}
    <p>The kit's <code>&lt;ui-tabs-trigger&gt;</code> has no <code>disabled</code> attribute yet, so the trigger below still selects its tab when clicked.</p>
    ${await componentPreview('tabs-disabled')}

    ${heading(toc, 2, 'Icons')}
    ${await componentPreview('tabs-icons')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('tabs-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'ui-tabs')}
    <p>The root. It owns the selected value and the orientation, and its triggers and panels read both from it.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>value</code></td><td><code>string</code></td><td><code>""</code></td></tr>
          <tr><td><code>orientation</code></td><td><code>"horizontal" | "vertical"</code></td><td><code>"horizontal"</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>It dispatches <code>ui-value-change</code> with <code>{ detail: { value } }</code> after the selected tab changes.</p>

    ${heading(toc, 3, 'ui-tabs-list')}
    <p>The tablist. Arrow keys move focus and selection between its triggers, and Home and End jump to the first and last.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"default" | "underline"</code></td><td><code>"default"</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-tabs-trigger')}
    <p>One tab, rendered as a native <code>&lt;button role="tab"&gt;</code>. An icon-only trigger needs an <code>aria-label</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>value</code></td><td><code>string</code></td><td><code>""</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-tabs-content')}
    <p>The panel shown while the trigger with the same <code>value</code> is selected. An inactive panel is <code>hidden</code> and <code>inert</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>value</code></td><td><code>string</code></td><td><code>""</code></td></tr>
        </tbody>
      </table>
    </div>
  `;
}
