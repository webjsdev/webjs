import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * GitHub Registries, ported from shadcn's content/docs/registry/github.mdx
 * (#1666). shadcn's CLI reads a repository's source `registry.json` through
 * an `owner/repo/item` address. This CLI has no such address: it fetches
 * `<url>/<name>.json` from a base URL (packages/ui/src/registry/fetcher.js),
 * so a GitHub repository serves as a registry by committing the `build`
 * output and passing its raw URL as `--registry`. The page keeps shadcn's
 * steps and says that, and what it means for refs, private repositories and
 * review.
 */
export const title = 'GitHub Registries';
export const description = 'Use a GitHub repository as a registry.';

const RAW = 'https://raw.githubusercontent.com/acme/toolkit/main/r';

export default async function body(toc: TocEntry[]) {
  return html`
    <p>You can turn <strong>a public GitHub repository into a registry.</strong></p>
    <p>Add a <code>registry.json</code> file to the repository, build it, commit the output, and users can install from the repository's raw file URL with the WebJs UI CLI.</p>
    ${commandBlock(packageCommands(`add <item> --registry ${RAW}`))}
    ${callout(html`<p><strong>Note:</strong> The CLI fetches built item files from a base URL, so the repository has to contain the <code>build</code> output, and the address is the URL of the folder that holds it.</p>`)}

    ${heading(toc, 2, 'Distribute Anything')}
    <p>Registry items are <strong>not limited to components.</strong> They can include any text file from your repository: source files, configuration, docs, templates, agent rules or project conventions. Each file names where it lands in the user's project with a <code>target</code>.</p>
    ${codeFigure(`{
  "name": "acme",
  "homepage": "https://github.com/acme/toolkit",
  "items": [
    {
      "name": "project-conventions",
      "type": "registry:item",
      "title": "Project Conventions",
      "description": "Agent rules and editor settings for Acme apps.",
      "files": [
        {
          "path": "rules/conventions.md",
          "type": "registry:file",
          "target": ".agents/rules/conventions.md"
        },
        {
          "path": "config/settings.json",
          "type": "registry:file",
          "target": ".vscode/settings.json"
        }
      ]
    }
  ]
}`, { lang: 'json', title: 'registry.json', lineNumbers: true })}

    ${heading(toc, 2, 'When to use GitHub')}
    <p>Use a GitHub repository as a registry when:</p>
    <ul>
      <li>You already have reusable code in a public GitHub repository.</li>
      <li>You want to distribute components, helpers, config files, rules, docs or templates from the same repository.</li>
      <li>You do not want to run a registry server.</li>
    </ul>

    ${heading(toc, 2, 'Requirements')}
    <p>A GitHub registry must:</p>
    <ul>
      <li>Be a public repository, since the CLI sends no credentials.</li>
      <li>Have a <code>registry.json</code> that conforms to the <a href="/ui/docs/registry/registry-json">registry.json</a> and <a href="/ui/docs/registry/registry-item-json">registry-item.json</a> schemas.</li>
      <li>Commit the files <code>webjsui build</code> writes, one <code>&lt;name&gt;.json</code> per item plus <code>index.json</code>.</li>
    </ul>

    ${heading(toc, 2, 'Step 1: Add registry.json')}
    <p>Given an existing repository:</p>
    ${codeFigure(`acme/toolkit
├── components
│   └── brand-button.ts
├── lib
│   └── utils.ts
└── rules
    └── conventions.md`, { lang: 'txt' })}
    <p>Add a <code>registry.json</code> at the root that lists the items to share. Paths are relative to <code>registry.json</code>.</p>
    ${codeFigure(`{
  "name": "acme",
  "homepage": "https://github.com/acme/toolkit",
  "items": [
    {
      "name": "brand-button",
      "type": "registry:ui",
      "description": "A button in the Acme brand colors.",
      "files": [
        { "path": "components/brand-button.ts", "type": "registry:ui" }
      ]
    },
    {
      "name": "project-conventions",
      "type": "registry:item",
      "description": "Agent rules for Acme apps.",
      "files": [
        {
          "path": "rules/conventions.md",
          "type": "registry:file",
          "target": ".agents/rules/conventions.md"
        }
      ]
    }
  ]
}`, { lang: 'json', title: 'registry.json', lineNumbers: true })}

    ${heading(toc, 2, 'Step 2: Build and commit')}
    <p>Run <code>build</code> from the repository root. It inlines each file's content into <code>r/&lt;name&gt;.json</code> and writes <code>r/index.json</code>.</p>
    ${commandBlock(packageCommands('build'))}
    <p>Commit the <code>r</code> folder. Rebuild and commit again whenever a source file changes, since users install the built JSON, not the source files.</p>
    ${codeFigure(`acme/toolkit
├── r
│   ├── brand-button.json
│   ├── project-conventions.json
│   ├── index.json
│   └── registry.json
└── registry.json`, { lang: 'txt' })}

    ${heading(toc, 2, 'Step 3: Validate the registry')}
    <p><code>build</code> validates as it writes: it parses <code>registry.json</code> against the registry schema and every item against the item schema, and stops with the error on the first one that does not conform. A file listed under <code>path</code> that does not exist fails the build too.</p>

    ${heading(toc, 2, 'Step 4: List and search items')}
    <p>The base URL is the raw URL of the committed <code>r</code> folder: <code>https://raw.githubusercontent.com/&lt;owner&gt;/&lt;repo&gt;/&lt;ref&gt;/r</code>.</p>
    ${commandBlock(packageCommands(`list --registry ${RAW}`))}
    ${commandBlock(packageCommands(`search button --registry ${RAW}`))}
    <p><code>list</code> shows the items typed <code>registry:ui</code> and <code>registry:block</code>. An item of another type, such as <code>project-conventions</code> above, installs with <code>add</code> and prints with <code>view</code>, but is not listed.</p>

    ${heading(toc, 2, 'Organize the repository')}
    <p>Keep one <code>registry.json</code> in the repository, and organize the source files in folders as you like, since each item's <code>path</code> points at its files wherever they are.</p>

    ${heading(toc, 2, 'Registry dependencies')}
    <p>A <code>registryDependencies</code> entry is the name of another item, and it is fetched from the same base URL as the item that lists it. So an item in your repository can depend on another item in your repository by name.</p>
    ${codeFigure(`{
  "name": "hello-world",
  "type": "registry:block",
  "registryDependencies": ["brand-button"],
  "files": [
    {
      "path": "blocks/hello-world/page.ts",
      "type": "registry:page",
      "target": "app/hello/page.ts"
    }
  ]
}`, { lang: 'json', title: 'registry.json', lineNumbers: true })}
    <p>Every dependency comes from the item's own registry. A name like <code>button</code> resolves to <code>button.json</code> in your repository, not to the WebJs UI <code>button</code>. To build on a kit component, tell users to install it first with <code>webjs ui add button</code>, or ship your own copy as an item.</p>

    ${heading(toc, 2, 'Useful commands')}
    <p>View an item before installing it. <code>view</code> prints what the item is and then the source of every file it would write.</p>
    ${commandBlock(packageCommands(`view project-conventions --registry ${RAW}`))}
    <p>Install an item into a project that has a <code>components.json</code>.</p>
    ${commandBlock(packageCommands(`add project-conventions --registry ${RAW}`))}
    <p>Compare installed files against the registry.</p>
    ${commandBlock(packageCommands(`diff --registry ${RAW}`))}
    <p>Set the base URL once for a session.</p>
    ${codeFigure(`export REGISTRY_URL=${RAW}
npx @webjsdev/ui add brand-button`, { lang: 'bash' })}

    ${heading(toc, 2, 'Refs')}
    <p>The ref is part of the raw URL. Use a branch to track the latest commit, or a tag or a full commit SHA to pin the files users install.</p>
    ${commandBlock(packageCommands('add brand-button --registry https://raw.githubusercontent.com/acme/toolkit/v1.2.0/r'))}
    <p>For published install commands, prefer tags or full commit SHAs. A registry dependency is fetched from the same URL, so it is pinned to the same ref.</p>

    ${heading(toc, 2, 'Private repositories')}
    <p>To keep a registry private, serve its build output from a host you control: <code>raw.githubusercontent.com</code> answers a private file only with a token, and the CLI fetches with a plain request. See <a href="/ui/docs/registry/authentication">Authentication</a> for the patterns, a private network or a secret path segment.</p>

    ${heading(toc, 2, 'Review before installing')}
    <p>Registry items install code and project files from another repository. Treat a registry URL like any other third-party code dependency.</p>
    <p>Before installing from a source you do not control:</p>
    <ul>
      <li>Review the repository, its <code>registry.json</code> and the built item files.</li>
      <li>Review the item definition, especially <code>files</code>, <code>target</code>, <code>dependencies</code>, <code>devDependencies</code> and <code>registryDependencies</code>.</li>
      <li>Prefer a tag or full commit SHA in the URL. A full 40-character commit SHA is the most reproducible option.</li>
      <li>Run <code>view</code> to print the item and every file's source before installing. Pipe its output to your agent or review tool if you want help checking the item.</li>
      <li><code>add</code> asks before replacing an existing file, unless you pass <code>--yes</code> or <code>--overwrite</code>, and keeps an existing block file unless you pass <code>--overwrite</code>. Review with <code>view</code> first, and run <code>diff</code> afterwards to compare what is installed.</li>
    </ul>
  `;
}
