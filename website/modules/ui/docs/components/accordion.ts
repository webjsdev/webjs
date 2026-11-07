import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Accordion docs page, ported from shadcn's
 * content/docs/components/radix/accordion.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'accordion-demo';

const PREVIEW = { align: 'start', previewClass: '*:data-[slot=accordion]:max-w-sm h-[300px]' } as const;

export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  accordionClass,
  accordionItemClass,
  accordionTriggerClass,
  accordionContentClass,
} from '#components/ui/accordion.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="accordion" class=\${accordionClass()}>
  <details name="faq" data-slot="accordion-item" class=\${accordionItemClass()} open>
    <summary data-slot="accordion-trigger" class=\${accordionTriggerClass()}>Is it accessible?</summary>
    <div data-slot="accordion-content" class=\${accordionContentClass()}>
      Yes. It adheres to the WAI-ARIA design pattern.
    </div>
  </details>
</div>`, { lineNumbers: true })}
    <p>The accordion is built on the native <code>&lt;details&gt;</code> and <code>&lt;summary&gt;</code> elements, so it opens and closes with no JavaScript. Giving every item the same <code>name</code> makes them exclusive, so only one is open at a time, and clicking the open item closes it. Add <code>open</code> to the item that should render expanded.</p>

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build an accordion:</p>
    ${codeFigure(`accordionClass()
├── accordionItemClass()
│   ├── accordionTriggerClass()
│   └── accordionContentClass()
└── accordionItemClass()
    ├── accordionTriggerClass()
    └── accordionContentClass()`, { lang: 'text' })}

    ${heading(toc, 2, 'Basic')}
    <p>A basic accordion that shows one item at a time. The first item is open by default.</p>
    ${await componentPreview('accordion-basic', PREVIEW)}

    ${heading(toc, 2, 'Multiple')}
    <p>Leave out the <code>name</code> attribute to allow multiple items to be open at the same time.</p>
    ${await componentPreview('accordion-multiple', { ...PREVIEW, previewClass: '*:data-[slot=accordion]:max-w-sm h-[36rem] md:h-[30rem]' })}

    ${heading(toc, 2, 'Disabled')}
    <p>To disable an item, use <code>accordionTriggerClass({ disabled: true })</code> for the disabled look and add <code>inert</code> to the item so it cannot be focused or opened.</p>
    ${await componentPreview('accordion-disabled', PREVIEW)}

    ${heading(toc, 2, 'Borders')}
    <p>Add <code>border</code> to the accordion and <code>border-b last:border-b-0</code> to each item to add borders to the items.</p>
    ${await componentPreview('accordion-borders', { ...PREVIEW, previewClass: '*:data-[slot=accordion]:max-w-sm h-96 md:h-80' })}

    ${heading(toc, 2, 'Card')}
    <p>Put the accordion inside a <a href="/ui/docs/components/card">Card</a>.</p>
    ${await componentPreview('accordion-card', { ...PREVIEW, previewClass: '*:data-[slot=accordion]:max-w-sm h-[32rem] md:h-[28rem]' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('accordion-rtl', { align: 'start', direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    <p>Every part is a class helper you put on a native element. The browser supplies the button semantics, the expanded state and the keyboard handling.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Helper</th><th>Element</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td><code>accordionClass()</code></td><td><code>&lt;div&gt;</code></td><td>The root wrapper. <code>data-slot="accordion"</code>.</td></tr>
          <tr><td><code>accordionItemClass()</code></td><td><code>&lt;details&gt;</code></td><td>One item. A shared <code>name</code> makes the items exclusive, <code>open</code> expands it on first paint, and <code>inert</code> disables it.</td></tr>
          <tr><td><code>accordionTriggerClass()</code></td><td><code>&lt;summary&gt;</code></td><td>The heading that toggles the item. Put the classes on the <code>&lt;summary&gt;</code> itself, never on a button inside it.</td></tr>
          <tr><td><code>accordionContentClass()</code></td><td><code>&lt;div&gt;</code></td><td>The panel, hidden by the browser while the item is closed.</td></tr>
        </tbody>
      </table>
    </div>
    ${heading(toc, 3, 'accordionTriggerClass')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>To open or close an item from script, set its <code>open</code> property. See <a href="https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details">the details element on MDN</a> for more information.</p>
  `;
}
