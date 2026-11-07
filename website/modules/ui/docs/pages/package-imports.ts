import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * Package Imports, ported from shadcn's content/docs/(root)/package-imports.mdx
 * (#1666). True for WebJs: an app resolves `#` specifiers through the native
 * package.json `imports` field (the scaffold writes the one catch-all
 * `"#*": "./*"`), while the CLI writes RELATIVE imports inside the files it
 * installs (rewriteRegistryImports in packages/ui/src/commands/add.js), so
 * components.json keeps plain directory paths. shadcn's per-framework App
 * steps and its tsconfig `moduleResolution: "bundler"` advice do not apply.
 */
export const title = 'Package Imports';
export const description = 'Import WebJs UI components with package.json imports.';

const STEPS = 'steps mb-0 pt-2 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step';

export default async function body(toc: TocEntry[]) {
  return html`
    <p>A WebJs app imports its own files through <a href="https://nodejs.org/api/packages.html#imports">package imports</a>, the <code>imports</code> field of <code>package.json</code>, and the components you add are imported the same way.</p>
    <p>Package imports let you use private <code>#...</code> import aliases from your <code>package.json</code> instead of deep <code>../../../</code> relative paths. Node 24 and later and Bun resolve them natively, so there is no build step and no <code>compilerOptions.paths</code> to keep in sync.</p>

    ${heading(toc, 2, 'Example')}
    <p>A WebJs app has one catch-all entry in its <code>package.json</code>:</p>
    ${codeFigure(`{
  "imports": {
    "#*": "./*"
  }
}`, { title: 'package.json', lang: 'json', lineNumbers: true })}
    <p>Then import the installed components using <code>#...</code> specifiers:</p>
    ${codeFigure(`import { buttonClass } from '#components/ui/button.ts';
import { cn } from '#lib/utils/cn.ts';`)}
    ${callout(html`Package import specifiers must start with <code>#</code>, and there is no slash after it: write <code>#lib/...</code>, not <code>#/lib/...</code>, because Bun does not resolve a <code>#/</code> key. Keep the file extension, since the browser loads these modules as they are, with nothing in between to guess it.`, { className: 'mt-6' })}

    ${heading(toc, 2, 'App')}
    <p>For a WebJs app that installs components into its own directory.</p>
    <div class=${STEPS}>
      ${heading(toc, 3, 'Configure package.json', 'configure-packagejson')}
      <p><code>webjs create</code> writes the <code>imports</code> entry for you. In an app that lacks it, add the catch-all, which covers every top-level directory at once:</p>
      ${codeFigure(`{
  "imports": {
    "#*": "./*"
  }
}`, { title: 'package.json', lang: 'json', lineNumbers: true })}
      <p>Because the key is one wildcard, a new top-level folder is aliased with no change here. The WebJs server reads the same map, so a <code>#</code> import resolves in the browser too, and a <code>#</code> import of a <code>.server.ts</code> file still counts as a server-only import.</p>

      ${heading(toc, 3, 'Configure TypeScript', 'configure-typescript')}
      <p>The scaffold's <code>tsconfig.json</code> already resolves package imports. It uses Node's own resolution, which reads the <code>imports</code> field, and allows the <code>.ts</code> extension in a specifier.</p>
      ${codeFigure(`{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowImportingTsExtensions": true
  }
}`, { title: 'tsconfig.json', lang: 'json', lineNumbers: true })}
      <p>You do not need <code>compilerOptions.paths</code> for these aliases.</p>

      ${heading(toc, 3, 'Configure components.json', 'configure-componentsjson')}
      <p>Leave the aliases in <code>components.json</code> as directory paths. They tell the CLI where to write each file, and the CLI writes a relative import inside every file it installs, so the installed files never depend on the alias map.</p>
      ${codeFigure(`{
  "aliases": {
    "components": "components",
    "ui": "components/ui",
    "lib": "lib",
    "utils": "lib/utils/cn"
  }
}`, { title: 'components.json', lang: 'json', lineNumbers: true })}
      <p>The <code>ui</code> directory, <code>components/ui</code>, is reached as <code>#components/ui/...</code> through the same catch-all.</p>
      <p>The <code>utils</code> path, <code>lib/utils/cn</code>, is the file <code>lib/utils/cn.ts</code>, reached as <code>#lib/utils/cn.ts</code>.</p>
    </div>

    ${heading(toc, 2, 'What the CLI writes')}
    <p>When <code>add</code> copies a file, it rewrites each import to a path relative to where the file lands. The dialog, for example, lands in <code>components/ui/</code> and imports the helpers and the button beside it:</p>
    ${codeFigure(`import { cn, ensureId } from '../../lib/utils/cn.ts';
import { onBeforeCache } from '../../lib/utils/dom.ts';
import { buttonClass } from './button.ts';`, { title: 'components/ui/dialog.ts' })}
    <p>A block's page and its own components are rewritten the same way, wherever their targets put them. Your own code is free to use <code>#</code> imports for all of them.</p>

    ${heading(toc, 2, 'Monorepo')}
    <p>In a monorepo, each WebJs app has its own <code>package.json</code> with its own <code>imports</code> field and its own <code>components.json</code>, and its <code>#</code> specifiers resolve inside that app. See the <a href="/ui/docs/monorepo">monorepo docs</a>.</p>

    ${heading(toc, 2, 'File extensions')}
    <p>The catch-all maps <code>#x</code> to <code>./x</code> unchanged, so a specifier carries its extension, as every import in a WebJs app does:</p>
    ${codeFigure(`import { buttonClass } from '#components/ui/button.ts';`)}
    <p>Do not change the target to add an extension (<code>"./*.ts"</code>). The browser and Node both load the path you write, and a pattern that appends <code>.ts</code> would stop every other file type, such as a <code>.js</code> module or a stylesheet, from resolving through it.</p>

    ${heading(toc, 2, 'Troubleshooting')}
    <p>If a <code>#...</code> import does not resolve, check that:</p>
    <ul>
      <li>the specifier starts with <code>#</code>, with no slash after it</li>
      <li>the <code>imports</code> entry is in the app's own <code>package.json</code></li>
      <li>the specifier names a top-level directory, not a file at the app root (import a root file such as <code>./env.ts</code> relatively)</li>
      <li>the specifier keeps the file extension</li>
      <li>the matching file exists after components are added</li>
    </ul>
    <p>If a component landed in an unexpected directory, check the aliases in <code>components.json</code>: they are directory paths, so a value such as <code>#components</code> is read as a folder named <code>#components</code>.</p>
  `;
}
