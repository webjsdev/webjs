import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * Dynamic Search, ported from shadcn's
 * content/docs/registry/dynamic-search.mdx (#1666). shadcn forwards
 * `q`, `type`, `limit` and `offset` to the registry and honours a
 * `pagination` object in the reply. This CLI's `list` (alias `search`)
 * fetches `<url>/index.json` with no query string and filters locally
 * (packages/ui/src/commands/list.js), so there is no server-side search to
 * implement. The page says that and documents the local filters instead.
 */
export const title = 'Dynamic Search';
export const description = 'How the CLI searches a registry, and what a large registry can do.';

export default async function body(toc: TocEntry[]) {
  return html`
    <p><code>search</code> is another name for <code>list</code>. It fetches your registry's <code>index.json</code> and filters the items locally. This works for any registry and requires nothing more than a static file.</p>
    ${callout(html`<p>The CLI filters the index it fetched, so every registry gets search from a static <code>index.json</code>, with nothing to implement on the server.</p>`, { title: 'Search runs in the CLI.' })}

    ${heading(toc, 2, 'How It Works')}
    <p>When you run <code>search</code>, the CLI requests the index once and filters what comes back:</p>
    ${commandBlock(packageCommands('search button --registry https://acme.com/r'))}
    ${codeFigure('GET https://acme.com/r/index.json', { lang: 'txt' })}
    <p>The index must be a JSON array of registry items. The CLI keeps the items typed <code>registry:ui</code> and <code>registry:block</code>, applies the filters below, and prints them in groups, Components then Blocks.</p>

    ${heading(toc, 2, 'Filters')}
    <p>Every filter runs in the CLI, against the index it fetched.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Filter</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>[filter]</code></td><td>Keeps the items whose name contains this substring.</td></tr>
          <tr><td><code>--type &lt;type&gt;</code></td><td><code>ui</code>, <code>block</code>, <code>chart</code> or <code>all</code> (the default). A chart is a <code>registry:block</code> item with the <code>chart</code> category.</td></tr>
          <tr><td><code>--category &lt;name&gt;</code></td><td>Keeps the blocks and charts whose <code>categories</code> include this name.</td></tr>
          <tr><td><code>--json</code></td><td>Prints one compact JSON array of <code>{ name, type, categories, description }</code>, for a script or an agent.</td></tr>
        </tbody>
      </table>
    </div>
    ${commandBlock(packageCommands('list --type block --category login --json --registry https://acme.com/r'))}

    ${heading(toc, 2, 'Response Format')}
    <p>Serve the whole index as a JSON array. <code>webjsui build</code> writes one with each item's <code>name</code>, <code>type</code> and <code>description</code>, which keeps it small however large the registry grows, since no file contents are in it.</p>
    ${codeFigure(`[
  { "name": "brand-button", "type": "registry:ui", "description": "A button in the Acme brand colors." },
  { "name": "login-01", "type": "registry:block", "description": "A simple login form." }
]`, { lang: 'json', title: 'index.json', lineNumbers: true })}
    <p>The <code>--category</code> filter reads each entry's <code>categories</code>, which the index <code>build</code> writes leaves out. A registry that wants category filtering serves an index whose entries carry <code>categories</code>, from its own route or script.</p>

    ${heading(toc, 2, 'Large Registries')}
    <p>For a registry with thousands of items, keep the index lean: names, types, descriptions and categories, never contents. The CLI downloads it once per command. Each item's full JSON is fetched only when someone views or installs that item.</p>

    ${heading(toc, 2, 'Testing')}
    <p>Test your index with <code>curl</code>:</p>
    ${codeFigure('curl https://acme.com/r/index.json', { lang: 'bash' })}
    <p>Then verify with the CLI:</p>
    ${commandBlock(packageCommands('search button --registry https://acme.com/r'))}
  `;
}
