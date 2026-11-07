import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';

/**
 * Figma, ported from shadcn's content/docs/(root)/figma.mdx (#1666). The page
 * states what a designer can do: design in a community kit that shares the
 * kit's design (D1 ports it as it is), carry the theme across as variables,
 * and contribute a kit to be listed here.
 */
export const title = 'Figma';
export const description = 'Designing with WebJs UI in Figma.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Using a community kit')}
    <p>WebJs UI shares its design with a widely used family of community Figma kits: the layout, the type scale, the spacing, the neutral oklch palette, the radii, the variant names and the sizes. A design built from one of those kits maps onto WebJs UI by name: a <code>Button</code> with the <code>outline</code> variant is <code>buttonClass({ variant: 'outline' })</code>, and a <code>DialogContent</code> is <code>&lt;ui-dialog-content&gt;</code>.</p>
    <p>Pick a kit from <a href="https://ui.shadcn.com/docs/figma">this Figma kits page</a>, and use each component's docs page here for its variants and sizes as you build.</p>

    ${heading(toc, 2, 'Theme tokens')}
    <p>The kit's colours, radius and chart palette are CSS variables in your stylesheet (<code>--background</code>, <code>--primary</code>, <code>--radius</code> and the rest). Set the same values as variables in your Figma file and the design and the app share one theme. See <a href="/ui/docs/theming">Theming</a> for the full list.</p>

    ${heading(toc, 2, 'Contributing a kit')}
    <p>Built a Figma kit for WebJs UI? Open an issue on <a href="https://github.com/webjsdev/webjs/issues">the WebJs repository</a> and we will list it here.</p>
  `;
}
