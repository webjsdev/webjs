import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Context Menu docs page, ported from shadcn's
 * content/docs/components/radix/context-menu.mdx (#1666, D15): the same
 * sections in the same order, the prose rewritten where it describes React.
 */
export const demo = 'context-menu-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    <p>The context menu is a set of custom elements. Importing the module registers every <code>ui-context-menu-*</code> tag.</p>
    ${codeFigure(`import '#components/ui/context-menu.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-context-menu>
  <ui-context-menu-trigger>
    <div tabindex="0">Right click here</div>
  </ui-context-menu-trigger>
  <ui-context-menu-content>
    <ui-context-menu-item>Profile</ui-context-menu-item>
    <ui-context-menu-item>Billing</ui-context-menu-item>
    <ui-context-menu-item>Team</ui-context-menu-item>
    <ui-context-menu-item>Subscription</ui-context-menu-item>
  </ui-context-menu-content>
</ui-context-menu>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a context menu:</p>
    ${codeFigure(`ui-context-menu
├── ui-context-menu-trigger
└── ui-context-menu-content
    ├── ui-context-menu-group
    │   ├── ui-context-menu-label
    │   ├── ui-context-menu-item
    │   └── ui-context-menu-item
    ├── ui-context-menu-separator
    ├── ui-context-menu-group
    │   ├── ui-context-menu-label
    │   ├── ui-context-menu-item type="checkbox"
    │   └── ui-context-menu-item type="checkbox"
    ├── ui-context-menu-separator
    ├── ui-context-menu-group
    │   ├── ui-context-menu-label
    │   ├── ui-context-menu-item type="radio"
    │   └── ui-context-menu-item type="radio"
    └── ui-context-menu-sub
        ├── ui-context-menu-sub-trigger
        └── ui-context-menu-sub-content
            └── ui-context-menu-group
                ├── ui-context-menu-item
                └── ui-context-menu-item`, { lang: 'text' })}

    ${heading(toc, 2, 'Basic')}
    <p>A simple context menu with a few actions.</p>
    ${await componentPreview('context-menu-basic')}

    ${heading(toc, 2, 'Submenu')}
    <p>Use <code>&lt;ui-context-menu-sub&gt;</code> to nest secondary actions.</p>
    ${await componentPreview('context-menu-submenu')}

    ${heading(toc, 2, 'Shortcuts')}
    <p>Add <code>&lt;ui-context-menu-shortcut&gt;</code> to show keyboard hints.</p>
    ${await componentPreview('context-menu-shortcuts')}

    ${heading(toc, 2, 'Groups')}
    <p>Group related actions and separate them with dividers.</p>
    ${await componentPreview('context-menu-groups')}

    ${heading(toc, 2, 'Icons')}
    <p>Combine icons with labels for quick scanning.</p>
    ${await componentPreview('context-menu-icons')}

    ${heading(toc, 2, 'Checkboxes')}
    <p>Use <code>type="checkbox"</code> on an item for toggles. The <code>checked</code> attribute sets its starting state.</p>
    ${await componentPreview('context-menu-checkboxes')}

    ${heading(toc, 2, 'Radio')}
    <p>Use <code>type="radio"</code> on an item for exclusive choices. The radio items in one <code>&lt;ui-context-menu-group&gt;</code> form one set, so name the set with <code>aria-label</code> on the group.</p>
    ${await componentPreview('context-menu-radio')}

    ${heading(toc, 2, 'Destructive')}
    <p>Use <code>variant="destructive"</code> to style the menu item as destructive.</p>
    ${await componentPreview('context-menu-destructive')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('context-menu-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    <p>The context menu is the dropdown menu opened a different way: every part is a dropdown menu element under a <code>ui-context-menu-*</code> tag, with the same attributes, events and keyboard model. See the <a href="/ui/docs/components/dropdown-menu">Dropdown Menu</a> documentation for the shared parts.</p>

    ${heading(toc, 3, 'ui-context-menu')}
    <p>The root. The menu opens at the pointer on a right-click, and below the focused element on Shift+F10 or the ContextMenu key. A left click never opens it, and a click outside the panel or Escape closes it.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Member</th><th>Type</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>open</code></td><td><code>boolean</code></td><td>Reflected. Whether the menu is open.</td></tr>
          <tr><td><code>show()</code> / <code>hide()</code> / <code>toggle()</code></td><td>method</td><td>Open or close the menu from code.</td></tr>
          <tr><td><code>openAt(x, y, returnTo)</code></td><td>method</td><td>Open the menu with its corner at a point, returning focus to <code>returnTo</code> on close.</td></tr>
          <tr><td><code>ui-open-change</code></td><td>event</td><td><code>{ detail: { open } }</code> after the menu opens or closes.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-context-menu-trigger')}
    <p>Wraps the region that opens the menu. Make the region focusable (<code>tabindex="0"</code> or a focusable child) so the keyboard can open the menu, and put each command somewhere a keyboard or touch user reaches without a right-click.</p>

    ${heading(toc, 3, 'ui-context-menu-content')}
    <p>The menu panel, a <code>role="menu"</code> named "Context menu" unless you give it an <code>aria-label</code>. A class written on it lands on the panel.</p>

    ${heading(toc, 3, 'ui-context-menu-item')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"default" | "destructive"</code></td><td><code>"default"</code></td></tr>
          <tr><td><code>inset</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>type</code></td><td><code>"checkbox" | "radio"</code></td><td>-</td></tr>
          <tr><td><code>checked</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>value</code></td><td><code>string</code></td><td>-</td></tr>
          <tr><td><code>data-disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>Activating an item dispatches a cancelable <code>ui-item-select</code> event with <code>{ detail: { value, item, type, checked } }</code>. Calling <code>preventDefault()</code> keeps the menu open.</p>

    ${heading(toc, 3, 'Other parts')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Element</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>&lt;ui-context-menu-group&gt;</code></td><td>Groups items. Radio items in one group form one set, named by the group's <code>aria-label</code>.</td></tr>
          <tr><td><code>&lt;ui-context-menu-label&gt;</code></td><td>A heading for a group. Takes <code>inset</code>.</td></tr>
          <tr><td><code>&lt;ui-context-menu-separator&gt;</code></td><td>A divider between groups.</td></tr>
          <tr><td><code>&lt;ui-context-menu-shortcut&gt;</code></td><td>A keyboard hint at the end of an item.</td></tr>
          <tr><td><code>&lt;ui-context-menu-sub&gt;</code></td><td>A sub-menu, holding a sub-trigger and sub-content.</td></tr>
          <tr><td><code>&lt;ui-context-menu-sub-trigger&gt;</code></td><td>The item that opens a sub-menu. Takes <code>inset</code> and <code>data-disabled</code>.</td></tr>
          <tr><td><code>&lt;ui-context-menu-sub-content&gt;</code></td><td>The sub-menu panel, named by its sub-trigger.</td></tr>
        </tbody>
      </table>
    </div>
  `;
}
