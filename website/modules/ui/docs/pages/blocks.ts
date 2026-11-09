import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * The Blocks docs page (#1666). shadcn's (root)/_blocks.mdx is a guide to
 * contributing a block to its library; this page keeps that guide's
 * structure (steps, the registry entry, categories, guidelines) and leads
 * with what a WebJs reader needs first, the install flow D18 builds:
 * `list --type block`, `view --files-only`, `add`. Every flag and behaviour
 * is read from packages/ui/src/commands/{list,view,add}.js.
 */
export const title = 'Blocks';
export const description = 'Install a ready-made view, then make it yours. Or contribute one to the blocks library.';

const steps = 'steps mb-0 pt-2 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step';

export default async function body(toc: TocEntry[]) {
  return html`
    <p>A block is a ready-made view you install and then edit: a login or signup page, an app sidebar shell, a dashboard, a chart. Its files land in your app as code you own, so you spend your time on the app instead of rebuilding a page shell. Browse them on the <a href="/ui/blocks">blocks page</a>.</p>
    <p>On the wire a block is a <code>registry:block</code> item. A chart is a block whose categories include <code>chart</code>.</p>

    ${heading(toc, 2, 'Find a block')}
    <p>List the blocks with their one-line descriptions:</p>
    ${commandBlock(packageCommands('list --type block'))}
    <p>Narrow the list to one category, or print it as JSON for a script or an agent:</p>
    ${commandBlock(packageCommands('list --category login --json'))}
    <p>The JSON form is one compact array of <code>{ name, type, categories, description }</code>. <code>--type chart</code> lists the charts the same way. An agent with the WebJs MCP server can ask the <code>ui</code> tool instead: with no arguments it returns the block and chart names grouped by category, and <code>{ type: "block" }</code> or <code>{ category: "login" }</code> adds the descriptions. See <a href="/ui/docs/skills">Skills</a>.</p>

    ${heading(toc, 2, 'Preview a block')}
    <p>Before installing, see what a block writes and where:</p>
    ${commandBlock(packageCommands('view login-03 --files-only'))}
    ${codeFigure(`# login-03  (block)

A login page with a muted background color.

categories: authentication, login
registry deps: lib-utils, button, card, field, input
npm: @webjsdev/core

Install: npx @webjsdev/ui add login-03

Files:
  app/login/page.ts
  components/login-form.ts`, { lang: 'txt' })}
    <p>Without <code>--files-only</code>, <code>view</code> prints the sources after the file list, baked with your project's style. <code>--json</code> prints the same projection as one document.</p>

    ${heading(toc, 2, 'Install a block')}
    <div class=${steps}>
      ${heading(toc, 3, 'Run the add command')}
      ${commandBlock(packageCommands('add login-03'))}
      <p>The command installs the components the block uses, writes each of the block's files to its target and prints the list of files it wrote.</p>

      ${heading(toc, 3, 'Open the page')}
      <p>The page lands at its route under <code>app/</code>, so <code>login-03</code> is served at <code>/login</code> as soon as <code>npm run dev</code> picks it up.</p>
      <p>A block page renders inside your root layout, like every page. The root layout <code>webjs create</code> writes puts every page in a centered <code>max-w-5xl</code> column under a navbar, and a full-screen block (the login, signup, sidebar and dashboard blocks) needs the whole viewport. Let the root layout render <code>\${children}</code> bare, and move the column into a route group's layout, such as <code>app/(site)/layout.ts</code>, for the pages that want it.</p>

      ${heading(toc, 3, 'Wire the form')}
      <p>A block ships no server action, so its <code>&lt;form&gt;</code> has no <code>action</code> yet. Bind your own <code>'use server'</code> action to it:</p>
      ${codeFigure(`import { signIn } from '#modules/auth/actions/sign-in.server.ts';

export function loginForm(opts: { class?: string } = {}) {
  return html\`
    <form action=\${signIn} class=\${cn('flex flex-col gap-6', opts.class)}>
      ...
    </form>
  \`;
}`, { title: 'components/login-form.ts', lineNumbers: true })}
      <p>The framework then supplies <code>method="post"</code>, and the form submits with JavaScript off, re-renders with <code>fieldErrors</code> and <code>values</code> on a failure, and follows the redirect on success. See <a href="/ui/docs/forms">Forms</a>.</p>

      ${heading(toc, 3, 'Make it yours')}
      <p>Rename the route, change the copy, swap the logo and the cover image. The files are yours, and nothing upstream changes them again.</p>
    </div>

    ${heading(toc, 2, 'What add does')}
    <p>A block installs through the same <code>add</code> command as a component, with a few differences that follow from its files being app code.</p>
    <ul>
      <li><strong>Every file has a target.</strong> Each one lands at its own path under the app (<code>app/...</code>, <code>components/...</code>, <code>modules/...</code>, <code>public/...</code>) rather than in your <code>components/ui</code> folder.</li>
      <li><strong>Imports are rewritten.</strong> A block's files import with registry-relative paths. <code>add</code> rewrites every one to where the imported file landed: a kit component to your <code>ui</code> alias, the <code>cn()</code> helper to your <code>utils</code> alias, another file of the same block to its own target.</li>
      <li><strong>Existing files are kept.</strong> A file that already exists is never replaced without <code>--overwrite</code>, not even under <code>--yes</code>. Blocks of one family share targets (every login block writes <code>app/login/page.ts</code>), so installing a second one keeps the first one's files unless you ask. Families can overlap too: every sidebar block and <code>dashboard-01</code> write <code>app/dashboard/page.ts</code>, <code>components/app-sidebar.ts</code>, <code>components/nav-main.ts</code> and <code>components/nav-user.ts</code>, so adding <code>dashboard-01</code> after <code>sidebar-07</code> keeps the sidebar block's page and parts and leaves the dashboard's other files unused. Install one app shell per app, or pass <code>--overwrite</code> to switch.</li>
      <li><strong>Missing tokens are added.</strong> A block that needs design tokens your theme may lack carries them, and <code>add</code> adds only the ones your stylesheet's <code>:root</code>, <code>.dark</code> or <code>@theme inline</code> block does not define. A token you already set is left alone.</li>
      <li><strong>Nothing is stripped.</strong> A block's files are written whole, with no example removed.</li>
    </ul>
    <p><code>diff</code> includes installed blocks, so <code>npx @webjsdev/ui diff login-03</code> shows how your copy has moved from the registry's.</p>

    ${heading(toc, 2, 'Charts')}
    <p>A chart installs the same way and writes one file, <code>components/charts/&lt;name&gt;.ts</code>, plus the <code>chart</code> and <code>card</code> components it uses. Its default export renders the chart's card, so render it from any page:</p>
    ${commandBlock(packageCommands('add chart-bar-interactive'))}
    ${codeFigure(`import { html } from '@webjsdev/core';
import ChartBarInteractive from '#components/charts/chart-bar-interactive.ts';

export default function Page() {
  return html\`<main class="p-8">\${ChartBarInteractive()}</main>\`;
}`, { title: 'app/stats/page.ts', lineNumbers: true })}
    <p>Browse every chart in the <a href="/ui/charts/area">Charts Library</a>.</p>


    ${heading(toc, 2, 'Add a block to the kit')}
    <p>We'd love to see all types of blocks: applications, marketing, products, and more. A block is contributed to the kit's registry in the WebJs repository.</p>
    <div class=${steps}>
      ${heading(toc, 3, 'Fork the repository')}
      ${codeFigure(`git clone https://github.com/webjsdev/webjs.git`, { lang: 'bash' })}

      ${heading(toc, 3, 'Create a new branch')}
      ${codeFigure(`git checkout -b username/my-new-block`, { lang: 'bash' })}

      ${heading(toc, 3, 'Create the block folder')}
      <p>Create a folder named in kebab-case under <code>packages/ui/packages/registry/blocks</code>, and add the block's files to it. A block can be one file or a page with its own parts.</p>
      ${codeFigure(`packages
└── ui
    └── packages
        └── registry
            └── blocks
                └── login-01
                    ├── page.ts
                    └── components
                        └── login-form.ts`, { lang: 'txt' })}

      ${heading(toc, 3, 'Add the block to registry.json')}
      <p>Add an item to <code>packages/ui/packages/registry/registry.json</code>. It follows the same item schema as a component, with a <code>target</code> on every file.</p>
      ${codeFigure(`{
  "name": "login-01",
  "type": "registry:block",
  "title": "Login 01",
  "description": "A simple login form.",
  "categories": ["authentication", "login"],
  "registryDependencies": ["lib-utils", "button", "card", "field", "input"],
  "dependencies": ["@webjsdev/core"],
  "files": [
    {
      "path": "blocks/login-01/page.ts",
      "type": "registry:page",
      "target": "app/login/page.ts"
    },
    {
      "path": "blocks/login-01/components/login-form.ts",
      "type": "registry:component",
      "target": "components/login-form.ts"
    }
  ]
}`, { title: 'packages/ui/packages/registry/registry.json', lang: 'json', lineNumbers: true })}

      ${heading(toc, 3, 'Run the tests')}
      ${codeFigure(`npm test --workspace=@webjsdev/ui`, { lang: 'bash' })}
      <p>The block tests check that every file has a target under the app, exists and is not empty, that every relative import resolves to a file the install also writes, and they install the block into a scratch app and render its page on the server.</p>

      ${heading(toc, 3, 'Submit a pull request')}
      <p>Commit your changes and open a pull request. Once it is merged and released, the block is listed by <code>list</code> and installs with <code>add</code>.</p>
    </div>

    ${heading(toc, 2, 'Categories')}
    <p>The <code>categories</code> property organizes blocks in the registry, broad to specific: <code>["authentication", "login"]</code>, <code>["chart", "area"]</code>. <code>list --category</code> and the MCP <code>ui</code> tool group and filter by them, and a block whose categories include <code>chart</code> is listed as a chart.</p>

    ${heading(toc, 2, 'Guidelines')}
    <p>Here are some guidelines to follow when contributing to the blocks library.</p>
    <ul>
      <li>The following properties are required for the block definition: <code>name</code>, <code>description</code>, <code>type</code>, <code>files</code>, and <code>categories</code>.</li>
      <li>Every file needs a <code>target</code> under the app. A page goes under <code>app/</code> so the file router serves it.</li>
      <li>List every component the block imports in <code>registryDependencies</code>, plus <code>lib-utils</code> when it uses <code>cn()</code>.</li>
      <li><strong>Imports are registry-relative</strong>, for example <code>'../../../components/card.ts'</code> or <code>'./components/login-form.ts'</code>. <code>add</code> rewrites them to the app's aliases.</li>
      <li>A page is a server-rendered page module: a default-exported function, plus a <code>metadata</code> export.</li>
      <li>A part that is not interactive is a fragment helper, a function returning an <code>html</code> template, not a custom element. Two blocks can share a part's name, and a tag can be defined only once per page session.</li>
      <li>A form is a real <code>&lt;form&gt;</code> with named controls and no <code>action</code>. Its header comment says to bind one.</li>
      <li>Draw icons and brand marks as inline SVG.</li>
      <li>Compose the kit's helpers rather than writing their classes by hand, so the block takes the app's style when it is installed.</li>
    </ul>
    ${callout(html`Do not reach for a third-party runtime dependency in a block. The kit takes none, and a block is held to the same rule.`, { title: 'Note' })}
  `;
}
