import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * registry-item.json, ported from shadcn's
 * content/docs/registry/registry-item-json.mdx (#1666). The fields are
 * `registryItemSchema` in packages/ui/src/registry/schema.js, and what
 * `add` does with each is read from packages/ui/src/commands/add.js:
 * `resolveTarget` for where a file lands, `mergeCssVars` for `cssVars`,
 * `rewriteRegistryImports` for imports. Fields the schema accepts but the
 * CLI never applies (`css`, `envVars`, `tailwind`, `docs`, `meta`,
 * `author`, `extends`) say so, and shadcn's `font` field and target
 * placeholders, which the schema lacks, are described as unsupported.
 */
export const title = 'registry-item.json';
export const description = 'Specification for registry items.';

const json = (text: string) => codeFigure(text, { lang: 'json', title: 'registry-item.json', lineNumbers: true });

const table = (head: string[], rows: unknown[][]) => html`
  <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
    <table>
      <thead><tr>${head.map((h) => html`<th>${h}</th>`)}</tr></thead>
      <tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody>
    </table>
  </div>`;

const c = (s: string) => html`<code>${s}</code>`;

export default async function body(toc: TocEntry[]) {
  return html`
    <p>The <code>registry-item.json</code> schema is used to define your custom registry items. It is what the CLI fetches from <code>&lt;url&gt;/&lt;name&gt;.json</code>, with each file's <code>content</code> inlined.</p>
    ${json(`{
  "name": "hello-world",
  "type": "registry:block",
  "title": "Hello World",
  "description": "A simple hello world page.",
  "registryDependencies": ["brand-button"],
  "dependencies": ["is-even@3.0.0", "zod"],
  "devDependencies": ["@types/node"],
  "files": [
    {
      "path": "blocks/hello-world/page.ts",
      "type": "registry:page",
      "target": "app/hello/page.ts"
    },
    {
      "path": "blocks/hello-world/components/hello-world.ts",
      "type": "registry:component"
    }
  ],
  "cssVars": {
    "theme": {
      "font-heading": "Poppins, sans-serif"
    },
    "light": {
      "brand": "oklch(0.205 0.015 18)"
    },
    "dark": {
      "brand": "oklch(0.205 0.015 18)"
    }
  }
}`)}
    <div class="mt-6 flex items-center gap-2"><a href="/ui/docs/registry/examples">See more examples</a></div>

    ${heading(toc, 2, 'Definitions')}
    <p>The schema is <code>registryItemSchema</code>, exported from <code>@webjsdev/ui/registry/schema</code>. See the <a href="/ui/docs/registry/api-reference">API Reference</a>.</p>

    ${heading(toc, 3, '$schema')}
    <p>The <code>$schema</code> property is accepted and not checked. <code>webjsui build</code> stamps every item it writes with one.</p>

    ${heading(toc, 3, 'name')}
    <p>The name of the item. This is used to identify the item in the registry: the CLI fetches it as <code>&lt;url&gt;/&lt;name&gt;.json</code>. It should be unique for your registry.</p>
    ${json(`{
  "name": "hello-world"
}`)}

    ${heading(toc, 3, 'title')}
    <p>A human-readable title for your registry item. Keep it short and descriptive.</p>
    ${json(`{
  "title": "Hello World"
}`)}

    ${heading(toc, 3, 'description')}
    <p>A description of your registry item. This can be longer and more detailed than the <code>title</code>. <code>list</code> prints it beside the name.</p>
    ${json(`{
  "description": "A simple hello world page."
}`)}

    ${heading(toc, 3, 'type')}
    <p>The <code>type</code> property is used to specify the type of your registry item.</p>
    ${json(`{
  "type": "registry:block"
}`)}
    <p>The following types are accepted. The item's type decides how <code>list</code> groups it and how <code>add</code> treats an existing file. Where each file lands is decided by the file's own <code>type</code>, see <a href="#files">files</a>.</p>
    ${table(['Type', 'Description'], [
      [c('registry:ui'), html`Use for UI components and single-file primitives. Listed under Components. A Tier-1 file's <code>@example</code> block is replaced with a pointer to <code>view</code> on install.`],
      [c('registry:block'), html`Use for ready-made views with multiple files. Listed under Blocks, or Charts with the <code>chart</code> category. An existing file is kept unless <code>--overwrite</code> is passed.`],
      [c('registry:component'), 'Use for simple components.'],
      [c('registry:lib'), 'Use for lib and utils.'],
      [c('registry:hook'), 'Use for reusable logic, such as a reactive controller.'],
      [c('registry:page'), 'Use for page or file-based routes.'],
      [c('registry:file'), 'Use for miscellaneous files.'],
      [c('registry:theme'), 'Use for themes.'],
      [c('registry:style'), 'Use for registry styles.'],
      [c('registry:item'), 'Use for universal registry items.'],
      [html`${c('registry:base')}, ${c('registry:font')}, ${c('registry:example')}, ${c('registry:internal')}`, 'Accepted for compatibility with shadcn registries. The CLI gives them no special handling.'],
    ])}
    <p><code>list</code> shows only <code>registry:ui</code> and <code>registry:block</code> items. Every type installs with <code>add</code>.</p>

    ${heading(toc, 3, 'author')}
    <p>The <code>author</code> property is used to specify the author of the registry item. It is accepted and kept in the item, and the CLI does not print it.</p>
    ${json(`{
  "author": "John Doe <john@doe.com>"
}`)}

    ${heading(toc, 3, 'dependencies')}
    <p>The <code>dependencies</code> property is used to specify the dependencies of your registry item. This is for <code>npm</code> packages. <code>add</code> installs them with the package manager the project uses, and adds <code>@webjsdev/core</code> to the list.</p>
    <p>Use <code>@version</code> to specify the version of a package.</p>
    ${json(`{
  "dependencies": ["zod", "date-fns", "name@1.0.2"]
}`)}

    ${heading(toc, 3, 'devDependencies')}
    <p>The <code>devDependencies</code> property is used to specify the dev dependencies of your registry item. These are <code>npm</code> packages that are only needed during development. <code>add</code> installs them with the dev flag.</p>
    <p>Use <code>@version</code> to specify the version of the package.</p>
    ${json(`{
  "devDependencies": ["@types/node", "name@1.2.0"]
}`)}

    ${heading(toc, 3, 'registryDependencies')}
    <p>Used for registry dependencies. Each entry is the name of another item in the same registry, fetched from the same base URL as the item that lists it.</p>
    ${json(`{
  "registryDependencies": ["brand-button", "brand-card"]
}`)}
    <p>The CLI resolves them transitively and installs the deepest dependency first. A name it has already visited is skipped, so a cycle cannot loop.</p>
    ${callout(html`<p><strong>Note:</strong> There is no address for an item in another registry. shadcn's <code>@namespace/item</code>, <code>owner/repo/item</code>, URL and file path forms are not supported. A bare name such as <code>button</code> means <code>button.json</code> in your registry, not the WebJs UI button.</p>`)}

    ${heading(toc, 3, 'files')}
    <p>The <code>files</code> property is used to specify the files of your registry item. Each file has a <code>path</code>, <code>type</code>, <code>content</code> and an optional <code>target</code>.</p>
    <p><strong>The <code>target</code> property is required for <code>registry:page</code> and <code>registry:file</code> types.</strong></p>
    ${json(`{
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
      "path": "blocks/hello-world/lib/format-greeting.ts",
      "type": "registry:lib"
    },
    {
      "path": "blocks/hello-world/.env.example",
      "type": "registry:file",
      "target": ".env.example"
    }
  ]
}`)}
    <h4>path</h4>
    <p>The <code>path</code> property is used to specify the path to the file in your registry. <code>build</code> reads the file from it, relative to <code>registry.json</code>. On install, the CLI resolves the file's relative imports against it, see <a href="#imports">Imports</a>.</p>
    <h4>content</h4>
    <p>The file's source, as a string. The CLI writes a file only from <code>content</code> and never fetches a file by its <code>path</code>, so a served item must carry it. <code>build</code> inlines it.</p>
    <h4>type</h4>
    <p>The <code>type</code> property is used to specify the type of the file. Without a <code>target</code>, it decides where the file lands, from the folders in the project's <code>components.json</code>.</p>
    ${table(['File type', 'Written to'], [
      [c('registry:ui'), html`The <code>aliases.ui</code> folder, <code>components/ui</code> by default.`],
      [c('registry:component'), html`The <code>aliases.components</code> folder, <code>components</code> by default.`],
      [c('registry:lib'), html`The <code>aliases.lib</code> folder, <code>lib</code> by default.`],
      [c('registry:hook'), html`<code>hooks</code>.`],
      [c('registry:block'), html`Its own <code>path</code>, from the project root.`],
      ['Any other type', 'The project root, by file name.'],
    ])}
    <h4>target</h4>
    <p>The <code>target</code> property is used to indicate where the file should be placed in a project. It is a path from the project root, written as is, and it wins over the file type. Use it for routes, config, and every file of a block.</p>
    <p>shadcn's <code>~/</code> prefix and its <code>@ui/</code>, <code>@components/</code>, <code>@lib/</code> and <code>@hooks/</code> placeholders are not supported. A target such as <code>@ui/button.ts</code> is written to a folder named <code>@ui</code>. To land a file in the user's configured folder, leave out <code>target</code> and pick the file <code>type</code>.</p>
    <h4>Imports</h4>
    <p>On install, a relative import is resolved against the file's <code>path</code> in the registry and rewritten to where its target lands in the project, when it points at another file of the same item, <code>lib/utils.ts</code> (the user's <code>cn()</code> file), <code>lib/dom.ts</code>, <code>lib/icons.ts</code>, or a <code>components/&lt;name&gt;.ts</code> file (the <code>aliases.ui</code> folder). Any other import is left as written.</p>

    ${heading(toc, 3, 'tailwind')}
    <p><strong>DEPRECATED:</strong> Use <code>cssVars.theme</code> instead for Tailwind v4 projects. The <code>tailwind</code> property is accepted by the schema, and the CLI does not apply it.</p>

    ${heading(toc, 3, 'cssVars')}
    <p>Use to define CSS variables for your registry item. <code>add</code> writes them to the stylesheet <code>components.json</code> names: <code>theme</code> in the <code>@theme inline</code> block, <code>light</code> in <code>:root</code>, <code>dark</code> in <code>.dark</code>. A block that is missing is appended.</p>
    ${json(`{
  "cssVars": {
    "theme": {
      "font-heading": "Poppins, sans-serif",
      "color-brand": "var(--brand)"
    },
    "light": {
      "brand": "oklch(0.205 0.015 18)",
      "radius": "0.5rem"
    },
    "dark": {
      "brand": "oklch(0.985 0 0)"
    }
  }
}`)}
    <p>Only variables the stylesheet does not define yet are added. An existing one keeps its value, so <code>cssVars</code> adds tokens and never overrides them.</p>

    ${heading(toc, 3, 'css')}
    <p>The <code>css</code> property is accepted by the schema, and the CLI does not apply it. To ship rules such as <code>@layer base</code>, <code>@utility</code> or <code>@keyframes</code>, add a CSS file as a <code>registry:file</code> with a <code>target</code>, and tell users to import it into their stylesheet.</p>

    ${heading(toc, 3, 'envVars')}
    <p>The <code>envVars</code> property is accepted by the schema, and the CLI does not write it to any <code>.env</code> file. To ship example variables, add an <code>.env.example</code> file as a <code>registry:file</code>, as above.</p>

    ${heading(toc, 3, 'font')}
    <p>shadcn's <code>font</code> property is not part of the schema, and <code>registry:font</code> items get no special handling. Ship a font as files and <code>cssVars.theme</code> entries instead, such as <code>"font-heading": "Poppins, sans-serif"</code>.</p>

    ${heading(toc, 3, 'docs')}
    <p>The <code>docs</code> property is accepted by the schema, and the CLI does not print it on install. Put install notes in the <code>description</code>, which <code>list</code> and <code>view</code> show.</p>

    ${heading(toc, 3, 'categories')}
    <p>Use <code>categories</code> to organize your registry item. <code>list --category</code> filters blocks by them, and the <code>chart</code> category marks a block as a chart.</p>
    ${json(`{
  "categories": ["sidebar", "dashboard"]
}`)}

    ${heading(toc, 3, 'meta')}
    <p>Use <code>meta</code> to add additional metadata to your registry item. You can add any key/value pair, for your own tools to read. The CLI does not read it.</p>
    ${json(`{
  "meta": { "foo": "bar" }
}`)}
  `;
}
