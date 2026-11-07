import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Toggle docs page, ported from shadcn's
 * content/docs/components/radix/toggle.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'toggle-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    <p>Importing the module registers <code>&lt;ui-toggle&gt;</code>, which keeps its own pressed state.</p>
    ${codeFigure(`import '#components/ui/toggle.ts';`)}
    ${codeFigure(`<ui-toggle>Toggle</ui-toggle>`, { lang: 'html' })}

    ${heading(toc, 2, 'Outline')}
    <p>Use <code>variant="outline"</code> for an outline style.</p>
    ${await componentPreview('toggle-outline')}

    ${heading(toc, 2, 'With Text')}
    ${await componentPreview('toggle-text')}

    ${heading(toc, 2, 'Size')}
    <p>Use the <code>size</code> attribute to change the size of the toggle.</p>
    ${await componentPreview('toggle-sizes')}

    ${heading(toc, 2, 'Disabled')}
    ${await componentPreview('toggle-disabled')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('toggle-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'ui-toggle')}
    <p>A pressable on and off button. It renders a native <code>&lt;button&gt;</code> and forwards the host's <code>aria-label</code> to it, so an icon-only toggle is named on the host.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>pressed</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>variant</code></td><td><code>"default" | "outline"</code></td><td><code>"default"</code></td></tr>
          <tr><td><code>size</code></td><td><code>"default" | "sm" | "lg"</code></td><td><code>"default"</code></td></tr>
          <tr><td><code>disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>It dispatches <code>ui-pressed-change</code> with <code>{ detail: { pressed } }</code> after a click.</p>

    ${heading(toc, 3, 'toggleClass')}
    <p><code>toggleClass()</code> returns the toggle's classes for a native <code>&lt;button&gt;</code> whose pressed state you own, carried on <code>aria-pressed</code> and <code>data-state</code>. <code>toggleVariants()</code> is the same helper under shadcn's name, and it also merges a <code>className</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"default" | "outline"</code></td><td><code>"default"</code></td></tr>
          <tr><td><code>size</code></td><td><code>"default" | "sm" | "lg"</code></td><td><code>"default"</code></td></tr>
        </tbody>
      </table>
    </div>
  `;
}
