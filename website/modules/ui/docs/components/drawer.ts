import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Drawer docs page body, ported from shadcn's
 * content/docs/components/radix/drawer.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React and vaul.
 */
/** The demo shown above the Installation section. */
export const demo = 'drawer-demo';

/** The About section, which shadcn places before Installation. */
export async function intro(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'About')}
    <p>Drawer is built on the native <code>&lt;dialog&gt;</code> element, the same base as the <a href="/ui/docs/components/sheet">Sheet</a>: focus trap, Escape and backdrop close, focus restoration and scroll lock come from the platform. The drag handle and drag-to-dismiss run on Pointer Events, with no library.</p>
  `;
}

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  drawerHeaderClass,
  drawerTitleClass,
  drawerDescriptionClass,
  drawerFooterClass,
} from '#components/ui/drawer.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-drawer>
  <ui-drawer-trigger>
    <button type="button" class=\${buttonClass({ variant: 'outline' })}>Open</button>
  </ui-drawer-trigger>
  <ui-drawer-content>
    <div data-slot="drawer-header" class=\${drawerHeaderClass()}>
      <h2 data-slot="drawer-title" class=\${drawerTitleClass()}>Are you absolutely sure?</h2>
      <p data-slot="drawer-description" class=\${drawerDescriptionClass()}>This action cannot be undone.</p>
    </div>
    <div data-slot="drawer-footer" class=\${drawerFooterClass()}>
      <button type="button" class=\${buttonClass()}>Submit</button>
      <ui-drawer-close>
        <button type="button" class=\${buttonClass({ variant: 'outline' })}>Cancel</button>
      </ui-drawer-close>
    </div>
  </ui-drawer-content>
</ui-drawer>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a drawer:</p>
    ${codeFigure(`ui-drawer
├── ui-drawer-trigger
└── ui-drawer-content
    ├── drawerHeaderClass()
    │   ├── drawerTitleClass()
    │   └── drawerDescriptionClass()
    └── drawerFooterClass()`, { lang: 'text' })}

    ${heading(toc, 2, 'Scrollable Content')}
    <p>Keep actions visible while the content scrolls.</p>
    ${await componentPreview('drawer-scrollable-content')}

    ${heading(toc, 2, 'Sides')}
    <p>Use the <code>direction</code> attribute on <code>&lt;ui-drawer-content&gt;</code> to set the side of the drawer. Available options are <code>top</code>, <code>right</code>, <code>bottom</code>, and <code>left</code>.</p>
    ${await componentPreview('drawer-sides')}

    ${heading(toc, 2, 'Responsive Dialog')}
    <p>You can combine the Dialog and Drawer components to create a responsive dialog. This renders a Dialog on desktop and a Drawer on mobile. There is no media-query hook: both are in the page, and a breakpoint class shows one trigger and hides the other, so the first paint is already the right one.</p>
    ${await componentPreview('drawer-dialog')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('drawer-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    <p>The drawer is a native <code>&lt;dialog&gt;</code> opened with <code>showModal()</code>, so it traps focus, closes on Escape and on the backdrop, returns focus to the trigger and locks page scroll. On top of that it adds a drag handle and drag-to-dismiss on Pointer Events, with no library: releasing the panel past a quarter of its size, or with a quick flick toward its edge, closes it. A drag never starts on a control inside the panel.</p>

    ${heading(toc, 3, 'ui-drawer')}
    <p>The root. It tracks the open state.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>open</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>It dispatches <code>ui-open-change</code> with <code>{ detail: { open } }</code> after the drawer opens or closes, and has <code>.show()</code>, <code>.hide()</code> and <code>.toggle()</code> methods.</p>

    ${heading(toc, 3, 'ui-drawer-trigger')}
    <p>Wraps the control that opens the drawer. Put a real <code>&lt;button&gt;</code> inside it.</p>

    ${heading(toc, 3, 'ui-drawer-content')}
    <p>The panel. It renders the drag handle on a bottom drawer and carries <code>data-vaul-drawer-direction</code>, the attribute the drawer styles key on. Classes you put on it are applied to the panel.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>direction</code></td><td><code>"bottom" | "top" | "left" | "right"</code></td><td><code>"bottom"</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-drawer-close')}
    <p>Wraps a control that closes the drawer. Dragging is a pointer convenience only, so put a visible close button in every drawer.</p>

    ${heading(toc, 3, 'Class helpers')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Helper</th><th>Element</th></tr></thead>
        <tbody>
          <tr><td><code>drawerHeaderClass()</code></td><td>The title and description block, <code>data-slot="drawer-header"</code>.</td></tr>
          <tr><td><code>drawerTitleClass()</code></td><td>The title, a heading marked <code>data-slot="drawer-title"</code>, which names the drawer.</td></tr>
          <tr><td><code>drawerDescriptionClass()</code></td><td>The description, marked <code>data-slot="drawer-description"</code>, which describes the drawer.</td></tr>
          <tr><td><code>drawerFooterClass()</code></td><td>The actions block, pushed to the bottom, <code>data-slot="drawer-footer"</code>.</td></tr>
        </tbody>
      </table>
    </div>
  `;
}
