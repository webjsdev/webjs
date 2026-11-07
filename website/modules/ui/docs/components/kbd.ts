import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Kbd docs page body, ported from shadcn's
 * content/docs/components/radix/kbd.mdx (#1666, D15): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
/** The demo shown above the Installation section. */
export const demo = 'kbd-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { kbdClass, kbdGroupClass } from '#components/ui/kbd.ts';`)}
    ${codeFigure(`<kbd data-slot="kbd" class=\${kbdClass()}>Ctrl</kbd>`)}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build <code>kbdClass</code> and <code>kbdGroupClass</code>:</p>
    ${codeFigure(`kbdClass
kbdGroupClass
├── kbdClass
└── kbdClass`, { lang: 'text' })}

    ${heading(toc, 2, 'Group')}
    <p>Use <code>kbdGroupClass()</code> to group keyboard keys together.</p>
    ${await componentPreview('kbd-group')}

    ${heading(toc, 2, 'Button')}
    <p>Put a <code>kbdClass()</code> key inside a button to display a keyboard key inside the button.</p>
    ${await componentPreview('kbd-button')}

    ${heading(toc, 2, 'Tooltip')}
    <p>You can put a key inside <code>&lt;ui-tooltip-content&gt;</code> to display a tooltip with a keyboard key.</p>
    ${await componentPreview('kbd-tooltip')}

    ${heading(toc, 2, 'Input Group')}
    <p>You can put a key inside an input group addon to display a keyboard key inside an input group.</p>
    ${await componentPreview('kbd-input-group')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('kbd-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}

    ${heading(toc, 3, 'kbdClass')}
    <p>Use <code>kbdClass()</code> on a native <code>&lt;kbd&gt;</code> element to display a keyboard key. It takes no options; merge your own classes with <code>cn()</code>.</p>
    <p>A key shown only as a symbol needs a spoken name. Do not put <code>aria-label</code> on the <code>&lt;kbd&gt;</code>, which browsers ignore there. Hide the glyph with <code>aria-hidden="true"</code> and add the spoken form in an <code>sr-only</code> sibling.</p>
    ${codeFigure(`<kbd data-slot="kbd" class=\${kbdClass()}>Ctrl</kbd>
<kbd data-slot="kbd" class=\${kbdClass()}>
  <span aria-hidden="true">⌘</span><span class="sr-only">Command</span>
</kbd>`)}

    ${heading(toc, 3, 'kbdGroupClass')}
    <p>Use <code>kbdGroupClass()</code> to group keys together. To name a chord, give the group <code>role="img"</code> and an <code>aria-label</code> for the whole chord, so it is announced once as one thing.</p>
    ${codeFigure(`<kbd data-slot="kbd-group" role="img" aria-label="Control plus B" class=\${kbdGroupClass()}>
  <kbd data-slot="kbd" class=\${kbdClass()}>Ctrl</kbd>
  <kbd data-slot="kbd" class=\${kbdClass()}>B</kbd>
</kbd>`)}
  `;
}
