import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';

/**
 * components.json, ported from shadcn's content/docs/(root)/components-json.mdx
 * (#1666). Every key is checked against the kit's config schema
 * (packages/ui/src/registry/schema.js, `rawConfigSchema`) and against what
 * `init` writes (packages/ui/src/commands/init.js). shadcn's `rsc`, `tsx` and
 * `aliases.hooks` have no counterpart, and the schema is strict, so the page
 * says so rather than documenting them.
 */
export const title = 'components.json';
export const description = 'Configuration for your project.';

export default async function body(toc: TocEntry[]) {
  return html`
    <p>The <code>components.json</code> file holds configuration for your project.</p>
    <p>The CLI uses it to understand how your project is set up and how to write components customized for your project.</p>
    ${callout(html`It is <strong>only required if you're using the CLI</strong> to add components to your project. If you're using the copy and paste method, you don't need this file.`, { title: 'Note: The components.json file is optional', className: 'mt-6' })}
    <p>You can create a <code>components.json</code> file in your project by running the following command:</p>
    ${commandBlock(packageCommands('init'))}
    <p>Inside a WebJs app the same command is <code>webjs ui init</code>, and an app made with <code>webjs create</code> already has the file. See the <a href="/ui/docs/cli">CLI section</a> for more information.</p>

    ${heading(toc, 2, '$schema')}
    <p><code>init</code> writes the following <code>$schema</code> value. The CLI does not fetch it: it validates the file against its own schema, which is strict, so a key it does not know is an error rather than a silent no-op.</p>
    ${codeFigure(`{
  "$schema": "https://ui.webjs.dev/schema.json"
}`, { title: 'components.json', lang: 'json' })}

    ${heading(toc, 2, 'style')}
    <p>The style for your components. The kit authors every component once, with semantic <code>cn-*</code> class names, and <code>add</code> bakes the chosen style into the file it writes, so the copy in your project holds plain Tailwind classes.</p>
    ${codeFigure(`{
  "style": "new-york"
}`, { title: 'components.json', lang: 'json' })}
    <p>The styles are <code>new-york</code>, <code>vega</code>, <code>nova</code>, <code>maia</code>, <code>lyra</code>, <code>mira</code>, <code>luma</code>, <code>sera</code> and <code>rhea</code>. <code>init</code> writes <code>"default"</code>, which means <code>new-york</code>, and so does a name the kit does not ship. <code>init --style &lt;name&gt;</code>, or a preset from <a href="/ui/create">Create</a> (<code>init --preset &lt;code&gt;</code>), writes another.</p>
    <p>The style is read each time you run <code>add</code>, so changing it later affects only the components you add afterwards. The ones already in your project keep the classes they were baked with until you add them again with <code>--overwrite</code>, and <code>diff</code> reports them as out of date in the meantime.</p>

    ${heading(toc, 2, 'tailwind')}
    <p>Configuration to help the CLI understand how Tailwind CSS is set up in your project.</p>
    <p>See the <a href="/ui/docs/installation">installation section</a> for how to set up Tailwind CSS.</p>

    ${heading(toc, 3, 'tailwind.config', 'tailwindconfig')}
    <p>The kit targets Tailwind CSS v4, which has no <code>tailwind.config.js</code>. The key is accepted so an older config still parses, and the CLI never reads it. <strong>Leave it out.</strong></p>

    ${heading(toc, 3, 'tailwind.css', 'tailwindcss')}
    <p>Path to the CSS file that imports Tailwind CSS into your project. <code>init</code> appends the theme tokens to it, and <code>add</code> writes the tokens back if they go missing and merges in the CSS variables a component or block carries.</p>
    ${codeFigure(`{
  "tailwind": {
    "css": "styles/globals.css"
  }
}`, { title: 'components.json', lang: 'json' })}
    <p>The default is <code>styles/globals.css</code>, not <code>app/globals.css</code>, because in a WebJs app the <code>app/</code> directory holds routes only. <code>init --css &lt;path&gt;</code> points it somewhere else.</p>

    ${heading(toc, 3, 'tailwind.baseColor', 'tailwindbasecolor')}
    <p>This is used to generate the default theme tokens for your components.</p>
    ${codeFigure(`{
  "tailwind": {
    "baseColor": "neutral" | "stone" | "zinc" | "mauve" | "olive" | "mist" | "taupe"
  }
}`, { title: 'components.json', lang: 'json' })}
    <p>The tokens are written once. <code>init</code> marks where the theme block it appends starts and ends, and a later plain run, or an <code>add</code>, leaves the block as it is. Changing <code>baseColor</code> in this file therefore does not repaint an existing project. To repaint it, run <code>init --base-color &lt;name&gt; --overwrite</code> or <code>init --preset &lt;code&gt;</code>, which replace the marked block in place (<code>--overwrite</code> also resets the aliases and the helper files), or edit the variables by hand. A block written before the end marker existed is never replaced, only reported. See the <a href="/ui/docs/theming">theming docs</a>.</p>

    ${heading(toc, 3, 'tailwind.cssVariables', 'tailwindcssvariables')}
    <p>The kit uses CSS variables for theming, and only CSS variables. Every component is written against semantic tokens like <code>background</code>, <code>foreground</code> and <code>primary</code>.</p>
    ${codeFigure(`{
  "tailwind": {
    "cssVariables": true
  }
}`, { title: 'components.json', lang: 'json' })}
    <p><code>init</code> writes <code>true</code>. There is no inline-utility variant of the components, so <code>false</code> changes nothing. For more information, see the <a href="/ui/docs/theming">theming docs</a>.</p>

    ${heading(toc, 3, 'tailwind.prefix', 'tailwindprefix')}
    <p>The key is accepted for compatibility, but the CLI does not apply a prefix to the classes it writes. A component lands with Tailwind's unprefixed utilities.</p>

    ${heading(toc, 2, 'rsc')}
    <p>WebJs has no server and client component split, so there is no <code>"use client"</code> directive to add and no <code>rsc</code> key. A page renders on the server, and a component that needs JavaScript ships it on its own.</p>

    ${heading(toc, 2, 'tsx')}
    <p>The kit ships TypeScript sources only, and there is no <code>tsx</code> key. WebJs strips the types when it serves a file, with no build step, so a JavaScript app imports the <code>.ts</code> files as they are. See <a href="/ui/docs/javascript">JavaScript</a>.</p>

    ${heading(toc, 2, 'aliases')}
    <p>The CLI uses these values to place the files it writes. Each one is a <strong>directory path</strong> relative to the project root, not an import specifier. A leading <code>@/</code> is accepted and dropped.</p>
    <p>Inside the files it writes, the CLI rewrites every registry import to a relative path that resolves from where the file landed, so <code>components/ui/dialog.ts</code> imports <code>../../lib/utils/cn.ts</code> and <code>./button.ts</code>. Relative imports need no alias configuration at all, which is why the aliases here are plain paths.</p>
    ${callout(html`Your own code imports the installed files through the app's <code>#</code> package import, for example <code>#components/ui/button.ts</code>. That comes from <code>package.json</code>, not from <code>components.json</code>. Do not write <code>#components</code> as an alias value here: it is read as a directory named <code>#components</code>. See <a href="/ui/docs/package-imports">Package Imports</a>.`, { title: 'Important', className: 'mt-6' })}
    ${codeFigure(`{
  "aliases": {
    "components": "components",
    "utils": "lib/utils/cn",
    "ui": "components/ui",
    "lib": "lib"
  }
}`, { title: 'components.json', lang: 'json' })}
    <p>These are the values <code>init</code> and <code>webjs create</code> both write, so a scaffolded app and an app that ran <code>init</code> share one layout.</p>
    <p>For monorepos, see the <a href="/ui/docs/monorepo">monorepo docs</a>.</p>

    ${heading(toc, 3, 'aliases.utils', 'aliasesutils')}
    <p>The path of your <code>cn()</code> helper, without the extension. <code>lib/utils/cn</code> is the file <code>lib/utils/cn.ts</code>. The client-only <code>onBeforeCache()</code> helper is written beside it, as <code>lib/utils/dom.ts</code>.</p>
    ${codeFigure(`{
  "aliases": {
    "utils": "lib/utils/cn"
  }
}`, { title: 'components.json', lang: 'json' })}
    <p>Both helpers are yours once they exist: <code>init</code> and <code>add</code> leave an existing copy alone, and only <code>--overwrite</code> replaces it.</p>

    ${heading(toc, 3, 'aliases.components', 'aliasescomponents')}
    <p>The directory for your components.</p>
    ${codeFigure(`{
  "aliases": {
    "components": "components"
  }
}`, { title: 'components.json', lang: 'json' })}

    ${heading(toc, 3, 'aliases.ui', 'aliasesui')}
    <p>The directory for <code>ui</code> components.</p>
    <p>The CLI uses the <code>aliases.ui</code> value to determine where to place your <code>ui</code> components. Use this config if you want to customize the installation directory for your <code>ui</code> components.</p>
    ${codeFigure(`{
  "aliases": {
    "ui": "modules/design/ui"
  }
}`, { title: 'components.json', lang: 'json' })}

    ${heading(toc, 3, 'aliases.lib', 'aliaseslib')}
    <p>The directory for <code>lib</code> files that a registry item installs.</p>
    ${codeFigure(`{
  "aliases": {
    "lib": "lib"
  }
}`, { title: 'components.json', lang: 'json' })}

    ${heading(toc, 3, 'aliases.hooks', 'aliaseshooks')}
    <p>There is no <code>hooks</code> alias. WebJs components keep state in signals and reactive properties rather than hooks, and no registry item installs a hook.</p>

    ${heading(toc, 2, 'iconLibrary')}
    <p>The icon library the components and blocks draw with: <code>lucide</code> (the default), <code>tabler</code>, <code>hugeicons</code>, <code>phosphor</code> or <code>remixicon</code>. The icons are inline SVG, so no icon package is installed. An item that draws icons depends on the kit's icon module, and <code>add</code> installs the one for this library at <code>lib/utils/icons.ts</code>, beside <code>cn.ts</code>. <code>init --icons &lt;library&gt;</code>, or a preset, sets the key and writes that file.</p>
    ${codeFigure(`{
  "iconLibrary": "lucide"
}`, { title: 'components.json', lang: 'json' })}

    ${heading(toc, 2, 'lint')}
    <p>The opt-in design-system linter, <code>webjs ui lint</code>, reads its configuration from here. With no <code>lint</code> block it reports nothing and exits 0.</p>
    ${codeFigure(`{
  "lint": {
    "ignore": ["app/legacy/**"],
    "rules": {
      "no-raw-colors": "warn",
      "no-arbitrary-values": { "severity": "warn", "allow": ["layout"] },
      "no-restyle": { "severity": "error", "allow": ["layout", "rounded"] }
    }
  }
}`, { title: 'components.json', lang: 'json' })}
    <p>A rule is a bare severity (<code>"off"</code>, <code>"warn"</code> or <code>"error"</code>) or an object adding <code>allow</code>, which takes a category name or a class group. A rule left out is off. See the <a href="/ui/docs/cli">CLI</a> for the command.</p>

    ${heading(toc, 2, 'registries')}
    <p>The key is accepted, but the CLI does not read namespaced registries from it, so <code>add @acme/button</code> is not supported. To install from a registry other than the kit's own, pass its base URL with <code>--registry</code>:</p>
    ${commandBlock(packageCommands('add button --registry https://registry.example.com'))}
    <p>See the <a href="/ui/docs/registry">Registry</a> documentation for building and hosting one.</p>
  `;
}
