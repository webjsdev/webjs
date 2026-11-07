import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * JavaScript, ported from shadcn's content/docs/(root)/javascript.mdx (#1666).
 * shadcn ships a JavaScript build of its components behind `tsx: false`; the
 * kit has no such switch. Its sources are erasable TypeScript, which WebJs
 * strips when it serves a file (Node 24's module.stripTypeScriptTypes, amaro
 * on Bun), so a JavaScript app imports the .ts files as they are.
 */
export const title = 'JavaScript';
export const description = 'How to use WebJs UI with JavaScript.';

export default async function body(toc: TocEntry[]) {
  return html`
    <p>This project and the components are written in TypeScript. We recommend using TypeScript for your project as well.</p>
    <p>The components work in a JavaScript app as they are. A WebJs app runs TypeScript with no build step: when the server loads or serves a <code>.ts</code> file it strips the types (with Node's built-in <code>module.stripTypeScriptTypes</code> on Node 24 and later, and with <code>amaro</code> on Bun) and leaves the code where it was. So a JavaScript app imports the kit's <code>.ts</code> files directly, from <code>.js</code> pages and components, and the browser receives plain JavaScript.</p>
    ${callout(html`<code>add</code> always writes <code>.ts</code> files. Leave <code>tsx</code> out of <code>components.json</code>, since the config schema is strict and an unknown key is an error.`, { className: 'mt-6' })}

    ${heading(toc, 2, 'Importing from JavaScript')}
    <p>Write the import with the <code>.ts</code> extension, as every import in a WebJs app carries its extension:</p>
    ${codeFigure(`import { html } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';

export default function Page() {
  return html\`<button class=\${buttonClass({ variant: 'outline' })}>Button</button>\`;
}`, { title: 'app/page.js', lang: 'js', lineNumbers: true })}
    <p>A Tier-2 element registers itself when its module loads, so importing it is the whole wiring, from a <code>.js</code> file as from a <code>.ts</code> one:</p>
    ${codeFigure(`import '#components/ui/dialog.ts';`, { title: 'app/settings/page.js', lang: 'js' })}

    ${heading(toc, 2, 'Import aliases')}
    <p>The <code>#</code> import aliases come from the <code>imports</code> field of <code>package.json</code>, which Node and Bun resolve at runtime. A JavaScript app needs no <code>jsconfig.json</code> for them:</p>
    ${codeFigure(`{
  "imports": {
    "#*": "./*"
  }
}`, { title: 'package.json', lang: 'json', lineNumbers: true })}
    <p>See <a href="/ui/docs/package-imports">Package Imports</a> for the details.</p>

    ${heading(toc, 2, 'Editing the components')}
    <p>The files <code>add</code> copies into your project are yours to edit. Their TypeScript is erasable on purpose: type annotations, interfaces and <code>import type</code> lines, with no <code>enum</code>, no value <code>namespace</code> and no constructor parameter properties. That is the syntax WebJs can strip without changing a character's position, so you can edit a component's code without touching its types, and the file keeps running.</p>
    <p>The scaffold's <code>tsconfig.json</code> sets <code>erasableSyntaxOnly</code>, so an edit to a copied component that breaks the rule is reported in your editor before it reaches the server.</p>
  `;
}
