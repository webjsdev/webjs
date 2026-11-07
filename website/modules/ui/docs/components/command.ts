import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Command docs page, ported from shadcn's
 * content/docs/components/radix/command.mdx (#1666, D15): the same sections
 * in the same order, the prose rewritten where it describes React or cmdk.
 */
export const demo = 'command-demo';

/** Between the lead demo and Installation. */
export async function intro(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'About')}
    <p>The <code>&lt;ui-command&gt;</code> element follows the model of <a href="https://github.com/dip/cmdk">cmdk</a> by <a href="https://www.dip.org/">Dip</a>, built on the platform with no dependency: typing in the input filters and ranks the items, the arrow keys move the selection while focus stays in the input, and Enter runs the selected item.</p>
  `;
}

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import '#components/ui/command.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-command label="Command menu" class="max-w-sm rounded-lg border">
  <ui-command-input placeholder="Type a command or search..."></ui-command-input>
  <ui-command-list>
    <ui-command-empty>No results found.</ui-command-empty>
    <ui-command-group heading="Suggestions">
      <ui-command-item>Calendar</ui-command-item>
      <ui-command-item>Search Emoji</ui-command-item>
      <ui-command-item>Calculator</ui-command-item>
    </ui-command-group>
    <ui-command-separator></ui-command-separator>
    <ui-command-group heading="Settings">
      <ui-command-item>Profile</ui-command-item>
      <ui-command-item>Billing</ui-command-item>
      <ui-command-item>Settings</ui-command-item>
    </ui-command-group>
  </ui-command-list>
</ui-command>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a command:</p>
    ${codeFigure(`ui-command
├── ui-command-input
└── ui-command-list
    ├── ui-command-empty
    ├── ui-command-group
    │   ├── ui-command-item
    │   └── ui-command-item
    ├── ui-command-separator
    └── ui-command-group
        ├── ui-command-item
        └── ui-command-item`, { lang: 'text' })}

    ${heading(toc, 2, 'Basic')}
    <p>A simple command menu in a dialog. It is a <a href="/ui/docs/components/dialog">Dialog</a> whose content takes <code>commandDialogClass()</code> and holds the command, with its title and description for screen readers only.</p>
    ${await componentPreview('command-basic')}

    ${heading(toc, 2, 'Shortcuts')}
    ${await componentPreview('command-shortcuts')}

    ${heading(toc, 2, 'Groups')}
    <p>A command menu with groups, icons and separators.</p>
    ${await componentPreview('command-groups')}

    ${heading(toc, 2, 'Scrollable')}
    <p>Scrollable command menu with multiple items.</p>
    ${await componentPreview('command-scrollable')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('command-rtl', { direction: 'rtl', align: 'start', previewClass: 'h-[24.5rem]' })}

    ${heading(toc, 2, 'API Reference')}
    <p>The command follows cmdk's model, built on the platform: typing in the input filters and ranks the items, the arrow keys move a selection while focus stays in the input, and Enter runs the selected item.</p>

    ${heading(toc, 3, 'Elements')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Element</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>&lt;ui-command&gt;</code></td><td>The root. Holds the search and the selection.</td></tr>
          <tr><td><code>&lt;ui-command-input&gt;</code></td><td>The search field, a <code>role="combobox"</code> input that keeps focus and points at the selected item through <code>aria-activedescendant</code>.</td></tr>
          <tr><td><code>&lt;ui-command-list&gt;</code></td><td>The <code>role="listbox"</code> holding the groups and items.</td></tr>
          <tr><td><code>&lt;ui-command-empty&gt;</code></td><td>Shown when nothing matches the search.</td></tr>
          <tr><td><code>&lt;ui-command-group&gt;</code></td><td>A group of items under a heading, hidden when none of its items match.</td></tr>
          <tr><td><code>&lt;ui-command-item&gt;</code></td><td>One action, a <code>role="option"</code> carrying <code>data-selected="true"</code> while selected.</td></tr>
          <tr><td><code>&lt;ui-command-shortcut&gt;</code></td><td>A keyboard shortcut hint at the end of an item.</td></tr>
          <tr><td><code>&lt;ui-command-separator&gt;</code></td><td>A divider between groups, hidden while a search runs.</td></tr>
          <tr><td><code>&lt;ui-command-dialog&gt;</code></td><td>A <code>&lt;ui-command&gt;</code> in a native modal dialog, with a screen-reader title and description. It has no trigger part, so open it with <code>show()</code>, or compose a Dialog as the demos above do.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-command')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>label</code></td><td><code>string</code>, the name a screen reader reads</td><td>-</td></tr>
          <tr><td><code>should-filter</code></td><td><code>"true" | "false"</code></td><td><code>"true"</code></td></tr>
          <tr><td><code>loop</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>value</code></td><td><code>string</code>, the selected item's value, reflected</td><td>-</td></tr>
        </tbody>
      </table>
    </div>
    <p><code>should-filter="false"</code> leaves filtering to you, for a list a server action returns.</p>

    ${heading(toc, 3, 'ui-command-input')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>placeholder</code></td><td><code>string</code></td><td>-</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-command-group')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>heading</code></td><td><code>string</code></td><td>-</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-command-item')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>value</code></td><td><code>string</code></td><td>The item's text</td></tr>
          <tr><td><code>keywords</code></td><td><code>string</code>, space separated, matched by the search</td><td>-</td></tr>
          <tr><td><code>disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>An item that holds a link follows it when it runs.</p>

    ${heading(toc, 3, 'ui-command-dialog')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>open</code></td><td><code>boolean</code>, reflected</td><td><code>false</code></td></tr>
          <tr><td><code>title</code></td><td><code>string</code></td><td><code>"Command Palette"</code></td></tr>
          <tr><td><code>description</code></td><td><code>string</code></td><td><code>"Search for a command to run..."</code></td></tr>
          <tr><td><code>show-close-button</code></td><td><code>"true" | "false"</code></td><td><code>"false"</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'Events')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Event</th><th>Detail</th><th>Fires</th></tr></thead>
        <tbody>
          <tr><td><code>ui-select</code></td><td><code>{ value: string }</code></td><td>On the item, when it runs (Enter or a click). Cancelable: cancel it to stop a link inside the item from being followed.</td></tr>
          <tr><td><code>ui-value-change</code></td><td><code>{ value: string }</code></td><td>On <code>&lt;ui-command&gt;</code>, as the selection moves.</td></tr>
          <tr><td><code>ui-search-change</code></td><td><code>{ search: string }</code></td><td>On <code>&lt;ui-command&gt;</code>, as the search text changes.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'Keyboard')}
    <p>ArrowDown and ArrowUp (and Ctrl+N / Ctrl+P, Ctrl+J / Ctrl+K) move the selection, <code>loop</code> wraps it, Home and End jump to the ends, and Enter runs the selected item. Pointing at an item selects it.</p>
  `;
}
