import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';
import { loadRegistryItem } from '#modules/ui/queries/registry.server.ts';

/**
 * Installation, ported from shadcn's content/docs/installation/index.mdx and
 * manual.mdx (#1666). shadcn's index picks a framework guide (Next.js, Vite,
 * Laravel and the rest). The kit targets WebJs apps only (package invariant
 * 7), so the three starting points are a new app (`webjs create`, which
 * already initialises the kit), an existing WebJs app (`init`), and the
 * manual steps, which take Manual's place on this page. The theme in the
 * manual steps is read from the registry's theme-neutral item, so it is the
 * file `init` installs.
 */
export const title = 'Installation';
export const description = 'How to install dependencies and structure your app.';

const steps = 'steps mb-0 pt-2 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step';

function card(href: string, label: string, text: string) {
  return html`<a href=${href} class="flex flex-col items-start gap-1 rounded-xl bg-surface p-6 text-sm text-surface-foreground no-underline transition-colors hover:bg-surface/80">
    <div class="font-medium">${label}</div>
    <div class="leading-relaxed text-muted-foreground">${text}</div>
  </a>`;
}

export default async function body(toc: TocEntry[]) {
  const theme = await loadRegistryItem('theme-neutral');
  const themeCss = theme?.files?.[0]?.content ?? '';

  return html`
    <p>WebJs UI is the component library for WebJs apps. Choose the setup that matches your starting point.</p>
    <div class="not-typeset mt-6 grid gap-4 sm:grid-cols-3 sm:gap-6">
      ${card('#use-the-cli', 'Use the CLI', 'Scaffold a new WebJs app with the kit already set up.')}
      ${card('#existing-project', 'Existing Project', 'Add WebJs UI to a WebJs app you already created.')}
      ${card('#manual-installation', 'Manual Installation', 'Set up every file by hand.')}
    </div>

    ${heading(toc, 2, 'Use the CLI')}
    <p>Use the CLI to scaffold a new project directly from the terminal:</p>
    ${codeFigure(`npm create webjs@latest my-app
cd my-app && npm run dev`, { lang: 'bash' })}
    <p>A new app is ready for the kit. <code>webjs create</code> writes the same <code>components.json</code>, <code>lib/utils/cn.ts</code> and theme that <code>init</code> would, and leaves <code>components/ui/</code> empty for you to fill. Add the components you need:</p>
    ${commandBlock(packageCommands('add button card dialog'))}
    <p>Inside a WebJs app, <code>webjs ui</code> runs the same commands, since <code>@webjsdev/ui</code> ships with the WebJs CLI: <code>webjs ui add button card dialog</code>.</p>

    ${heading(toc, 2, 'Existing Project')}
    <p>Run <code>init</code> in the app's root. It asks for a base color and the path of your Tailwind CSS file, then writes <code>components.json</code>, copies the <code>cn()</code> helper to <code>lib/utils/cn.ts</code> (with <code>lib/utils/dom.ts</code> beside it), and appends the theme tokens to the stylesheet.</p>
    ${commandBlock(packageCommands('init'))}
    <p>Point it at the stylesheet your app compiles. Its default, <code>styles/globals.css</code>, is the path <code>webjs create</code> uses for the CLI's copy of the theme. Running <code>init</code> again is safe: it keeps an existing <code>components.json</code> and helper files as they are unless you pass <code>--overwrite</code>.</p>
    <p>Then add components:</p>
    ${commandBlock(packageCommands('add button'))}
    ${callout(html`The kit is copied into your app, not imported from a package at runtime. Tier-2 elements import <code>@webjsdev/core</code>, which every WebJs app already depends on, and <code>add</code> installs it when you add a Tier-2 component.`, { className: 'mt-6' })}

    ${heading(toc, 2, 'Manual Installation')}
    <div class=${steps}>
      ${heading(toc, 3, 'Add Tailwind CSS')}
      <p>Components are styled using Tailwind CSS v4. A WebJs app made with <code>webjs create</code> already compiles <code>public/input.css</code> into <code>public/tailwind.css</code>, which its root layout links. Otherwise, <a href="https://tailwindcss.com/docs/installation/tailwind-cli">follow the Tailwind CLI installation instructions</a> and compile your entry the same way.</p>
      ${commandBlock({ npm: 'npm install tailwindcss @tailwindcss/cli', pnpm: 'pnpm add tailwindcss @tailwindcss/cli', yarn: 'yarn add tailwindcss @tailwindcss/cli', bun: 'bun add tailwindcss @tailwindcss/cli' })}

      ${heading(toc, 3, 'Add dependencies')}
      <p>The kit has one runtime dependency, <code>@webjsdev/core</code>, which the Tier-2 elements extend. A WebJs app already has it. There is no clsx, tailwind-merge, class-variance-authority, Radix or icon package to install.</p>
      ${commandBlock({ npm: 'npm install @webjsdev/core', pnpm: 'pnpm add @webjsdev/core', yarn: 'yarn add @webjsdev/core', bun: 'bun add @webjsdev/core' })}

      ${heading(toc, 3, 'Configure import aliases')}
      <p>WebJs apps use the <code>imports</code> field of <code>package.json</code> for their aliases. Node and Bun resolve it at runtime with no build step and no <code>tsconfig.json</code> paths.</p>
      ${codeFigure(`{
  "imports": {
    "#*": "./*"
  }
}`, { title: 'package.json', lang: 'json', lineNumbers: true })}
      <p>That one entry makes every top-level folder an alias: <code>#components/ui/button.ts</code>, <code>#lib/utils/cn.ts</code>. See the <a href="/ui/docs/package-imports">package imports guide</a> for the details.</p>

      ${heading(toc, 3, 'Configure styles')}
      <p>Add the following to the stylesheet your app compiles, after <code>@import "tailwindcss";</code>. You can learn more about using CSS variables for theming in the <a href="/ui/docs/theming">theming section</a>.</p>
      ${codeFigure(`@import "tailwindcss";\n\n` + themeCss, { title: 'public/input.css', lang: 'css', lineNumbers: true })}

      ${heading(toc, 3, 'Add a cn helper')}
      <p>Components merge their classes with <code>cn()</code>, a small hand-written class merger in place of clsx and tailwind-merge, plus <code>onBeforeCache()</code>, a client-only helper kept in its own file. Print each one and save its source, the lines after the <code># lib/...</code> header, under <code>lib/utils/</code>:</p>
      ${commandBlock(packageCommands('view lib-utils --source'))}
      ${commandBlock(packageCommands('view lib-dom --source'))}
      <p>Save the first as <code>lib/utils/cn.ts</code> and the second as <code>lib/utils/dom.ts</code>, beside it. The components import <code>dom.ts</code> as the sibling of the <code>cn()</code> file, so keep the two together.</p>

      ${heading(toc, 3, 'Create a components.json file')}
      <p>Create a <code>components.json</code> file in the root of your project.</p>
      ${codeFigure(`{
  "$schema": "https://ui.webjs.dev/schema.json",
  "style": "default",
  "tailwind": {
    "css": "public/input.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "components",
    "utils": "lib/utils/cn",
    "ui": "components/ui",
    "lib": "lib"
  }
}`, { title: 'components.json', lang: 'json', lineNumbers: true })}
      <p>The aliases are folders relative to the project root, and <code>utils</code> names the <code>cn()</code> file without its extension. See <a href="/ui/docs/components-json">components.json</a> for every key.</p>

      ${heading(toc, 3, "That's it")}
      <p>You can now start adding components to your project.</p>
      ${commandBlock(packageCommands('add button'))}
    </div>
  `;
}
