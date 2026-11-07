import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';

/**
 * Registry FAQ, ported from shadcn's content/docs/registry/faq.mdx (#1666).
 * Each answer is read from packages/ui/src: file targets from
 * `resolveTarget` and CSS variables from `mergeCssVars` in commands/add.js,
 * dependency resolution from registry/resolver.js. Two answers invert
 * shadcn's: a bare dependency name resolves in the item's own registry, and
 * `cssVars` adds a variable but never changes one the project defines.
 */
export const title = 'FAQ';
export const description = 'Frequently asked questions about running a registry.';

const json = (text: string, title?: string) => codeFigure(text, { lang: 'json', title, lineNumbers: true });

export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Frequently asked questions')}

    ${heading(toc, 3, 'What does a complex component look like?')}
    <p>Here's an example of a complex component that installs a page, two components, a helper and a config file.</p>
    ${json(`{
  "name": "hello-world",
  "title": "Hello World",
  "type": "registry:block",
  "description": "A complex hello world component",
  "files": [
    {
      "path": "blocks/hello-world/page.ts",
      "type": "registry:page",
      "target": "app/hello/page.ts"
    },
    {
      "path": "blocks/hello-world/components/hello-world.ts",
      "type": "registry:component"
    },
    {
      "path": "blocks/hello-world/components/formatted-message.ts",
      "type": "registry:component"
    },
    {
      "path": "blocks/hello-world/lib/format-date.ts",
      "type": "registry:lib"
    },
    {
      "path": "blocks/hello-world/hello.config.ts",
      "type": "registry:file",
      "target": "hello.config.ts"
    }
  ]
}`)}
    <p>The page lands at its <code>target</code>, the two components in the project's <code>components</code> folder, the helper in its <code>lib</code> folder, and the config file at the project root. A <code>target</code> is a path from the project root, written as is.</p>

    ${heading(toc, 3, 'How do I add a new Tailwind color?')}
    <p>To add a new color you need to add it to <code>cssVars</code> under <code>light</code> and <code>dark</code> keys, and map it to a Tailwind color under <code>theme</code>.</p>
    ${json(`{
  "name": "hello-world",
  "title": "Hello World",
  "type": "registry:block",
  "description": "A complex hello world component",
  "files": [
    // ...
  ],
  "cssVars": {
    "theme": {
      "color-brand": "var(--brand)",
      "color-brand-accent": "var(--brand-accent)"
    },
    "light": {
      "brand": "oklch(0.205 0.015 18)",
      "brand-accent": "oklch(0.205 0.015 18)"
    },
    "dark": {
      "brand": "oklch(0.205 0.015 18)",
      "brand-accent": "oklch(0.205 0.015 18)"
    }
  }
}`)}
    <p>The CLI will update the project CSS file: <code>light</code> goes in the <code>:root</code> block, <code>dark</code> in <code>.dark</code>, and <code>theme</code> in <code>@theme inline</code>, the way the WebJs UI theme is laid out. Once updated, the new colors will be available to be used as utility classes: <code>bg-brand</code> and <code>text-brand-accent</code>. The <code>theme</code> entries are what make the utilities exist, since the CLI does not generate them from <code>light</code> and <code>dark</code>.</p>

    ${heading(toc, 3, 'Why does button in registryDependencies not resolve to the WebJs UI button?')}
    <p>A registry dependency is a name, and the CLI fetches it from the same registry as the item that lists it. In an item served from <code>https://acme.com/r</code>, <code>button</code> means <code>https://acme.com/r/button.json</code>.</p>
    <p>There is no address for an item in another registry. If your item builds on a WebJs UI component, tell users to install it first, or ship your own copy in your registry.</p>
    ${commandBlock(packageCommands('add button'))}

    ${heading(toc, 3, 'How do I pin a registry item?')}
    <p>Put the version in the base URL. The CLI appends <code>/&lt;name&gt;.json</code> to whatever base it is given, so a versioned folder or a git ref in a raw URL pins every item and every dependency fetched with it.</p>
    ${commandBlock(packageCommands('add brand-button --registry https://raw.githubusercontent.com/acme/toolkit/v1.2.0/r'))}
    <p>For published registries, prefer tags or full commit SHAs. See <a href="/ui/docs/registry/github">GitHub Registries</a>.</p>

    ${heading(toc, 3, 'Can a registry be private?')}
    <p>Only by where it can be reached or by what its URL contains. The CLI sends no credentials, no custom headers and no cookies. See <a href="/ui/docs/registry/authentication">Authentication</a>.</p>

    ${heading(toc, 3, 'How do I add or override a Tailwind theme variable?')}
    <p>To add a theme variable you add it to <code>cssVars.theme</code> under the key you want to add.</p>
    ${json(`{
  "name": "hello-world",
  "title": "Hello World",
  "type": "registry:block",
  "description": "A complex hello world component",
  "files": [
    // ...
  ],
  "cssVars": {
    "theme": {
      "text-base": "3rem",
      "ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
      "font-heading": "Poppins, sans-serif"
    }
  }
}`)}
    <p>The CLI adds only the variables the project does not define yet, each in its own block, and leaves every existing one as it is. So <code>cssVars</code> cannot override a value the project already sets, such as <code>--primary</code>. To change one, tell users to edit their stylesheet, or ship a <code>registry:file</code> they import after the theme.</p>

    ${heading(toc, 3, 'Why is @webjsdev/core installed when my item lists no dependencies?')}
    <p><code>add</code> always installs <code>@webjsdev/core</code> along with an item's <code>dependencies</code>, since every kit file builds on it. Pass <code>--no-deps</code> to skip installing packages altogether.</p>
  `;
}
