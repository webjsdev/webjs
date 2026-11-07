import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';

/**
 * The CLI docs page, ported from shadcn's content/docs/(root)/cli.mdx
 * (#1666): one section per command with its usage and its options, in the
 * order shadcn uses. Every option shown is read from
 * packages/ui/src/commands/*.js. shadcn's apply, preset, docs and migrate
 * commands have no WebJs counterpart and are left out.
 */
export const title = 'CLI';
export const description = 'Use the WebJs UI CLI to add components and blocks to your project.';

const usage = (text: string) => codeFigure(text, { lang: 'bash' });

export default async function body(toc: TocEntry[]) {
  return html`
    <p>The CLI ships in the <code>@webjsdev/ui</code> package as the <code>webjsui</code> binary. Run it with <code>npx @webjsdev/ui &lt;command&gt;</code> from any package manager, or as <code>webjs ui &lt;command&gt;</code> inside a WebJs app, since <code>@webjsdev/ui</code> is a dependency of the WebJs CLI and <code>webjs ui</code> passes its arguments straight through.</p>
    <p><code>init</code>, <code>add</code>, <code>list</code> and <code>view</code> read the registry that ships inside the installed package, so they need no network. Only <code>diff</code>, and a custom registry passed with <code>--registry</code>, go to the network.</p>

    ${heading(toc, 2, 'init')}
    <p>Use the <code>init</code> command to initialize configuration and dependencies for an existing WebJs app. An app created with <code>webjs create</code> is already initialized.</p>
    <p>The <code>init</code> command writes <code>components.json</code>, adds the <code>cn</code> util at <code>lib/utils/cn.ts</code> (with <code>lib/utils/dom.ts</code> beside it) and appends the theme's CSS variables to your stylesheet, <code>styles/globals.css</code> by default.</p>
    ${commandBlock(packageCommands('init'))}
    <p><strong>Options</strong></p>
    ${usage(`Usage: webjsui init [options]

Initialize @webjsdev/ui in a project: writes components.json, theme CSS,
lib/utils/cn.ts

Options:
  -c, --cwd <cwd>       the working directory (default: the current directory)
  -y, --yes             skip confirmation prompts (default: false)
  --base-color <color>  base color (neutral|stone|zinc|mauve|olive|mist|taupe)
  --css <path>          path to the project Tailwind CSS file
  -o, --overwrite       replace an existing alias map and existing helper files
                        (default: false)
  --registry <url>      registry base URL (default:
                        "https://webjs.dev/ui/registry")
  -h, --help            display help for command`)}
    <p>Running <code>init</code> again is safe. An existing <code>components.json</code> keeps its aliases, stylesheet path and base color, and an existing <code>cn.ts</code> or <code>dom.ts</code> is left as you edited it. Pass <code>--overwrite</code> to reset them. The command exits with an error when it cannot write the theme tokens, so a clean exit means the components are styled.</p>

    <hr>

    ${heading(toc, 2, 'add')}
    <p>Use the <code>add</code> command to add components, blocks and their dependencies to your project.</p>
    ${commandBlock(packageCommands('add [component]'))}
    <p>It resolves each item's registry dependencies transitively, copies the source into your <code>components/ui</code> alias, installs the npm dependencies with your project's package manager and puts back the theme tokens if they are missing. A block's files land at their own targets under the app. See <a href="/ui/docs/blocks">Blocks</a>.</p>
    <p><strong>Options</strong></p>
    ${usage(`Usage: webjsui add [options] [components...]

Add one or more components to your project

Arguments:
  components        component names (e.g. button card dialog)

Options:
  -c, --cwd <cwd>   the working directory (default: the current directory)
  -y, --yes         skip overwrite prompts (default: false)
  -o, --overwrite   overwrite existing files without asking (default: false)
  --no-deps         skip installing npm dependencies
  --registry <url>  registry base URL (default: "https://webjs.dev/ui/registry")
  -h, --help        display help for command`)}
    <p>For a class-helper component, <code>add</code> copies the helpers and leaves the worked example out of the file, with a one-line pointer to <code>npx @webjsdev/ui view &lt;name&gt;</code>, which prints it. The shared <code>cn.ts</code> and <code>dom.ts</code> helpers, and every file a block writes, are yours once they exist: <code>add</code> replaces one only with <code>--overwrite</code>, and <code>--yes</code> alone does not.</p>

    <hr>

    ${heading(toc, 2, 'view')}
    <p>Use the <code>view</code> command to view items from the registry before installing them.</p>
    ${commandBlock(packageCommands('view [item]'))}
    <p>For a component it prints the projected view (the helpers with their signatures, the accessibility notes and the paste-ready example) followed by the full source. For a block it prints the description, the categories, the dependencies, the install command and every file with the path it lands at, then the sources.</p>
    ${commandBlock(packageCommands('view login-03 --files-only'))}
    <p>Sources are printed baked with the style named in <code>components.json</code>, or <code>new-york</code> when it names none. Pass <code>--style</code> to see another one.</p>
    <p><strong>Options</strong></p>
    ${usage(`Usage: webjsui view [options] <name>

Print a registry item's source (and the paste-ready example) to stdout

Arguments:
  name              component, block or chart name

Options:
  --registry <url>  registry base URL (default: "https://webjs.dev/ui/registry")
  --source          print only the raw source, not the projected view
  --style <name>    the style to bake the source with (default: components.json,
                    else new-york)
  --json            a block or chart: print the projection as one JSON document
  --files-only      a block or chart: print the file list and stop before the
                    sources
  -h, --help        display help for command`)}

    <hr>

    ${heading(toc, 2, 'search')}
    <p>Use the <code>search</code> command to search for items in the registry.</p>
    ${commandBlock(packageCommands('search [filter]'))}
    <p>The filter matches a substring of the name:</p>
    ${commandBlock(packageCommands('search menu'))}
    <p>Or narrow the list to one kind of item, or to one category of blocks:</p>
    ${commandBlock(packageCommands('search --type block --category login'))}
    <p>The <code>list</code> command is an alias for <code>search</code>:</p>
    ${commandBlock(packageCommands('list --type block'))}
    <p>Without <code>--type</code> it prints the components, blocks and charts in three labelled groups. <code>--json</code> prints one compact array of <code>{ name, type, categories, description }</code> and nothing else, for a script or an agent.</p>
    <p><strong>Options</strong></p>
    ${usage(`Usage: webjsui list|search [options] [filter]

List the components, blocks and charts in the registry

Arguments:
  filter             filter by substring of the name

Options:
  --type <type>      ui, block, chart or all (ui | block | chart | all)
                     (default: "all")
  --category <name>  only blocks and charts in this category (e.g. login,
                     sidebar, area)
  --json             print one compact JSON array of { name, type, categories,
                     description }
  --registry <url>   registry base URL (default:
                     "https://webjs.dev/ui/registry")
  -h, --help         display help for command`)}

    <hr>

    ${heading(toc, 2, 'build')}
    <p>Use the <code>build</code> command to generate the registry JSON files.</p>
    ${commandBlock(packageCommands('build'))}
    <p>This command reads the <code>registry.json</code> file, inlines each file's content into its item and writes one <code>&lt;name&gt;.json</code> per item to the <code>r</code> directory, plus an <code>index.json</code> and a copy of the manifest. Serve that directory and pass its URL to <code>--registry</code>. See <a href="/ui/docs/registry">Registry</a>.</p>
    <p><strong>Options</strong></p>
    ${usage(`Usage: webjsui build [options] [file]

Build a custom registry: read registry.json, inline file contents, emit r/*.json

Arguments:
  file                registry manifest path (default: "registry.json")

Options:
  -o, --output <dir>  output directory (default: "./r")
  -c, --cwd <cwd>     the working directory (default: the current directory)
  -h, --help          display help for command`)}
    <p>To customize the output directory, use the <code>--output</code> option.</p>
    ${commandBlock(packageCommands('build --output ./public/r'))}

    <hr>

    ${heading(toc, 2, 'diff')}
    <p>Use the <code>diff</code> command to check your local copies against the registry.</p>
    ${commandBlock(packageCommands('diff [component]'))}
    <p>Components are copied into your app, so an upgrade of the kit does not change them. <code>diff</code> is how you find the drift. It compares each file against the live registry, transformed exactly as <code>add</code> would write it, so an untouched install reports nothing. Installed blocks are included. With no name it lists every item that is out of date.</p>
    <p><strong>Options</strong></p>
    ${usage(`Usage: webjsui diff [options] [name]

Show differences between local components or blocks and the registry

Arguments:
  name              component or block to diff (omit to show all out-of-date)

Options:
  -c, --cwd <cwd>   the working directory (default: the current directory)
  --registry <url>  registry base URL (default: "https://webjs.dev/ui/registry")
  -h, --help        display help for command`)}

    <hr>

    ${heading(toc, 2, 'info')}
    <p>Use the <code>info</code> command to get information about your project.</p>
    ${commandBlock(packageCommands('info'))}
    <p>It prints the working directory, the registry URL, the kit's component, block and chart counts, and whether a <code>components.json</code> was found. When one was, it adds the base color, the stylesheet path and the aliases it resolved.</p>
    <p><strong>Options</strong></p>
    ${usage(`Usage: webjsui info [options]

Print project diagnostics (config, registry)

Options:
  -c, --cwd <cwd>  the working directory (default: the current directory)
  -h, --help       display help for command`)}

    <hr>

    ${heading(toc, 2, 'lint')}
    <p>Use the <code>lint</code> command to check your app against its design system.</p>
    ${commandBlock(packageCommands('lint'))}
    <p>It reads the classes in your <code>html</code> templates, <code>cn()</code> calls and <code>class=\${...}</code> holes and reports, at the line, a raw palette color where your theme declares a token (<code>no-raw-colors</code>), an arbitrary value such as <code>p-[13px]</code> (<code>no-arbitrary-values</code>), and a class composed over a kit helper (<code>no-restyle</code>). Each message names the alternative from your own theme tokens and helper variants.</p>
    <p>The linter is opt-in. It reports nothing and exits 0 until <code>components.json</code> carries a <code>lint</code> block:</p>
    ${codeFigure(`{
  "lint": {
    "ignore": ["app/legacy/**"],
    "rules": {
      "no-raw-colors": "warn",
      "no-arbitrary-values": { "severity": "warn", "allow": ["layout"] },
      "no-restyle": { "severity": "error", "allow": ["layout", "rounded"] }
    }
  }
}`, { title: 'components.json', lang: 'json', lineNumbers: true })}
    <p>It exits 1 on an error, on more warnings than <code>--max-warnings</code> allows, or on a config it cannot run against.</p>
    <p><strong>Options</strong></p>
    ${usage(`Usage: webjsui lint [options]

Check the app against its design system (opt-in, configured in components.json)

Options:
  -c, --cwd <cwd>     the working directory (default: the current directory)
  --json              emit structured violations for an agent loop
  --max-warnings <n>  fail when warnings exceed this count (default: "-1")
  -h, --help          display help for command`)}
  `;
}
