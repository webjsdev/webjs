import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Dropdown Menu docs page body, ported from shadcn's
 * content/docs/components/radix/dropdown-menu.mdx (#1666, D15): the same
 * sections in the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'dropdown-menu-demo';

const table = (head: string[], rows: unknown[][]) => html`
  <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
    <table>
      <thead><tr>${head.map((h) => html`<th>${h}</th>`)}</tr></thead>
      <tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody>
    </table>
  </div>`;

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { buttonClass } from '#components/ui/button.ts';
import '#components/ui/dropdown-menu.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-dropdown-menu>
  <ui-dropdown-menu-trigger>
    <button class=\${buttonClass({ variant: 'outline' })}>Open</button>
  </ui-dropdown-menu-trigger>
  <ui-dropdown-menu-content>
    <ui-dropdown-menu-group>
      <ui-dropdown-menu-label>My Account</ui-dropdown-menu-label>
      <ui-dropdown-menu-item>Profile</ui-dropdown-menu-item>
      <ui-dropdown-menu-item>Billing</ui-dropdown-menu-item>
    </ui-dropdown-menu-group>
    <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
    <ui-dropdown-menu-group>
      <ui-dropdown-menu-item>Team</ui-dropdown-menu-item>
      <ui-dropdown-menu-item>Subscription</ui-dropdown-menu-item>
    </ui-dropdown-menu-group>
  </ui-dropdown-menu-content>
</ui-dropdown-menu>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a dropdown menu:</p>
    ${codeFigure(`ui-dropdown-menu
├── ui-dropdown-menu-trigger
└── ui-dropdown-menu-content
    ├── ui-dropdown-menu-group
    │   ├── ui-dropdown-menu-label
    │   ├── ui-dropdown-menu-item
    │   └── ui-dropdown-menu-item
    ├── ui-dropdown-menu-separator
    ├── ui-dropdown-menu-group
    │   ├── ui-dropdown-menu-label
    │   ├── ui-dropdown-menu-item type="checkbox"
    │   └── ui-dropdown-menu-item type="checkbox"
    ├── ui-dropdown-menu-separator
    ├── ui-dropdown-menu-group
    │   ├── ui-dropdown-menu-label
    │   └── ui-dropdown-menu-group aria-label
    │       ├── ui-dropdown-menu-item type="radio"
    │       └── ui-dropdown-menu-item type="radio"
    └── ui-dropdown-menu-sub
        ├── ui-dropdown-menu-sub-trigger
        └── ui-dropdown-menu-sub-content
            └── ui-dropdown-menu-group
                ├── ui-dropdown-menu-label
                ├── ui-dropdown-menu-item
                └── ui-dropdown-menu-item`, { lang: 'text' })}

    ${heading(toc, 2, 'Basic')}
    <p>A basic dropdown menu with labels and separators.</p>
    ${await componentPreview('dropdown-menu-basic')}

    ${heading(toc, 2, 'Submenu')}
    <p>Use <code>&lt;ui-dropdown-menu-sub&gt;</code> to nest secondary actions.</p>
    ${await componentPreview('dropdown-menu-submenu')}

    ${heading(toc, 2, 'Shortcuts')}
    <p>Add <code>&lt;ui-dropdown-menu-shortcut&gt;</code> to show keyboard hints.</p>
    ${await componentPreview('dropdown-menu-shortcuts')}

    ${heading(toc, 2, 'Icons')}
    <p>Combine icons with labels for quick scanning.</p>
    ${await componentPreview('dropdown-menu-icons')}

    ${heading(toc, 2, 'Checkboxes')}
    <p>Use <code>type="checkbox"</code> on an item for toggles. The item flips its own <code>checked</code> attribute when selected, so the markup only sets the initial state.</p>
    ${await componentPreview('dropdown-menu-checkboxes')}

    ${heading(toc, 2, 'Checkboxes Icons')}
    <p>Add icons to checkbox items.</p>
    ${await componentPreview('dropdown-menu-checkboxes-icons')}

    ${heading(toc, 2, 'Radio Group')}
    <p>Use <code>type="radio"</code> items inside a <code>&lt;ui-dropdown-menu-group&gt;</code> for exclusive choices. The group keeps one item checked, and its <code>aria-label</code> names the set.</p>
    ${await componentPreview('dropdown-menu-radio-group')}

    ${heading(toc, 2, 'Radio Icons')}
    <p>Show radio options with icons.</p>
    ${await componentPreview('dropdown-menu-radio-icons')}

    ${heading(toc, 2, 'Destructive')}
    <p>Use <code>variant="destructive"</code> for irreversible actions.</p>
    ${await componentPreview('dropdown-menu-destructive')}

    ${heading(toc, 2, 'Avatar')}
    <p>An account switcher dropdown triggered by an avatar.</p>
    ${await componentPreview('dropdown-menu-avatar')}

    ${heading(toc, 2, 'Complex')}
    <p>A richer example combining groups, icons, and submenus.</p>
    ${await componentPreview('dropdown-menu-complex')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('dropdown-menu-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    <p>The menu is a set of custom elements with its own keyboard navigation, focus management and positioning, following the <a href="https://www.w3.org/WAI/ARIA/apg/patterns/menu/">APG menu pattern</a>. The trigger gets <code>aria-haspopup</code>, <code>aria-expanded</code> and <code>aria-controls</code>, and every close path returns focus somewhere sensible.</p>

    ${heading(toc, 3, 'ui-dropdown-menu')}
    <p>The root. It holds the open state.</p>
    ${table(['Attribute', 'Type', 'Default'], [
      [html`<code>open</code>`, html`<code>boolean</code>`, html`<code>false</code>`],
      [html`<code>trigger</code>`, html`<code>string</code>`, '-'],
    ])}
    <p><code>trigger</code> names the id of a button to use as the trigger in place of <code>&lt;ui-dropdown-menu-trigger&gt;</code>, for a trigger that must be a direct child of something else, such as a button group. The element also has <code>.show()</code>, <code>.hide()</code> and <code>.toggle()</code> methods.</p>
    ${table(['Event', 'Detail'], [
      [html`<code>ui-open-change</code>`, html`<code>{ open }</code>, after a transition`],
      [html`<code>ui-item-select</code>`, html`<code>{ value, item, type, checked }</code>, bubbled from an item on activation`],
    ])}
    <p><code>ui-item-select</code> is cancelable. Calling <code>preventDefault()</code> keeps the menu open, which a multi-select checkbox menu wants.</p>

    ${heading(toc, 3, 'ui-dropdown-menu-trigger')}
    <p>Wraps the button that opens the menu.</p>

    ${heading(toc, 3, 'ui-dropdown-menu-content')}
    <p>The menu panel. Classes on it, such as a width, are merged with its own.</p>
    ${table(['Attribute', 'Type', 'Default'], [
      [html`<code>side</code>`, html`<code>"top" | "right" | "bottom" | "left"</code>`, html`<code>"bottom"</code>`],
      [html`<code>align</code>`, html`<code>"start" | "center" | "end"</code>`, html`<code>"start"</code>`],
      [html`<code>side-offset</code>`, html`<code>number</code>`, html`<code>4</code>`],
      [html`<code>align-offset</code>`, html`<code>number</code>`, html`<code>0</code>`],
    ])}

    ${heading(toc, 3, 'ui-dropdown-menu-item')}
    <p>One action. With <code>type="checkbox"</code> or <code>type="radio"</code> it is a checkable item, shadcn's <code>DropdownMenuCheckboxItem</code> and <code>DropdownMenuRadioItem</code>.</p>
    ${table(['Attribute', 'Type', 'Default'], [
      [html`<code>variant</code>`, html`<code>"default" | "destructive"</code>`, html`<code>"default"</code>`],
      [html`<code>inset</code>`, html`<code>boolean</code>`, html`<code>false</code>`],
      [html`<code>type</code>`, html`<code>"checkbox" | "radio"</code>`, '-'],
      [html`<code>checked</code>`, html`<code>boolean</code>`, html`<code>false</code>`],
      [html`<code>value</code>`, html`<code>string</code>`, html`<code>""</code>`],
      [html`<code>data-disabled</code>`, html`<code>boolean</code>`, html`<code>false</code>`],
    ])}
    ${codeFigure(`<ui-dropdown-menu-item type="checkbox" value="status" checked>
  Status bar
</ui-dropdown-menu-item>`)}

    ${heading(toc, 3, 'ui-dropdown-menu-group')}
    <p>Groups items. It is also the radio set: the <code>type="radio"</code> items inside the nearest group are exclusive. Name a radio set with <code>aria-label</code> or <code>aria-labelledby</code> in the markup.</p>

    ${heading(toc, 3, 'ui-dropdown-menu-label')}
    ${table(['Attribute', 'Type', 'Default'], [
      [html`<code>inset</code>`, html`<code>boolean</code>`, html`<code>false</code>`],
    ])}

    ${heading(toc, 3, 'ui-dropdown-menu-separator')}
    <p>A divider between groups.</p>

    ${heading(toc, 3, 'ui-dropdown-menu-shortcut')}
    <p>A keyboard hint, aligned to the end of the item. It documents a shortcut and does not bind one.</p>

    ${heading(toc, 3, 'ui-dropdown-menu-sub')}
    <p>A nested menu: a <code>&lt;ui-dropdown-menu-sub-trigger&gt;</code> and a <code>&lt;ui-dropdown-menu-sub-content&gt;</code>. ArrowRight on the trigger opens it and ArrowLeft closes it. The sub-trigger takes <code>inset</code> and <code>data-disabled</code>, and the sub-content takes the same placement attributes as the content, opening to the <code>right</code> by default.</p>
  `;
}
