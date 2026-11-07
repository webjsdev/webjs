import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Menubar docs page, ported from shadcn's
 * content/docs/components/radix/menubar.mdx (#1666, D15): the same sections
 * in the same order, the prose rewritten where it describes React.
 */
export const demo = 'menubar-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import '#components/ui/menubar.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-menubar>
  <ui-menubar-menu>
    <ui-menubar-trigger>File</ui-menubar-trigger>
    <ui-menubar-content>
      <ui-menubar-group>
        <ui-menubar-item>
          New Tab <ui-menubar-shortcut>⌘T</ui-menubar-shortcut>
        </ui-menubar-item>
        <ui-menubar-item>New Window</ui-menubar-item>
      </ui-menubar-group>
      <ui-menubar-separator></ui-menubar-separator>
      <ui-menubar-group>
        <ui-menubar-item>Share</ui-menubar-item>
        <ui-menubar-item>Print</ui-menubar-item>
      </ui-menubar-group>
    </ui-menubar-content>
  </ui-menubar-menu>
</ui-menubar>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a menubar:</p>
    ${codeFigure(`ui-menubar
├── ui-menubar-menu
│   ├── ui-menubar-trigger
│   └── ui-menubar-content
│       ├── ui-menubar-group
│       │   ├── ui-menubar-label
│       │   ├── ui-menubar-item
│       │   └── ui-menubar-item
│       ├── ui-menubar-separator
│       ├── ui-menubar-group
│       │   ├── ui-menubar-label
│       │   ├── ui-menubar-item type="checkbox"
│       │   └── ui-menubar-item type="checkbox"
│       ├── ui-menubar-separator
│       ├── ui-menubar-group
│       │   ├── ui-menubar-label
│       │   ├── ui-menubar-item type="radio"
│       │   └── ui-menubar-item type="radio"
│       └── ui-menubar-sub
│           ├── ui-menubar-sub-trigger
│           └── ui-menubar-sub-content
│               └── ui-menubar-group
│                   ├── ui-menubar-label
│                   ├── ui-menubar-item
│                   └── ui-menubar-item
└── ui-menubar-menu
    ├── ui-menubar-trigger
    └── ui-menubar-content
        └── ui-menubar-group
            ├── ui-menubar-label
            ├── ui-menubar-item
            └── ui-menubar-item`, { lang: 'text' })}

    ${heading(toc, 2, 'Checkbox')}
    <p>Use <code>type="checkbox"</code> on a <code>&lt;ui-menubar-item&gt;</code> for toggleable options, and <code>checked</code> for the initial state.</p>
    ${await componentPreview('menubar-checkbox')}

    ${heading(toc, 2, 'Radio')}
    <p>Use <code>type="radio"</code> items with a <code>value</code> inside a <code>&lt;ui-menubar-group&gt;</code> for single-select options. Name the set with <code>aria-label</code> on the group.</p>
    ${await componentPreview('menubar-radio')}

    ${heading(toc, 2, 'Submenu')}
    <p>Use <code>&lt;ui-menubar-sub&gt;</code>, <code>&lt;ui-menubar-sub-trigger&gt;</code>, and <code>&lt;ui-menubar-sub-content&gt;</code> for nested menus.</p>
    ${await componentPreview('menubar-submenu')}

    ${heading(toc, 2, 'With Icons')}
    ${await componentPreview('menubar-icons')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('menubar-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    <p>The menubar is a row of dropdown menus. Each menu takes the same parts as the <a href="/ui/docs/components/dropdown-menu">Dropdown Menu</a>, under <code>ui-menubar-*</code> tags, and the bar adds the keyboard model of the WAI-ARIA menubar pattern on top: the bar is one Tab stop, ArrowLeft and ArrowRight move between the triggers and between open menus, and only one menu is open at a time.</p>

    ${heading(toc, 3, 'Elements')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Element</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>&lt;ui-menubar&gt;</code></td><td>The bar, <code>role="menubar"</code>. Give it an <code>aria-label</code> when the page has more than one.</td></tr>
          <tr><td><code>&lt;ui-menubar-menu&gt;</code></td><td>One menu: a trigger and its content.</td></tr>
          <tr><td><code>&lt;ui-menubar-trigger&gt;</code></td><td>The button that opens the menu, with <code>aria-haspopup</code>, <code>aria-expanded</code> and <code>aria-controls</code> set by the element.</td></tr>
          <tr><td><code>&lt;ui-menubar-content&gt;</code></td><td>The menu panel, <code>role="menu"</code>, named by its trigger.</td></tr>
          <tr><td><code>&lt;ui-menubar-item&gt;</code></td><td>An item. A plain action, a checkbox item, or a radio item.</td></tr>
          <tr><td><code>&lt;ui-menubar-group&gt;</code></td><td>Groups items. Wraps a radio set, named with <code>aria-label</code>.</td></tr>
          <tr><td><code>&lt;ui-menubar-label&gt;</code></td><td>A group heading.</td></tr>
          <tr><td><code>&lt;ui-menubar-separator&gt;</code></td><td>A divider between groups.</td></tr>
          <tr><td><code>&lt;ui-menubar-shortcut&gt;</code></td><td>A keyboard shortcut hint at the end of an item.</td></tr>
          <tr><td><code>&lt;ui-menubar-sub&gt;</code>, <code>&lt;ui-menubar-sub-trigger&gt;</code>, <code>&lt;ui-menubar-sub-content&gt;</code></td><td>A nested menu, its trigger item, and its panel.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-menubar-content')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>side</code></td><td><code>"top" | "right" | "bottom" | "left"</code></td><td><code>"bottom"</code></td></tr>
          <tr><td><code>align</code></td><td><code>"start" | "center" | "end"</code></td><td><code>"start"</code></td></tr>
          <tr><td><code>side-offset</code></td><td><code>number</code></td><td><code>8</code></td></tr>
          <tr><td><code>align-offset</code></td><td><code>number</code></td><td><code>-4</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-menubar-item')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"default" | "destructive"</code></td><td><code>"default"</code></td></tr>
          <tr><td><code>inset</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>type</code></td><td><code>"checkbox" | "radio"</code></td><td>none</td></tr>
          <tr><td><code>checked</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>value</code></td><td><code>string</code></td><td>none</td></tr>
          <tr><td><code>data-disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>Activating an item dispatches a bubbling, cancelable <code>ui-item-select</code> event with <code>{ value, item, type, checked }</code> in its <code>detail</code>. Call <code>preventDefault()</code> on it to keep the menu open.</p>
  `;
}
