import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * MCP Server, ported from shadcn's content/docs/registry/mcp.mdx (#1666).
 * shadcn's MCP server reads any registry configured in components.json. The
 * WebJs MCP server's `ui` tool reads the kit that ships inside
 * `@webjsdev/ui` and takes no registry argument (packages/mcp/src/mcp.js,
 * UI_SCHEMA), so an agent reaches a custom registry through the CLI's JSON
 * output instead. The page says that, and keeps shadcn's best practices,
 * which hold for both paths.
 */
export const title = 'MCP Server';
export const description = 'How AI assistants find and install items from your registry.';

export default async function body(toc: TocEntry[]) {
  return html`
    <p>Every WebJs app ships a read-only <a href="/docs/ai-first" data-no-router>MCP server</a>, reachable as <code>webjs mcp</code> or <code>npx @webjsdev/mcp</code>. Its <code>ui</code> tool lists the WebJs UI components, blocks and charts, and returns one item's helpers, example, install command and files.</p>
    ${callout(html`<p>The <code>ui</code> tool reads the registry that ships inside the installed <code>@webjsdev/ui</code> package. An agent reaches your own registry through the CLI, which has a JSON output for exactly this.</p>`, { title: 'The MCP server reads the WebJs UI registry.' })}

    ${heading(toc, 2, 'Prerequisites')}
    <p>The CLI reads your registry's index to list it. Make sure <code>&lt;url&gt;/index.json</code> is served, as a JSON array of your items. <code>webjsui build</code> writes it beside the item files.</p>
    <p>For example, if your items are served at <code>https://acme.com/r/[name].json</code>, you should have a file at <code>https://acme.com/r/index.json</code>. Each entry must conform to the <a href="/ui/docs/registry/registry-item-json">registry item schema</a>.</p>

    ${heading(toc, 2, 'Configuring an Agent')}
    <p>Tell your registry's consumers to give their agent the registry URL and these commands, for example in their <code>AGENTS.md</code>:</p>
    ${codeFigure(`## Acme components

Before writing a component, check the Acme registry:

- List it: npx @webjsdev/ui list --registry https://acme.com/r --json
- Read an item: npx @webjsdev/ui view <name> --registry https://acme.com/r
- Install it: npx @webjsdev/ui add <name> --registry https://acme.com/r`, { lang: 'md', title: 'AGENTS.md', lineNumbers: true })}
    <p><code>list --json</code> prints one compact array of <code>{ name, type, categories, description }</code>, which an agent can read in one call. <code>view</code> prints the item and the source of every file it would write.</p>
    ${commandBlock(packageCommands('list --registry https://acme.com/r --json'))}
    <p>Then try prompts such as:</p>
    <ul>
      <li>Show me the components in the Acme registry</li>
      <li>Create a landing page using items from the Acme registry</li>
    </ul>
    <p>For the WebJs UI registry itself, the agent can use the MCP <code>ui</code> tool directly. See the <a href="/ui/docs/skills">Skills</a> page for how agents are told to look for a block before writing a view by hand.</p>

    ${heading(toc, 2, 'Best Practices')}
    <p>Here are some best practices for registries agents read:</p>
    <ol>
      <li><strong>Clear Descriptions</strong>: Add concise, informative descriptions that help AI assistants understand what a registry item is for and how to use it. <code>list</code> prints them.</li>
      <li><strong>Proper Dependencies</strong>: List all <code>dependencies</code> accurately so <code>add</code> can install them.</li>
      <li><strong>Registry Dependencies</strong>: Use <code>registryDependencies</code> to indicate relationships between items in your registry.</li>
      <li><strong>Categories</strong>: Give blocks <code>categories</code>, and keep them in the index, so <code>list --category</code> can narrow a large registry for an agent. See <a href="/ui/docs/registry/dynamic-search">Dynamic Search</a>.</li>
      <li><strong>Consistent Naming</strong>: Use kebab-case for item names and maintain consistency across your registry.</li>
    </ol>
  `;
}
