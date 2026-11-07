import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Navigation Menu docs page, ported from shadcn's
 * content/docs/components/radix/navigation-menu.mdx (#1666, D15): the same
 * sections in the same order, the prose rewritten where it describes React.
 */
export const demo = 'navigation-menu-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import '#components/ui/navigation-menu.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-navigation-menu>
  <ui-navigation-menu-list>
    <ui-navigation-menu-item>
      <ui-navigation-menu-trigger>Item One</ui-navigation-menu-trigger>
      <ui-navigation-menu-content>
        <ui-navigation-menu-link href="/docs">Link</ui-navigation-menu-link>
      </ui-navigation-menu-content>
    </ui-navigation-menu-item>
  </ui-navigation-menu-list>
</ui-navigation-menu>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a navigation menu:</p>
    ${codeFigure(`ui-navigation-menu
├── ui-navigation-menu-list
│   ├── ui-navigation-menu-item
│   │   ├── ui-navigation-menu-trigger
│   │   └── ui-navigation-menu-content
│   │       ├── ui-navigation-menu-link
│   │       └── ui-navigation-menu-link
│   └── ui-navigation-menu-item
│       └── ui-navigation-menu-link
└── ui-navigation-menu-indicator`, { lang: 'text' })}

    ${heading(toc, 2, 'Link Component')}
    <p>A link that sits in the bar beside the triggers is your own <code>&lt;a&gt;</code> with the link and trigger classes, so the client router, a <code>data-no-router</code> opt-out, or any other attribute goes straight on it.</p>
    ${codeFigure(`import { cn } from '#lib/utils/cn.ts';
import {
  navigationMenuLinkClass,
  navigationMenuTriggerStyle,
} from '#components/ui/navigation-menu.ts';

export function NavigationMenuDocsLink() {
  return html\`
    <ui-navigation-menu-item>
      <a
        href="/docs"
        data-slot="navigation-menu-link"
        class=\${cn(navigationMenuLinkClass(), navigationMenuTriggerStyle())}
      >
        Documentation
      </a>
    </ui-navigation-menu-item>
  \`;
}`, { lineNumbers: true })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('navigation-menu-rtl', { direction: 'rtl', previewClass: 'h-96', className: 'overflow-visible' })}

    ${heading(toc, 2, 'API Reference')}
    <p>The navigation menu is a set of disclosures inside a <code>&lt;nav&gt;</code>, not an ARIA menu: the panels hold ordinary links, Tab walks into an open panel, and screen readers read it as navigation. The root is named "Main" unless you give it an <code>aria-label</code>.</p>

    ${heading(toc, 3, 'ui-navigation-menu')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>value</code></td><td><code>string</code></td><td><code>""</code></td></tr>
          <tr><td><code>viewport</code></td><td><code>"false"</code></td><td>none</td></tr>
          <tr><td><code>delay-duration</code></td><td><code>number</code></td><td><code>200</code></td></tr>
          <tr><td><code>skip-delay-duration</code></td><td><code>number</code></td><td><code>300</code></td></tr>
        </tbody>
      </table>
    </div>
    <p><code>value</code> reflects the open item's value, and is empty when none is open. By default the open panel shows in one frame under the whole list. With <code>viewport="false"</code> each panel opens under its own trigger instead.</p>

    ${heading(toc, 3, 'ui-navigation-menu-item')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>value</code></td><td><code>string</code></td><td>its position</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-navigation-menu-link')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>href</code></td><td><code>string</code></td><td><code>""</code></td></tr>
          <tr><td><code>active</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    <p><code>active</code> marks the link for the page being shown with <code>aria-current="page"</code>.</p>

    ${heading(toc, 3, 'Class helpers')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Helper</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>navigationMenuTriggerStyle()</code></td><td>The trigger's classes, for a link that sits in the bar beside the triggers. Takes an optional <code>{ className }</code> to merge.</td></tr>
          <tr><td><code>navigationMenuLinkClass()</code></td><td>A link's classes, for your own <code>&lt;a data-slot="navigation-menu-link"&gt;</code>.</td></tr>
        </tbody>
      </table>
    </div>
  `;
}
