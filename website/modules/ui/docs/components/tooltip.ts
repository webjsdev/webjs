import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Tooltip docs page, ported from shadcn's
 * content/docs/components/radix/tooltip.mdx (#1666, D15): the same sections
 * in the same order, the prose rewritten where it describes React. The kit
 * needs no TooltipProvider, so shadcn's provider step has no counterpart.
 */
/** The demo shown above the Installation section. */
export const demo = 'tooltip-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    <p>Importing the module registers the tooltip elements. There is no provider to add: each tooltip keeps its own delay, and the short skip window after one closes is shared across the page.</p>
    ${codeFigure(`import '#components/ui/tooltip.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-tooltip>
  <ui-tooltip-trigger>
    <button>Hover</button>
  </ui-tooltip-trigger>
  <ui-tooltip-content>
    <p>Add to library</p>
  </ui-tooltip-content>
</ui-tooltip>`, { lineNumbers: true, lang: 'html' })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a <code>&lt;ui-tooltip&gt;</code>:</p>
    ${codeFigure(`ui-tooltip
├── ui-tooltip-trigger
└── ui-tooltip-content`, { lang: 'text' })}

    ${heading(toc, 2, 'Side')}
    <p>Use the <code>side</code> attribute on <code>&lt;ui-tooltip-content&gt;</code> to change the position of the tooltip.</p>
    ${await componentPreview('tooltip-sides')}

    ${heading(toc, 2, 'With Keyboard Shortcut')}
    ${await componentPreview('tooltip-keyboard')}

    ${heading(toc, 2, 'Disabled Button')}
    <p>Show a tooltip on a disabled button by wrapping it with a span.</p>
    ${await componentPreview('tooltip-disabled')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('tooltip-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'ui-tooltip')}
    <p>The root. It opens on hover and on focus after a delay, and Escape dismisses an open tip without moving focus. It also has <code>show()</code> and <code>hide()</code> methods.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>open</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>delay-duration</code></td><td><code>number</code>, in ms</td><td><code>700</code></td></tr>
          <tr><td><code>skip-delay-duration</code></td><td><code>number</code>, in ms</td><td><code>300</code></td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-tooltip-trigger')}
    <p>Wraps the control that shows the tip. The control is described by the tip through <code>aria-describedby</code>, so an icon-only control still needs its own <code>aria-label</code>. It takes no attributes.</p>

    ${heading(toc, 3, 'ui-tooltip-content')}
    <p>The tip, rendered in the top layer with the Popover API.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>side</code></td><td><code>"top" | "right" | "bottom" | "left"</code></td><td><code>"top"</code></td></tr>
          <tr><td><code>align</code></td><td><code>"center" | "start" | "end"</code></td><td><code>"center"</code></td></tr>
          <tr><td><code>side-offset</code></td><td><code>number</code>, in px</td><td><code>4</code></td></tr>
          <tr><td><code>align-offset</code></td><td><code>number</code>, in px</td><td><code>0</code></td></tr>
        </tbody>
      </table>
    </div>
  `;
}
