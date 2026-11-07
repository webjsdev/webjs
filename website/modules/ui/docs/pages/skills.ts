import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';

/**
 * The Skills docs page, ported from shadcn's content/docs/(root)/skills.mdx
 * (#1666): the same sections in the same order, describing the WebJs agent
 * skill (.agents/skills/webjs/, with references/ui-kit.md for the kit) and
 * the MCP `ui` tool instead of shadcn's `npx skills add shadcn/ui`, which
 * has no WebJs counterpart.
 */
export const title = 'Skills';
export const description = 'Give your AI assistant deep knowledge of WebJs UI components, blocks, and patterns.';

export default async function body(toc: TocEntry[]) {
  return html`
    <p>Skills give AI assistants like Claude Code project-aware context about WebJs and WebJs UI. With the skill in your project, your AI assistant knows how to find, install, compose, and customize components and blocks using the correct APIs and patterns for your app.</p>
    <p>For example, you can ask your AI assistant to:</p>
    <ul>
      <li><em>"Add a login form with email and password fields."</em></li>
      <li><em>"Create a settings page with a form for updating profile information."</em></li>
      <li><em>"Add a confirmation dialog before deleting a project."</em></li>
      <li><em>"Install the login block and wire it to a sign-in action."</em></li>
    </ul>
    <p>The skill tells the assistant to read your project's <code>components.json</code> before it touches the kit, and to ask the kit for a component's structure rather than guess it, so it writes correct code on the first try.</p>

    <hr>

    ${heading(toc, 2, 'Install')}
    <p>An app created with <code>webjs create</code> already has the skill. The scaffold writes it to <code>.agents/skills/webjs/</code>, next to an <code>AGENTS.md</code> that points every agent at it (and a <code>CLAUDE.md</code> that points Claude Code at <code>AGENTS.md</code>). There is nothing to install.</p>
    <p>For an app that was not scaffolded, copy the <code>.agents/skills/webjs/</code> folder from the <a href="https://github.com/webjsdev/webjs">WebJs repository</a> into your project and reference it from your <code>AGENTS.md</code>. The skill is plain Markdown, a routing <code>SKILL.md</code> plus one file per topic under <code>references/</code>, so any assistant that reads files can use it.</p>

    <hr>

    ${heading(toc, 2, "What's Included")}
    <p>The skill covers building a WebJs app end to end. For WebJs UI, the part that matters is <code>references/ui-kit.md</code>, which provides your AI assistant with the following knowledge:</p>

    ${heading(toc, 3, 'Project Context')}
    <p>The kit reference loads whenever the project has a <code>components.json</code>, or when the assistant is about to write a UI primitive in an app that has not initialized the kit yet. It tells the assistant that the components live in your app under <code>components/ui</code>, so it edits your copy as freely as code it wrote itself, and that <code>init</code> is how the kit comes to exist in a fresh app. For the resolved configuration it can run <code>npx @webjsdev/ui info</code>.</p>

    ${heading(toc, 3, 'CLI Commands')}
    <p>The working reference for <code>init</code>, <code>add</code>, <code>list</code>, <code>view</code>, <code>diff</code> and <code>lint</code>: what each one writes, that resolution is local-first, that <code>add</code> leaves a class-helper component's worked example out of the file, and how to get it back with <code>view</code>.</p>

    ${heading(toc, 3, 'Blocks')}
    <p>A reach-for-it rule: before hand-writing a login or signup page, an app sidebar shell, a dashboard, a data table or a chart, list the blocks and install the closest one. It walks through finding a block, previewing its files, installing it, and binding a server action to its form.</p>

    ${heading(toc, 3, 'Composition and Theming')}
    <p>The two tiers (class helpers on native elements, and custom elements that own their ARIA), the primitives each screen state calls for (<code>empty</code>, <code>field</code>, <code>spinner</code>), the design tokens the helpers render against and how to restore them, and the opt-in design-system linter.</p>

    ${heading(toc, 3, 'MCP Server')}
    <p>The read-only WebJs MCP server's <code>ui</code> tool, which answers the same questions as the CLI in one call. A scaffolded app registers the server in its <code>.claude.json</code>:</p>
    ${codeFigure(`{
  "mcpServers": {
    "webjs": {
      "type": "stdio",
      "command": "npx",
      "args": ["@webjsdev/mcp"]
    }
  }
}`, { title: '.claude.json', lang: 'json', lineNumbers: true })}
    <p>With no arguments the <code>ui</code> tool returns the component inventory (tier, helper signatures, npm dependencies) and the block and chart names grouped by category. <code>type</code> and <code>category</code> list one kind with descriptions. <code>name</code> returns one component's helpers, paste-ready example and accessibility notes, or one block's description, dependencies, install command and files, with <code>source: true</code> adding the sources.</p>

    <hr>

    ${heading(toc, 2, 'How It Works')}
    <ol>
      <li><strong>Project detection.</strong> The assistant reads <code>AGENTS.md</code>, which routes it to the skill, and the skill routes it to the kit reference when it finds a <code>components.json</code> in your project.</li>
      <li><strong>Structure on demand.</strong> Instead of guessing a component's markup, the assistant asks the MCP <code>ui</code> tool or runs <code>npx @webjsdev/ui view &lt;name&gt;</code> and pastes the accessible structure it returns.</li>
      <li><strong>Pattern enforcement.</strong> The assistant follows the kit's composition rules: class helpers on real native elements, custom elements only where state matters, <code>field</code> for forms, semantic color tokens, and a <code>&lt;form action=\${importedAction}&gt;</code> for every write.</li>
      <li><strong>Block discovery.</strong> Before writing a page shell, the assistant lists the blocks and installs the closest one, then edits it.</li>
    </ol>
    ${commandBlock(packageCommands('list --type block'))}

    ${heading(toc, 2, 'Learn More')}
    <ul>
      <li><a href="/ui/docs/cli">CLI</a>: full CLI command reference</li>
      <li><a href="/ui/docs/blocks">Blocks</a>: find, preview and install a ready-made view</li>
      <li><a href="/ui/docs/theming">Theming</a>: CSS variables and customization</li>
      <li><a href="/ui/docs/registry">Registry</a>: building and publishing custom registries</li>
      <li><a href="/docs/ai-first">AI-first development</a>: how WebJs works with AI agents</li>
    </ul>
  `;
}
