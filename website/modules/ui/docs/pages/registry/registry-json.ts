import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * registry.json, ported from shadcn's content/docs/registry/registry-json.mdx
 * (#1666). The fields are `registrySchema` in
 * packages/ui/src/registry/schema.js: `name`, optional `homepage`, and
 * `items`. shadcn's `include` is not in it (zod drops an unknown key, so an
 * `include` would be silently ignored), and the page says so.
 */
export const title = 'registry.json';
export const description = 'Schema for running your own component registry.';

const json = (text: string) => codeFigure(text, { lang: 'json', title: 'registry.json', lineNumbers: true });

export default async function body(toc: TocEntry[]) {
  return html`
    <p>The <code>registry.json</code> schema is used to define your custom component registry. <code>webjsui build</code> reads it, inlines each item's files, and writes the JSON files the CLI fetches.</p>
    ${json(`{
  "name": "acme",
  "homepage": "https://acme.com",
  "items": [
    {
      "name": "hello-world",
      "type": "registry:block",
      "title": "Hello World",
      "description": "A simple hello world page.",
      "registryDependencies": ["brand-button"],
      "dependencies": ["is-even@3.0.0", "zod"],
      "files": [
        {
          "path": "blocks/hello-world/page.ts",
          "type": "registry:page",
          "target": "app/hello/page.ts"
        }
      ]
    }
  ]
}`)}
    <p>There is no <code>include</code> field to compose a registry from several <code>registry.json</code> files. Keep every item in the one file. See <a href="/ui/docs/registry/getting-started">Getting Started</a>.</p>

    ${heading(toc, 2, 'Definitions')}
    <p>The schema is <code>registrySchema</code>, exported from <code>@webjsdev/ui/registry/schema</code>. See the <a href="/ui/docs/registry/api-reference">API Reference</a>.</p>

    ${heading(toc, 3, '$schema')}
    <p>The <code>$schema</code> property is accepted and ignored. The CLI does not fetch or check it, so you can point it at a JSON Schema your editor understands or leave it out.</p>

    ${heading(toc, 3, 'name')}
    <p>The <code>name</code> property is used to specify the name of your registry. It is required, and <code>build</code> copies it into the <code>registry.json</code> it writes.</p>
    ${json(`{
  "name": "acme"
}`)}

    ${heading(toc, 3, 'homepage')}
    <p>The homepage of your registry. It is optional metadata. The <a href="/ui/docs/directory">directory</a> links to the homepage its own entry for your registry names.</p>
    ${json(`{
  "homepage": "https://acme.com"
}`)}

    ${heading(toc, 3, 'items')}
    <p>The <code>items</code> in your registry. Each item must implement the <a href="/ui/docs/registry/registry-item-json">registry-item schema specification</a>. <code>items</code> is required.</p>
    ${json(`{
  "items": [
    {
      "name": "hello-world",
      "type": "registry:block",
      "title": "Hello World",
      "description": "A simple hello world page.",
      "registryDependencies": ["brand-button"],
      "dependencies": ["is-even@3.0.0", "zod"],
      "files": [
        {
          "path": "blocks/hello-world/page.ts",
          "type": "registry:page",
          "target": "app/hello/page.ts"
        }
      ]
    }
  ]
}`)}
    <p>Each file's <code>path</code> is read relative to <code>registry.json</code>. A file that already carries <code>content</code> is written as is, and <code>build</code> reads the file at <code>path</code> for every other one.</p>
    <p>Item names must be unique, since each one becomes <code>&lt;name&gt;.json</code> in the output and a later item with the same name overwrites the earlier file.</p>
    <p>See the <a href="/ui/docs/registry/registry-item-json">registry-item schema documentation</a> for more information.</p>
  `;
}
