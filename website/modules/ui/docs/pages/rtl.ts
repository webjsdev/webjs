import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';

/**
 * RTL, ported from shadcn's content/docs/rtl/ (#1666). shadcn's index sends
 * each framework to its own guide and explains the CLI transform that turns
 * physical classes into logical ones when `rtl: true` is set. The kit needs
 * neither: its components are written with logical properties, so `dir` on an
 * ancestor flips them, and there is no `rtl` key and no `migrate` command.
 * The section keeps its index page with the one guide that is true here, in
 * the shape of shadcn's Next.js guide.
 */
export const title = 'RTL';
export const description = 'Right-to-left support for WebJs UI components.';

const steps = 'steps mb-0 pt-2 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step';

export default async function body(toc: TocEntry[]) {
  return html`
    <p>WebJs UI components have first-class support for right-to-left (RTL) layouts. Text alignment, positioning, and directional styles automatically adapt for languages like Arabic, Hebrew, and Persian.</p>
    ${await componentPreview('card-rtl', { direction: 'rtl', previewClass: 'h-auto', hideCode: true, className: 'mb-8' })}
    <p>The components are written with logical properties, so they install ready for both directions. Set <code>dir="rtl"</code> on an element and every component inside it lays itself out from the right.</p>

    ${heading(toc, 2, 'Get Started')}
    <div class=${steps}>
      ${heading(toc, 3, 'Set the direction')}
      <p>Add the <code>dir="rtl"</code> and <code>lang="ar"</code> attributes to the <code>html</code> tag. Update <code>lang="ar"</code> to your target language. The root layout is the one layout that may write the document shell, so it is where the attributes go.</p>
      ${codeFigure(`import { html } from '@webjsdev/core';
import type { LayoutProps } from '@webjsdev/core';

export default function RootLayout({ children }: LayoutProps) {
  return html\`<!doctype html>
<html lang="ar" dir="rtl">
  <head></head>
  <body>\${children}</body>
</html>\`;
}`, { title: 'app/layout.ts', lineNumbers: true })}
      <p>The <code>dir</code> attribute is the direction provider, and it works on any element, so one region of a left-to-right page can be right-to-left: <code>&lt;section dir="rtl" lang="ar"&gt;</code>. Set <code>lang</code> beside it, since a screen reader picks its voice from <code>lang</code> while the layout comes from <code>dir</code>.</p>

      ${heading(toc, 3, 'Add Font')}
      <p>For the best RTL experience, we recommend using fonts that have proper support for your target language. <a href="https://fonts.google.com/noto">Noto</a> is a great font family for this and it pairs well with Inter and Geist.</p>
      <p>Self-host the font file under <code>public/fonts/</code>, declare it in the Tailwind entry your app compiles, and make it the sans family:</p>
      ${codeFigure(`@font-face {
  font-family: "Noto Sans Arabic";
  src: url("/fonts/noto-sans-arabic.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
}

@theme {
  --font-sans: "Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}`, { title: 'public/input.css', lang: 'css', lineNumbers: true })}
      <p>For other languages, eg. Hebrew, you can use Noto Sans Hebrew.</p>

      ${heading(toc, 3, 'Add Components')}
      <p>You are now ready to add components to your project. They need no RTL step of their own.</p>
      ${commandBlock(packageCommands('add item'))}
    </div>

    ${heading(toc, 2, 'How it works')}
    <p>Every component styles itself with logical utilities, which the browser resolves from the nearest <code>dir</code>:</p>
    <ul>
      <li>Padding and margin use <code>ps-*</code>, <code>pe-*</code>, <code>ms-*</code> and <code>me-*</code> instead of <code>pl-*</code>, <code>pr-*</code>, <code>ml-*</code> and <code>mr-*</code>.</li>
      <li>Positioning uses <code>start-*</code> and <code>end-*</code> instead of <code>left-*</code> and <code>right-*</code>.</li>
      <li>Text alignment and corners use <code>text-start</code>, <code>text-end</code>, <code>rounded-s-*</code> and <code>rounded-e-*</code>.</li>
      <li>Keyboard handling follows the visual direction. A slider's Left and Right keys swap under RTL, for example.</li>
    </ul>
    <p>For your own code that has to branch on the direction, such as an arrow-key handler, the <a href="/ui/docs/components/direction">Direction</a> component exports <code>readDirection(element)</code>, which reads the nearest <code>dir</code> attribute. It reads attributes only, so it also works while the page renders on the server.</p>
    ${commandBlock(packageCommands('add direction'))}

    ${heading(toc, 2, 'Supported Styles')}
    <p>Every style supports RTL. The default style, <code>new-york</code>, is written with logical properties throughout, as are the components' own classes.</p>
    <p>The eight styles (<code>vega</code>, <code>nova</code>, <code>maia</code>, <code>lyra</code>, <code>mira</code>, <code>luma</code>, <code>sera</code> and <code>rhea</code>) ship with a right-to-left conversion table already applied. So their physical utilities (<code>pl-2</code>, <code>ml-auto</code>, <code>rounded-l-md</code>) arrive as logical ones, and the same files render a left-to-right page exactly as before and a right-to-left one correctly.</p>

    ${heading(toc, 2, 'Font Recommendations')}
    <p>For the best RTL experience, we recommend using fonts that have proper support for your target language. <a href="https://fonts.google.com/noto">Noto</a> is a great font family for this and it pairs well with Inter and Geist.</p>
    <p>See <a href="#add-font">Add Font</a> above for how to install one in a WebJs app.</p>

    ${heading(toc, 2, 'Animations')}
    <p>A dropdown, a popover or a tooltip slides in from the side it opened on. The positioning reports that side on the panel as <code>data-side</code>, the side it was actually placed on, and the animation keys on it, so it is right in either direction.</p>
    <p>Overlays render in the top layer through the native <code>&lt;dialog&gt;</code> element and the Popover API, but they stay where you wrote them in the document rather than moving to a portal. So they inherit <code>dir</code> from their ancestors like everything else.</p>
    ${codeFigure(`<div dir="rtl">
  <ui-tooltip>
    <ui-tooltip-trigger>...</ui-tooltip-trigger>
    <ui-tooltip-content>...</ui-tooltip-content>
  </ui-tooltip>
</div>`)}

    ${heading(toc, 2, 'Icons')}
    <p>An icon that points a direction, like an arrow or a chevron, does not flip on its own. Add Tailwind's <code>rtl:rotate-180</code> to it:</p>
    ${codeFigure(`<svg class="rtl:rotate-180" ...>...</svg>`)}
  `;
}
