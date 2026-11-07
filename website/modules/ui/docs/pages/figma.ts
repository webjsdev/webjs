import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * Figma, ported from shadcn's content/docs/(root)/figma.mdx (#1666). shadcn's
 * page lists community Figma kits made for shadcn/ui. There is no Figma kit
 * for WebJs UI, so the page says so and points at what a designer can use:
 * the shadcn kits share the kit's design, which D1 ports as it is.
 */
export const title = 'Figma';
export const description = 'Designing with WebJs UI in Figma.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${callout(html`<strong>Note:</strong> There is no Figma kit for WebJs UI. None is published by the WebJs project and none is maintained by the community today.`)}

    ${heading(toc, 2, 'Using a community kit')}
    <p>WebJs UI shares its design with a widely used family of community Figma kits: the layout, the type scale, the spacing, the neutral oklch palette, the radii, the variant names and the sizes. So such a kit describes the same components, and a design built from one maps onto the kit by name: a <code>Button</code> with the <code>outline</code> variant is <code>buttonClass({ variant: 'outline' })</code>, and a <code>DialogContent</code> is <code>&lt;ui-dialog-content&gt;</code>.</p>
    <p>The community kits are listed on <a href="https://ui.shadcn.com/docs/figma">this Figma kits page</a>. They are not made for WebJs UI, so check a component's variants against its docs page here before you build from it.</p>

    ${heading(toc, 2, 'Theme tokens')}
    <p>The kit's colours, radius and chart palette are CSS variables in your stylesheet (<code>--background</code>, <code>--primary</code>, <code>--radius</code> and the rest). A Figma kit that exposes the same tokens as variables can carry your theme across by copying the values. See <a href="/ui/docs/theming">Theming</a> for the full list.</p>

    ${heading(toc, 2, 'Contributing a kit')}
    <p>If you build a Figma kit for WebJs UI and keep it maintained, open an issue on <a href="https://github.com/webjsdev/webjs/issues">the WebJs repository</a> and we will list it here.</p>
  `;
}
