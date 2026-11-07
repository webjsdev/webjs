import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * The Marker docs page, ported from shadcn's
 * content/docs/components/radix/marker.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React. Every preview
 * renders in rhea, as shadcn's do.
 */
/** The demo shown above the Installation section. */
export const demo = 'marker-demo';

const RHEA = { style: 'rhea', previewClass: 'h-auto theme-blue' };

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { markerClass, markerContentClass, markerIconClass } from '#components/ui/marker.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="marker" data-variant="default" class=\${markerClass()}>
  <span data-slot="marker-icon" aria-hidden="true" class=\${markerIconClass()}>
    \${CheckIcon()}
  </span>
  <span data-slot="marker-content" class=\${markerContentClass()}>Explored 4 files</span>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a marker:</p>
    ${codeFigure(`markerClass()
├── markerIconClass()
└── markerContentClass()`, { lang: 'text' })}

    ${heading(toc, 2, 'Features')}
    <ul>
      <li>Inline marker, bordered row, and labeled separator variants</li>
      <li>Decorative icon slot that is hidden from assistive tech</li>
      <li>Class helpers, so the root can be a <code>&lt;div&gt;</code>, a link, or a button</li>
      <li>Pairs with the <a href="/ui/docs/utils/shimmer"><code>shimmer</code></a> utility for streaming status text</li>
      <li>Customizable styling by merging classes into each helper's result with <code>cn</code></li>
    </ul>

    ${heading(toc, 2, 'Variants')}
    <p>Use the <code>variant</code> option to switch between an inline marker, bordered row, and labeled separator. Set <code>data-variant</code> on the root to the same variant: the content's centring keys on it.</p>
    ${await componentPreview('marker-variants', RHEA)}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Variant</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>default</code></td><td>An inline marker for status, notes, and actions.</td></tr>
          <tr><td><code>border</code></td><td>A default marker with a bottom border under the row.</td></tr>
          <tr><td><code>separator</code></td><td>A centered label with divider lines on each side.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 2, 'Status')}
    <p>Set <code>role="status"</code> and include a <a href="/ui/docs/components/spinner">Spinner</a> for streaming or in-progress markers so updates are announced.</p>
    ${await componentPreview('marker-status', RHEA)}

    ${heading(toc, 2, 'Shimmer')}
    <p>Add the <a href="/ui/docs/utils/shimmer"><code>shimmer</code></a> utility class to the marker content for an animated streaming-text effect. The utility comes from the kit's Tailwind stylesheet and is not part of its generated component CSS, so add it to your stylesheet first. See the shimmer docs for installation.</p>
    ${await componentPreview('marker-shimmer', RHEA)}

    ${heading(toc, 2, 'Separator')}
    <p>Use the <code>separator</code> variant for labeled dividers, such as dates or section breaks, in a conversation. A <a href="/ui/docs/ai-elements/checkpoint">Checkpoint</a> is a separator with a button that restores the thread to that point.</p>
    ${await componentPreview('marker-separator', RHEA)}

    ${heading(toc, 2, 'Border')}
    <p>Use the <code>border</code> variant for status rows that should keep the default marker alignment while separating the next row.</p>
    ${await componentPreview('marker-border', RHEA)}

    ${heading(toc, 2, 'With Icon')}
    <p>Use <code>markerIconClass()</code> to render an icon alongside the content. Add <code>flex-col</code> to the root to stack the icon above the content.</p>
    ${await componentPreview('marker-icon', RHEA)}

    ${heading(toc, 2, 'Links and Buttons')}
    <p>A class helper styles any element, so a marker that links or acts is an <code>&lt;a&gt;</code> or a <code>&lt;button&gt;</code> with the marker's classes.</p>
    ${await componentPreview('marker-link-button', RHEA)}
    ${codeFigure(`import { html } from '@webjsdev/core';
import { markerClass, markerContentClass } from '#components/ui/marker.ts';

export function MarkerLinkDemo() {
  return html\`
    <a href="#" data-slot="marker" data-variant="default" class=\${markerClass()}>
      <span data-slot="marker-content" class=\${markerContentClass()}>View the pull request</span>
    </a>
  \`;
}`, { lineNumbers: true })}

    ${heading(toc, 2, 'Accessibility')}
    <p>A marker is presentational by default. The correct semantics depend on how you use it, so choose the role based on intent rather than relying on a single default.</p>

    ${heading(toc, 3, 'Status and Progress')}
    <p>For streaming or progress markers such as "Thinking..." or a running tool, set <code>role="status"</code> on the root so assistive tech announces the update as it appears.</p>
    ${codeFigure(`<div data-slot="marker" data-variant="default" role="status" class=\${markerClass()}>
  <span data-slot="marker-icon" aria-hidden="true" class=\${markerIconClass()}>
    \${spinner({ decorative: true })}
  </span>
  <span data-slot="marker-content" class=\${markerContentClass()}>Compacting conversation</span>
</div>`, { lineNumbers: true })}

    ${heading(toc, 3, 'Labeled Separators')}
    <p>A separator that carries text, such as a date or a section label, needs no role. The divider lines are decorative CSS pseudo-elements, and the text is announced as ordinary content.</p>
    ${codeFigure(`<div data-slot="marker" data-variant="separator" class=\${markerClass({ variant: 'separator' })}>
  <span data-slot="marker-content" class=\${markerContentClass()}>Today</span>
</div>`, { lineNumbers: true })}
    ${callout(html`<strong>Note:</strong> Do not add <code>role="separator"</code> to a labeled divider. A separator takes its accessible name from <code>aria-label</code>, not from its text, and its contents are treated as presentational, so the visible label would not be announced. Reserve <code>role="separator"</code> for a divider with no meaningful text.`)}

    ${heading(toc, 3, 'Bordered Markers')}
    <p>A bordered marker keeps the same semantics as the default marker. The bottom border is decorative, so choose <code>role="status"</code>, a link or button element, or no role based on the marker's purpose.</p>
    ${codeFigure(`<div data-slot="marker" data-variant="border" class=\${markerClass({ variant: 'border' })}>
  <span data-slot="marker-icon" aria-hidden="true" class=\${markerIconClass()}>
    \${FileTextIcon()}
  </span>
  <span data-slot="marker-content" class=\${markerContentClass()}>Opened implementation notes</span>
</div>`, { lineNumbers: true })}

    ${heading(toc, 3, 'Decorative Icons')}
    <p>The icon slot is decorative: put <code>aria-hidden="true"</code> on it, as the examples do, so the adjacent content carries the meaning. For an icon-only marker, provide an <code>aria-label</code> or visible text so it is not announced as empty.</p>
    ${codeFigure(`<div data-slot="marker" data-variant="default" aria-label="Synced" class=\${markerClass()}>
  <span data-slot="marker-icon" aria-hidden="true" class=\${markerIconClass()}>
    \${CheckIcon()}
  </span>
</div>`, { lineNumbers: true })}

    ${heading(toc, 3, 'Interactive Markers')}
    <p>When a marker links or triggers an action, render it as a real <code>&lt;button&gt;</code> or <code>&lt;a&gt;</code> carrying the marker's classes so it is focusable and exposes the correct role. The accessible name comes from the marker text.</p>
    ${codeFigure(`<a href="/files" data-slot="marker" data-variant="default" class=\${markerClass()}>
  <span data-slot="marker-icon" aria-hidden="true" class=\${markerIconClass()}>
    \${FileTextIcon()}
  </span>
  <span data-slot="marker-content" class=\${markerContentClass()}>Explored 4 files</span>
</a>`, { lineNumbers: true })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'markerClass')}
    <p><code>markerClass()</code> returns the classes for the root marker element. Set <code>data-variant</code> to the variant you pass. <code>markerVariants()</code> is an alias of <code>markerClass()</code> that also merges a <code>className</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"default" | "border" | "separator"</code></td><td><code>"default"</code></td><td>The marker layout.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'markerIconClass')}
    <p>The classes for the decorative icon slot. Hide it from assistive tech with <code>aria-hidden="true"</code>. Takes no options.</p>

    ${heading(toc, 3, 'markerContentClass')}
    <p>The classes for the marker text content. Takes no options.</p>
  `;
}
