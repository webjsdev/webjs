import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock } from '#lib/ui/docs/install.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * API Reference, ported from shadcn's content/docs/registry/api-reference.mdx
 * (#1666). shadcn documents `shadcn/registry` (fetch, resolve, add, load),
 * `shadcn/schema` and `shadcn/preset`. `@webjsdev/ui` exports three
 * subpaths (packages/ui/package.json `exports`): the zod schemas, the
 * projector the CLI's `view` and the MCP `ui` tool share, and the
 * components.json helpers. There is no fetch or install API and no preset
 * codec, and the page says so instead of inventing them.
 */
export const title = 'API Reference';
export const description = 'Programmatic API for registry schemas, the kit projector and components.json.';

const devInstall = {
  pnpm: 'pnpm add -D @webjsdev/ui',
  npm: 'npm install -D @webjsdev/ui',
  yarn: 'yarn add -D @webjsdev/ui',
  bun: 'bun add -d @webjsdev/ui',
};

const sig = (text: string) => codeFigure(text);

export default async function body(toc: TocEntry[]) {
  return html`
    <p>The <code>@webjsdev/ui</code> package exports a small programmatic API for tools that read registries, validate items, or show the kit to an agent.</p>
    <p>A WebJs app does not depend on <code>@webjsdev/ui</code> (it arrives with the WebJs CLI, and copied components import only <code>@webjsdev/core</code>), so add it as a dev dependency to use the API from a script:</p>
    ${commandBlock(devInstall)}
    <p>The package exposes three entry points:</p>
    <ul>
      <li><code>@webjsdev/ui/registry/schema</code> for the registry, item and <code>components.json</code> schemas.</li>
      <li><code>@webjsdev/ui/registry/extract</code> for the projector that turns the packaged registry into the view the CLI and the MCP server print.</li>
      <li><code>@webjsdev/ui/utils</code> for reading and writing <code>components.json</code>.</li>
    </ul>
    ${callout(html`<p>The bare <code>@webjsdev/ui</code> entry is the CLI itself and runs it when imported, so import a subpath. There is no API that fetches, resolves or installs items, and no preset codec: those happen inside the CLI commands.</p>`)}

    ${heading(toc, 2, '@webjsdev/ui/registry/schema')}
    <p>The schemas are <a href="https://zod.dev">zod</a> schemas, a wire-compatible port of shadcn's registry schema. Use them to validate registry files or a project's config.</p>
    ${codeFigure(`import { registrySchema, registryItemSchema } from '@webjsdev/ui/registry/schema';

const manifest = registrySchema.parse(JSON.parse(text));
const result = registryItemSchema.safeParse(item);
if (!result.success) console.error(result.error.issues);`)}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Export</th><th>Validates</th></tr></thead>
        <tbody>
          <tr><td><code>registrySchema</code></td><td>A <code>registry.json</code>: <code>name</code>, <code>homepage</code>, <code>items</code>.</td></tr>
          <tr><td><code>registryItemSchema</code></td><td>One registry item, as served at <code>&lt;url&gt;/&lt;name&gt;.json</code>.</td></tr>
          <tr><td><code>registryIndexSchema</code></td><td>The <code>index.json</code> array.</td></tr>
          <tr><td><code>registryItemTypeSchema</code></td><td>An item or file <code>type</code>, e.g. <code>registry:ui</code>.</td></tr>
          <tr><td><code>registryItemFileSchema</code></td><td>One entry of <code>files</code>. <code>target</code> is required for <code>registry:file</code> and <code>registry:page</code>.</td></tr>
          <tr><td><code>registryItemCssVarsSchema</code></td><td><code>cssVars</code>: <code>theme</code>, <code>light</code>, <code>dark</code>.</td></tr>
          <tr><td><code>registryItemCommonSchema</code></td><td>The item fields shared by every type.</td></tr>
          <tr><td><code>registryItemTailwindSchema</code>, <code>registryItemCssSchema</code>, <code>registryItemEnvVarsSchema</code></td><td>The <code>tailwind</code>, <code>css</code> and <code>envVars</code> fields. They validate, but the CLI does not apply them.</td></tr>
          <tr><td><code>rawConfigSchema</code></td><td>A project's <code>components.json</code>.</td></tr>
          <tr><td><code>lintConfigSchema</code>, <code>lintRuleSchema</code>, <code>lintSeveritySchema</code></td><td>The <code>lint</code> block of <code>components.json</code>.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 2, '@webjsdev/ui/registry/extract')}
    <p>The projector reads the registry that ships inside the package, with no network, and returns the agent-facing view of it. <code>webjsui view</code>, <code>webjsui list</code> and the MCP <code>ui</code> tool all call it, so a tool built on it prints what they print. Every source it returns is baked for a style, so it holds plain Tailwind classes.</p>

    ${heading(toc, 3, 'uiInventory')}
    <p>Returns one entry per component, sorted by name.</p>
    ${sig(`uiInventory(): Array<{ name: string, tier: 1 | 2, helpers: string[], dependencies: string[] }>`)}

    ${heading(toc, 3, 'uiComponent')}
    <p>Returns one component's projection, or <code>null</code> when the name is not a <code>registry:ui</code> item. <code>style</code> picks the style to bake with, <code>new-york</code> when omitted.</p>
    ${sig(`uiComponent(name: string, opts?: { style?: string }): {
  name: string, tier: 1 | 2, type: string,
  description: string, helpers: string[], example: string,
  dependencies: string[], registryDependencies: string[],
} | null`)}

    ${heading(toc, 3, 'uiComponentFiles')}
    <p>Returns a component's files, baked, as <code>add</code> writes them, or <code>null</code> for an unknown name.</p>
    ${sig(`uiComponentFiles(name: string, opts?: { style?: string }): Array<{ path: string, content: string }> | null`)}

    ${heading(toc, 3, 'uiBlocks')}
    <p>Lists blocks and charts, and components when <code>type</code> asks for them. Pass an index as the second argument to list another registry's, for example one fetched from <code>&lt;url&gt;/index.json</code>.</p>
    ${sig(`uiBlocks(
  opts?: { type?: 'ui' | 'block' | 'chart' | 'all', category?: string },
  index?: RegistryItem[],
): Array<{ name: string, type: 'ui' | 'block' | 'chart', categories: string[], description: string }>`)}
    ${codeFigure(`import { uiBlocks } from '@webjsdev/ui/registry/extract';

const index = await (await fetch('https://acme.com/r/index.json')).json();
const logins = uiBlocks({ type: 'block', category: 'login' }, index);`)}

    ${heading(toc, 3, 'uiBlock')}
    <p>Returns one block's projection by name, from the packaged registry: its description, categories, dependencies, the install command and its files with their targets. <code>source: true</code> includes the file contents.</p>
    ${sig(`uiBlock(name: string, opts?: { style?: string, source?: boolean }): BlockProjection | null`)}

    ${heading(toc, 3, 'projectBlock')}
    <p>The same projection as <code>uiBlock</code>, over an item you already have, such as one fetched from a custom registry. Returns <code>null</code> when the item is not a block.</p>
    ${sig(`projectBlock(item: RegistryItem, opts?: { style?: string, source?: boolean }): BlockProjection | null`)}

    ${heading(toc, 3, 'uiBlockIndex')}
    <p>Returns the block and chart names grouped by category, with no descriptions. This is the compact listing the MCP <code>ui</code> tool returns with no arguments.</p>
    ${sig(`uiBlockIndex(index?: RegistryItem[]): { blocks: Record<string, string[]>, charts: Record<string, string[]> }`)}

    ${heading(toc, 3, 'Other exports')}
    <ul>
      <li><code>itemKind(item)</code> returns <code>'ui'</code>, <code>'block'</code>, <code>'chart'</code> or <code>null</code>.</li>
      <li><code>primaryCategory(item)</code> returns the category a block is grouped under.</li>
      <li><code>installCommand(name)</code> returns <code>npx @webjsdev/ui add &lt;name&gt;</code>.</li>
      <li><code>renderComponentText(projection)</code> and <code>renderBlockText(projection)</code> render a projection as the text <code>view</code> prints.</li>
      <li><code>extractHelperSignatures(src)</code>, <code>extractHelperAxes(src)</code> and <code>extractDocHeader(src)</code> read a Tier-1 source's helper signatures, variant options and JSDoc header.</li>
      <li><code>BLOCK_DEFINITION</code> and <code>CHART_CATEGORY</code> are the constants the listings use.</li>
    </ul>

    ${heading(toc, 2, '@webjsdev/ui/utils')}
    <p>Reads and writes a project's <code>components.json</code>.</p>
    ${codeFigure(`import { getConfig, writeConfig, CONFIG_FILE } from '@webjsdev/ui/utils';

const config = getConfig(process.cwd());
if (config) console.log(config.aliases.ui, config.resolvedPaths.ui);`)}
    <ul>
      <li><code>getConfig(cwd?)</code> parses <code>components.json</code> with <code>rawConfigSchema</code> and adds <code>resolvedPaths</code>, the absolute paths the aliases point at. It returns <code>null</code> when the file is missing and throws when it does not conform.</li>
      <li><code>writeConfig(cwd, config)</code> writes <code>components.json</code>.</li>
      <li><code>CONFIG_FILE</code> is <code>'components.json'</code>.</li>
      <li><code>logger</code> is the CLI's console logger.</li>
    </ul>

    ${heading(toc, 2, 'Errors')}
    <p>The schemas throw a <code>ZodError</code> from <code>parse</code>, or return <code>{ success: false, error }</code> from <code>safeParse</code>. The projector functions return <code>null</code> for a name they do not know rather than throwing.</p>
  `;
}
