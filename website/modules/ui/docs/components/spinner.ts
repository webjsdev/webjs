import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Spinner docs page, ported from shadcn's
 * content/docs/components/radix/spinner.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'spinner-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { spinner } from '#components/ui/spinner.ts';`)}
    ${codeFigure(`\${spinner()}`)}

    ${heading(toc, 2, 'Customization')}
    <p>You can replace the default spinner icon with any other icon by editing the <code>spinner()</code> function, or by putting <code>spinnerClass()</code> on an SVG of your own.</p>
    ${await componentPreview('spinner-custom')}
    ${codeFigure(`import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';

export const spinnerClass = (): string => 'size-4 animate-spin';

export function spinner(opts: { class?: string; label?: string } = {}) {
  return html\`<svg
    data-slot="spinner"
    role="status"
    aria-label=\${opts.label ?? 'Loading'}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class=\${cn(spinnerClass(), opts.class)}
  >
    <path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" />
    <path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" />
    <path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" />
  </svg>\`;
}`, { title: 'components/ui/spinner.ts', lineNumbers: true })}

    ${heading(toc, 2, 'Size')}
    <p>Pass a <code>size-*</code> utility class through the <code>class</code> option to change the size of the spinner.</p>
    ${await componentPreview('spinner-size')}

    ${heading(toc, 2, 'Button')}
    <p>Add a spinner to a button to indicate a loading state. Place <code>spinner({ decorative: true })</code> before the label for a start position, or after the label for an end position, and mark the button <code>disabled</code> with <code>aria-busy="true"</code> while it waits. The button's text already says what is happening, so the spinner stays hidden from assistive technology.</p>
    ${await componentPreview('spinner-button')}

    ${heading(toc, 2, 'Badge')}
    <p>Add a spinner to a badge to indicate a loading state. Place <code>spinner({ decorative: true })</code> before the label for a start position, or after the label for an end position.</p>
    ${await componentPreview('spinner-badge')}

    ${heading(toc, 2, 'Input Group')}
    ${await componentPreview('spinner-input-group')}

    ${heading(toc, 2, 'Empty')}
    ${await componentPreview('spinner-empty')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('spinner-rtl', { direction: 'rtl' })}

  `;
}
