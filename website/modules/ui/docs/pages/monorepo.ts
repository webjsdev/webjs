import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';

/**
 * Monorepo, ported from shadcn's content/docs/(root)/monorepo.mdx (#1666).
 * shadcn's `init --monorepo` template and its shared `@workspace/ui` package
 * routing have no counterpart in the kit, so the page describes what it does
 * do in a workspace: one components.json per app, `add` run in (or pointed
 * at, with --cwd) the app, and the package manager read from the workspace
 * root's lockfile (packages/ui/src/utils/package-manager.js).
 */
export const title = 'Monorepo';
export const description = 'Using WebJs UI components and the CLI in a monorepo.';

const STEPS = 'steps mb-0 pt-2 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step';

export default async function body(toc: TocEntry[]) {
  return html`
    <p>The kit copies source into the app that asks for it, so a monorepo is a set of apps that each own their components. Every WebJs app in the workspace has its own <code>components.json</code>, its own <code>components/ui/</code> and its own theme, and the CLI installs into whichever app you point it at.</p>
    <p>The CLI understands the workspace in one place: it reads the package manager from the workspace root, so the dependencies an item needs are installed with the tool the whole repository uses.</p>

    ${heading(toc, 2, 'Getting started')}
    <div class=${STEPS}>
      ${heading(toc, 3, 'Create an app in the workspace', 'create-an-app-in-the-workspace')}
      <p>Scaffold each app with <code>webjs create</code>, inside the folder your workspace keeps its apps in:</p>
      ${codeFigure(`cd apps
webjs create web`, { lang: 'bash' })}
      <p>The scaffold writes the app's <code>components.json</code>, its <code>cn()</code> helper and its theme, so it is ready for <code>add</code>. For an app that already exists, run <code>init</code> inside it instead.</p>

      ${heading(toc, 3, 'Add components to your app', 'add-components-to-your-app')}
      <p>To add components, run the <code>add</code> command <strong>in the path of your app</strong>.</p>
      ${codeFigure(`cd apps/web`, { lang: 'bash' })}
      ${commandBlock(packageCommands('add [component]'))}
      <p>The CLI reads <code>apps/web/components.json</code> and writes the files under <code>apps/web</code>. For example, <code>add login-01</code> installs the <code>button</code>, <code>card</code>, <code>field</code> and <code>input</code> components it uses into <code>apps/web/components/ui/</code>, and the block's own page and form into <code>apps/web/app/login/page.ts</code> and <code>apps/web/components/login-form.ts</code>.</p>
      <p>From the workspace root, pass the app's directory with <code>--cwd</code> instead of changing into it:</p>
      ${commandBlock(packageCommands('add button --cwd apps/web'))}

      ${heading(toc, 3, 'Importing components', 'importing-components')}
      <p>Import the components through the app's own package imports:</p>
      ${codeFigure(`import { buttonClass } from '#components/ui/button.ts';
import { cn } from '#lib/utils/cn.ts';`)}
    </div>

    ${heading(toc, 2, 'File Structure')}
    <p>A workspace with two WebJs apps looks like this:</p>
    ${codeFigure(`apps
├── web           # An app.
│   ├── app
│   │   └── login
│   │       └── page.ts
│   ├── components
│   │   ├── login-form.ts
│   │   └── ui
│   │       └── button.ts
│   ├── lib
│   │   └── utils
│   │       ├── cn.ts
│   │       └── dom.ts
│   ├── styles
│   │   └── globals.css
│   ├── components.json
│   └── package.json
└── admin         # Another app, with its own copies.
    ├── components.json
    └── package.json
package.json      # The workspace root, with the lockfile.`, { lang: 'txt' })}

    ${heading(toc, 2, 'Requirements')}
    <ol>
      <li><p>Every app must have a <code>components.json</code> file. A <code>package.json</code> file tells your package manager how to install the dependencies. A <code>components.json</code> file tells the CLI how and where to install components.</p></li>
      <li><p>The aliases in <code>components.json</code> are directory paths relative to that app, so the defaults work unchanged in every app:</p></li>
    </ol>
    ${codeFigure(`{
  "$schema": "https://ui.webjs.dev/schema.json",
  "style": "default",
  "tailwind": {
    "css": "styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "components",
    "utils": "lib/utils/cn",
    "ui": "components/ui",
    "lib": "lib"
  },
  "iconLibrary": "lucide"
}`, { title: 'apps/web/components.json', lang: 'json', lineNumbers: true })}
    <ol start="3">
      <li><p>Use the same <code>style</code> and <code>baseColor</code> in every app that should look the same. Each app bakes its own copy, so two apps with different styles look different, which is also how you give an admin app a different look.</p></li>
      <li><p><strong>Tailwind CSS v4 has no config file, so leave <code>tailwind.config</code> out of <code>components.json</code>.</strong></p></li>
    </ol>
    <p>By following these requirements, the CLI will install components, blocks and their helpers to the correct paths in each app and rewrite their imports for you.</p>

    ${heading(toc, 2, 'Package manager')}
    <p>When an item needs an npm package (a Tier-2 element needs <code>@webjsdev/core</code>), <code>add</code> installs it with your package manager. It looks for a lockfile in the app's directory and then in each parent, stopping at the workspace root, which is the first directory with a <code>pnpm-workspace.yaml</code> or a <code>package.json</code> declaring <code>workspaces</code>. So an app inside a workspace uses the root's lockfile:</p>
    <ul>
      <li><code>pnpm-lock.yaml</code> means pnpm</li>
      <li><code>yarn.lock</code> means yarn</li>
      <li><code>bun.lock</code> or <code>bun.lockb</code> means bun</li>
      <li><code>package-lock.json</code> or <code>npm-shrinkwrap.json</code> means npm</li>
    </ul>
    <p>With no lockfile it reads the package manager that ran the command (<code>pnpm dlx</code>, <code>bunx</code> and friends set <code>npm_config_user_agent</code>), and falls back to npm.</p>

    ${heading(toc, 2, 'Sharing components across apps')}
    ${callout(html`The kit has no shared UI package mode. There is no <code>init --monorepo</code>, and <code>add</code> does not route files into a <code>@workspace/ui</code> package and import them from there, as shadcn's CLI does. Each app holds its own copy of each component.`, { className: 'mt-6' })}
    <p>That copy is what makes the component yours to edit in that app, and it is what a WebJs app can serve: the server serves the files in the app's own import graph, as native modules with no bundler. To keep two apps' copies in step, run <code>diff</code> in each app to see what changed upstream, and add the component again with <code>--overwrite</code> where you want the new version.</p>
    ${commandBlock(packageCommands('diff --cwd apps/admin'))}
  `;
}
