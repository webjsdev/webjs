import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Collapsible docs page, ported from shadcn's
 * content/docs/components/radix/collapsible.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'collapsible-demo';

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
  collapsibleClass,
  collapsibleContentClass,
  collapsibleTriggerClass,
} from '#components/ui/collapsible.ts';`, { lineNumbers: true })}
    ${codeFigure(`<details data-slot="collapsible" class=\${collapsibleClass()}>
  <summary data-slot="collapsible-trigger" class=\${collapsibleTriggerClass()}>Can I use this in my project?</summary>
  <div data-slot="collapsible-content" class=\${collapsibleContentClass()}>
    Yes. Free to use for personal and commercial projects. No attribution
    required.
  </div>
</details>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a collapsible:</p>
    ${codeFigure(`collapsibleClass()           on a details element
├── collapsibleTriggerClass()  on its summary
└── collapsibleContentClass()  on a div`, { lang: 'text' })}

    ${heading(toc, 2, 'Controlled State')}
    <p>The collapsible is a native <code>&lt;details&gt;</code>, so the browser holds the state. Add the <code>open</code> attribute to render it expanded on first paint, set the <code>open</code> property to change it from code, and listen for the <code>toggle</code> event to follow it.</p>
    ${codeFigure(`<details id="faq" data-slot="collapsible" class=\${collapsibleClass()} open>
  <summary data-slot="collapsible-trigger" class=\${collapsibleTriggerClass()}>Toggle</summary>
  <div data-slot="collapsible-content" class=\${collapsibleContentClass()}>Content</div>
</details>`, { lineNumbers: true })}
    ${codeFigure(`const details = document.querySelector('#faq');

details.open = false;
details.addEventListener('toggle', () => {
  console.log(details.open ? 'open' : 'closed');
});`, { lineNumbers: true })}

    ${heading(toc, 2, 'Basic')}
    ${await componentPreview('collapsible-basic', { align: 'start' })}

    ${heading(toc, 2, 'Settings Panel')}
    <p>Use a trigger button to reveal additional settings.</p>
    ${await componentPreview('collapsible-settings')}

    ${heading(toc, 2, 'File Tree')}
    <p>Use nested collapsibles to build a file tree. In a conversation, this is the <a href="/ui/docs/ai-elements/file-tree">File Tree</a> pattern.</p>
    ${await componentPreview('collapsible-file-tree', { previewClass: 'h-[36rem]' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('collapsible-rtl', { direction: 'rtl', align: 'start' })}

    ${heading(toc, 2, 'API Reference')}
    <p>The collapsible is built on <code>&lt;details&gt;</code> and <code>&lt;summary&gt;</code>, so the browser supplies the open state, Enter and Space activation, focus and the expanded state a screen reader announces. Every part is a class helper.</p>

    ${heading(toc, 3, 'collapsibleClass')}
    <p><code>collapsibleClass()</code> is the root. It marks the <code>&lt;details&gt;</code> as a <code>group</code>, so its descendants can react to the open state with <code>group-open:</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute / Event</th><th>Type</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>open</code></td><td><code>boolean</code></td><td>Renders the collapsible expanded. Also a property you can set from code.</td></tr>
          <tr><td><code>inert</code></td><td><code>boolean</code></td><td>Stops the trigger from taking focus or toggling, for a disabled collapsible.</td></tr>
          <tr><td><code>toggle</code></td><td><code>Event</code></td><td>Fired after the open state changes.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'collapsibleTriggerClass')}
    <p><code>collapsibleTriggerClass()</code> styles the <code>&lt;summary&gt;</code> and hides the native disclosure marker, so you render your own chevron. Put the classes on the <code>&lt;summary&gt;</code> itself, never on a button inside it.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    <p><code>disabled</code> is the visual state only. Add <code>inert</code> on the <code>&lt;details&gt;</code> as well to stop it toggling.</p>

    ${heading(toc, 3, 'collapsibleContentClass')}
    <p><code>collapsibleContentClass()</code> styles the content. The browser hides it while the collapsible is closed.</p>
    ${noOptions('collapsible-content', '<div>')}
  `;
}
