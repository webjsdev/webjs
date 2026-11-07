import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';
import { callout } from '#lib/ui/docs/callout.ts';
import { cn } from '#lib/utils/cn.ts';
import {
  accordionClass, accordionItemClass, accordionTriggerClass, accordionContentClass,
} from '#modules/ui/components/accordion.ts';
import { ChevronDownIcon, ChevronUpIcon } from '#lib/ui/lucide.ts';

/**
 * Registry Getting Started, ported from shadcn's
 * content/docs/registry/getting-started.mdx (#1666). Every command and flag
 * is read from packages/ui/src/commands/*.js, and what a registry must serve
 * from packages/ui/src/registry/fetcher.js: `<url>/<name>.json` per item with
 * its file contents inlined, and `<url>/index.json` for `list` and `diff`.
 * shadcn's `include`, its loader APIs, content negotiation and namespaces
 * have no counterpart here, and each section says what the kit does instead.
 */
export const title = 'Getting Started';
export const description = 'Learn how to get setup and run your own component registry.';

const bash = (text: string) => codeFigure(text, { lang: 'bash' });
const json = (text: string, title?: string) => codeFigure(text, { lang: 'json', title, lineNumbers: true });

const REGISTRY_JSON = `{
  "name": "acme",
  "homepage": "https://acme.com",
  "items": [
    {
      "name": "brand-button",
      "type": "registry:ui",
      "title": "Brand Button",
      "description": "A button in the Acme brand colors.",
      "files": [
        {
          "path": "components/brand-button.ts",
          "type": "registry:ui"
        }
      ]
    }
  ]
}`;

export default async function body(toc: TocEntry[]) {
  return html`
    <p>This guide will walk you through the process of setting up your own registry. It assumes you already have a project with components, helpers or other files you would like to distribute.</p>
    <p>A registry is a set of JSON files served over HTTP. The CLI reads it from a base URL you pass with <code>--registry</code>, so any host that serves static files can run one, a WebJs app included.</p>

    ${heading(toc, 2, 'Requirements')}
    <p>You are free to design and publish your custom registry as you see fit. The only requirement is that your registry items conform to the <a href="/ui/docs/registry/registry-item-json">registry-item schema specification</a>, and that the registry serves two kinds of files under one base URL:</p>
    <ul>
      <li><code>&lt;url&gt;/&lt;name&gt;.json</code> for every item, with each file's <code>content</code> inlined. <code>add</code> and <code>view</code> fetch these.</li>
      <li><code>&lt;url&gt;/index.json</code>, a JSON array of the items. <code>list</code> and <code>diff</code> fetch this.</li>
    </ul>
    <p>Your registry can be a WebJs app or any other server, static host or CDN, as long as it serves those files as JSON over HTTP. The <code>build</code> command below writes both from one <a href="/ui/docs/registry/registry-json">registry.json</a> file.</p>

    ${heading(toc, 2, 'registry.json')}
    <p>The <code>registry.json</code> is the source of the registry. It contains the registry's name, homepage, and defines all the items present in the registry. <code>webjsui build</code> reads it and writes the files the CLI fetches.</p>
    <p>Here's an example <code>registry.json</code> file:</p>
    ${json(REGISTRY_JSON, 'registry.json')}

    ${heading(toc, 2, 'Structure your registry')}
    <p>Define all items in a single root <code>registry.json</code>. Add every item to its <code>items</code> array. File paths are relative to the <code>registry.json</code> file.</p>
    <p>A registry is one <code>registry.json</code>: there is no <code>include</code> field to compose it from several files. <code>build</code> reads only <code>items</code>, so a larger registry keeps one manifest and organizes its source files in folders.</p>
    ${json(`{
  "name": "acme",
  "homepage": "https://acme.com",
  "items": [
    {
      "name": "brand-button",
      "type": "registry:ui",
      "title": "Brand Button",
      "description": "A button in the Acme brand colors.",
      "files": [
        {
          "path": "components/brand-button.ts",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "hello-world",
      "type": "registry:block",
      "title": "Hello World",
      "description": "A simple hello world page.",
      "registryDependencies": ["brand-button"],
      "files": [
        {
          "path": "blocks/hello-world/page.ts",
          "type": "registry:page",
          "target": "app/hello/page.ts"
        }
      ]
    }
  ]
}`, 'registry.json')}
    <p>This <code>registry.json</code> file must conform to the <a href="/ui/docs/registry/registry-json">registry schema specification</a>.</p>

    ${heading(toc, 2, 'Add an item')}
    ${heading(toc, 3, 'Create a UI component')}
    <p>Add your first item. Here's an example of a simple brand button, written the way the kit writes a Tier-1 component: a function that returns the classes for a native <code>&lt;button&gt;</code>.</p>
    ${codeFigure(`import { cn } from '../lib/utils.ts';

export function brandButtonClass(opts: { className?: string } = {}): string {
  return cn(
    'rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white',
    opts.className,
  );
}`, { title: 'components/brand-button.ts', lineNumbers: true })}
    ${callout(html`<p><strong>Note:</strong> This example places the component in the <code>components</code> directory and imports <code>cn()</code> as <code>../lib/utils.ts</code>, the layout the kit's own registry uses. On install, the CLI rewrites that import to the <code>cn()</code> file in the user's project, wherever their <code>components.json</code> puts it. See <a href="#guidelines">Guidelines</a>.</p>`)}
    ${codeFigure(`components
└── brand-button.ts
lib
└── utils.ts`, { lang: 'txt' })}

    ${heading(toc, 3, 'Add the item to the registry')}
    <p>To add your component to the registry, add an item definition to <code>registry.json</code>.</p>
    ${json(REGISTRY_JSON, 'registry.json')}
    <p>You define your registry item by adding a <code>name</code>, <code>type</code>, <code>title</code>, <code>description</code> and <code>files</code>.</p>
    <p>For every file you add, you must specify the <code>path</code> and <code>type</code> of the file. The <code>path</code> is relative to the <code>registry.json</code> file. The <code>type</code> decides the folder the file is written to in the user's project, unless the file names a <code>target</code>.</p>
    <p>You can read more about the registry item schema and file types in the <a href="/ui/docs/registry/registry-item-json">registry item schema docs</a>.</p>

    ${heading(toc, 2, 'Serve your registry')}
    <p>You can serve your registry as static JSON files or from route handlers.</p>

    ${heading(toc, 3, 'Option A: Static JSON files')}
    <p>Run the build command to generate static registry JSON files.</p>
    ${commandBlock(packageCommands('build'))}
    <p><code>build</code> reads <code>registry.json</code>, inlines the content of every file it lists, and writes one <code>&lt;name&gt;.json</code> per item, the <code>index.json</code> the CLI lists from, and a copy of the manifest as <code>registry.json</code>.</p>
    ${callout(html`<p><strong>Note:</strong> By default, the build command writes the registry JSON files to <code>./r</code>, e.g. <code>r/brand-button.json</code>. You can change the output directory by passing the <code>--output</code> option. See the <a href="/ui/docs/cli#build">build command</a> for more information.</p>`)}
    <p>A WebJs app serves everything under <code>public/</code> at <code>/public/</code>, so build into it:</p>
    ${commandBlock(packageCommands('build --output public/r'))}
    <p>Then run the app.</p>
    ${bash('npm run dev')}
    <p>Your files will now be served at <code>http://localhost:8080/public/r/[NAME].json</code> e.g. <code>http://localhost:8080/public/r/brand-button.json</code>, and the registry's base URL is <code>http://localhost:8080/public/r</code>.</p>

    ${heading(toc, 3, 'Option B: Route handlers')}
    <p>If you want to serve registry JSON from a route, a WebJs <code>route.ts</code> handler can answer <code>/r/&lt;name&gt;.json</code>. The kit has no loader API that composes items at request time, so the route below serves the files <code>build</code> wrote. It is the same shape as the route webjs.dev itself serves the WebJs UI registry from.</p>
    ${codeFigure(`import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'registry-out');

export async function GET(_req: Request, { params }: { params: { name: string } }) {
  // The CLI asks for <name>.json, and the segment arrives with the suffix.
  const name = params.name.replace(/\\.json$/, '');
  if (!/^[a-z0-9-]+$/.test(name)) {
    return Response.json({ error: 'Not found.' }, { status: 404 });
  }
  try {
    const body = await readFile(join(OUT, \`\${name}.json\`), 'utf8');
    return new Response(body, { headers: { 'content-type': 'application/json' } });
  } catch {
    return Response.json({ error: \`Registry item "\${name}" was not found.\` }, { status: 404 });
  }
}`, { title: 'app/r/[name]/route.ts', lineNumbers: true })}
    <p>Build into that folder with <code>build --output registry-out</code>. The same route answers <code>/r/index.json</code>, since <code>index</code> is just another file in the output.</p>

    <div data-slot="accordion" class=${cn(accordionClass(), 'not-typeset mt-6')}>
      <details name="registry-content-negotiation" data-slot="accordion-item" class=${accordionItemClass()}>
        <summary data-slot="accordion-trigger" class=${accordionTriggerClass()}>
          Content negotiation
          ${ChevronDownIcon('pointer-events-none ml-auto size-4 shrink-0 text-muted-foreground group-open:hidden')}
          ${ChevronUpIcon('pointer-events-none ml-auto hidden size-4 shrink-0 text-muted-foreground group-open:inline')}
        </summary>
        <div data-slot="accordion-content" class=${accordionContentClass()}>
          <p>The CLI sends no vendor <code>Accept</code> header that would let one URL serve HTML to a browser and JSON to the CLI. It requests <code>&lt;url&gt;/&lt;name&gt;.json</code> with a plain <code>fetch</code> and no custom headers, so it cannot be told apart from any other client. Serve the registry under its own path, such as <code>/r</code>, rather than at the root of a site.</p>
        </div>
      </details>
    </div>

    ${heading(toc, 2, 'Test your registry')}
    <p>After your registry is being served, test it with the same CLI commands that other developers will use. Every command that reads a registry takes its base URL with <code>--registry</code>.</p>

    ${heading(toc, 3, 'Using URL')}
    <p><code>list</code> reads <code>&lt;url&gt;/index.json</code>. <code>view</code> and <code>add</code> read <code>&lt;url&gt;/&lt;name&gt;.json</code> for the item you name.</p>
    <h4>List items</h4>
    <p>Start by confirming that the registry index can be read.</p>
    ${commandBlock(packageCommands('list --registry http://localhost:8080/public/r'))}
    <p><code>list</code> shows the items typed <code>registry:ui</code> and <code>registry:block</code>, in Components, Blocks and Charts groups. Items of other types install with <code>add</code> but are not listed.</p>
    <h4>Search items</h4>
    <p><code>search</code> is another name for <code>list</code>. Its argument filters by a substring of the item name.</p>
    ${commandBlock(packageCommands('search button --registry http://localhost:8080/public/r'))}
    <h4>View an item</h4>
    <p>Then view one registry item by name.</p>
    ${commandBlock(packageCommands('view brand-button --registry http://localhost:8080/public/r'))}
    <h4>Add an item</h4>
    <p>To test the install flow, run <code>add</code> from a project where you want to install the item. The project needs a <code>components.json</code>, which <code>webjs ui init</code> writes.</p>
    ${commandBlock(packageCommands('add brand-button --registry http://localhost:8080/public/r'))}

    ${heading(toc, 3, 'Using an environment variable')}
    <p>The CLI has no namespaces, so there is no <code>@acme/brand-button</code> address and no <code>registry add</code> command. When you run several commands against one registry, set the <code>REGISTRY_URL</code> environment variable instead of passing <code>--registry</code> each time. It changes the default for every command.</p>
    ${bash(`export REGISTRY_URL=http://localhost:8080/public/r

npx @webjsdev/ui list
npx @webjsdev/ui add brand-button`)}
    <p>See the <a href="/ui/docs/registry/namespace">Namespaces</a> page for what the CLI supports in place of namespaced registries.</p>

    ${heading(toc, 2, 'Publish your registry')}
    <p>To make your registry available to other developers, publish your project to a public URL. Once deployed, users install items by passing your base URL to <code>add</code>.</p>

    ${heading(toc, 3, 'Share install instructions')}
    <p>Tell users the command, with your base URL in it. The base URL is the folder that holds the item files, not a template, and the CLI appends <code>/&lt;name&gt;.json</code> to it.</p>
    ${commandBlock(packageCommands('add brand-button --registry https://acme.com/r'))}
    <p><code>components.json</code> accepts a <code>registries</code> field so an older file still parses, but the CLI does not read it. Each command names its registry with <code>--registry</code> or <code>REGISTRY_URL</code>.</p>

    ${heading(toc, 3, 'Add your registry to the directory')}
    <p>If your registry is open source and publicly available, you can add it to the <a href="/ui/docs/directory">registry directory</a>, which shows readers the command that installs from it.</p>
    <p>See the <a href="/ui/docs/registry/registry-index">Registry Directory</a> docs for the submission requirements.</p>

    ${heading(toc, 2, 'Guidelines')}
    <p>Here are some guidelines to follow when building components for a registry.</p>
    <ul>
      <li>Lay your files out the way the kit's registry does: components in <code>components/&lt;name&gt;.ts</code>, the <code>cn()</code> helper imported as <code>../lib/utils.ts</code>. On install the CLI rewrites a relative import that lands on <code>lib/utils.ts</code>, <code>lib/dom.ts</code>, <code>lib/icons.ts</code>, a <code>components/&lt;name&gt;.ts</code> file, or another file of the same item, to wherever that file lands in the user's project. Any other import is left as written.</li>
      <li>For blocks, the following properties are required: <code>name</code>, <code>description</code>, <code>type</code> and <code>files</code>. Give every block file a <code>target</code>, so a page lands at its route (<code>app/hello/page.ts</code>) instead of at its registry path.</li>
      <li>It is recommended to add a proper name and description to your registry item. This helps LLMs understand the component and its purpose, and <code>list</code> prints the description.</li>
      <li>Make sure to list all registry dependencies in <code>registryDependencies</code>. A registry dependency is the name of another item in the same registry, eg. <code>brand-button</code>. It is fetched from the same base URL as the item that lists it.</li>
      <li>Make sure to list all dependencies in <code>dependencies</code>. A dependency is the name of an npm package eg. <code>zod</code>. To set a version, you can use the <code>name@version</code> format eg. <code>zod@^3.20.0</code>. <code>add</code> installs them with the package manager the project uses.</li>
      <li>Write the component for a WebJs app: a Tier-1 helper returns classes for a native element, and a Tier-2 element extends <code>WebComponent</code> from <code>@webjsdev/core</code>. See the <a href="/ui/docs">introduction</a> for the two tiers.</li>
    </ul>
  `;
}
