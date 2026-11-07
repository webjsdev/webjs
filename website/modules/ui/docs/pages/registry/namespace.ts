import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * Namespaces, ported from shadcn's content/docs/registry/namespace.mdx
 * (#1666). shadcn's `@namespace/item` addresses, the `registries` map and
 * its URL templates have no counterpart in this CLI, which reads one
 * registry per command from `--registry` or `REGISTRY_URL`
 * (packages/ui/src/registry/fetcher.js). The page keeps shadcn's sections
 * where something true can be said and states the single-registry model in
 * each: configuration, dependency resolution, versioning, commands, errors.
 */
export const title = 'Namespaces';
export const description = 'Use more than one registry, one registry per command.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${callout(html`The WebJs UI CLI has no namespaces. There is no <code>@acme/button</code> address, no <code>registry add</code> command, and no URL template. Each command reads one registry: the one <code>--registry</code> names, else the one the <code>REGISTRY_URL</code> environment variable names, else the WebJs UI registry. This page covers how to work with several registries under that model.`, { title: 'Namespaces are not supported.' })}

    ${heading(toc, 2, 'Overview')}
    <p>In shadcn/ui, a namespace such as <code>@acme</code> maps a short prefix to a registry URL template, so <code>@acme/auth-utils</code> installs from Acme's registry and <code>button</code> from the default one, in one command.</p>
    <p>Here, a registry is addressed by its base URL, and the item by its name inside it. The CLI fetches <code>&lt;url&gt;/&lt;name&gt;.json</code>.</p>
    ${commandBlock(packageCommands('add auth-utils --registry https://acme.com/r'))}
    <p>Every item named in one command, and every registry dependency they pull in, comes from that one registry. To install from two registries, run two commands.</p>
    ${codeFigure(`npx @webjsdev/ui add button card
npx @webjsdev/ui add auth-utils --registry https://acme.com/r`, { lang: 'bash' })}

    ${heading(toc, 2, 'Multiple registries')}
    <p>Nothing stops a team from running several registries, split by resource type, by team or by stability. Each one is a base URL, and each install command names the one it reads from.</p>
    ${codeFigure(`https://registry.acme.com/ui        # components
https://registry.acme.com/blocks    # pages and views
https://registry.acme.com/beta      # experimental items`, { lang: 'txt' })}

    ${heading(toc, 2, 'Configuration')}
    ${heading(toc, 3, 'Per command')}
    <p>Pass the base URL with <code>--registry</code>. <code>init</code>, <code>add</code>, <code>list</code>, <code>view</code> and <code>diff</code> all take it.</p>
    ${commandBlock(packageCommands('view auth-utils --registry https://acme.com/r'))}
    ${heading(toc, 3, 'Per session')}
    <p>Set <code>REGISTRY_URL</code> to change the default for every command, for example in a shell or a CI job that installs only from your registry.</p>
    ${codeFigure(`export REGISTRY_URL=https://acme.com/r
npx @webjsdev/ui list
npx @webjsdev/ui add auth-utils`, { lang: 'bash' })}
    ${heading(toc, 3, 'components.json')}
    <p><code>components.json</code> accepts a <code>registries</code> field, so a file written for shadcn still parses, but the CLI does not read it. A registry configured there is ignored.</p>

    ${heading(toc, 2, 'Authentication & Security')}
    <p>The CLI sends no credentials and expands no environment variables into headers or URLs. See <a href="/ui/docs/registry/authentication">Authentication</a> for what a private registry can do instead.</p>
    ${heading(toc, 3, 'Inspecting Resources Before Installation')}
    <p>Run <code>view</code> to print an item and the source of every file it would write before you install it.</p>
    ${commandBlock(packageCommands('view auth-utils --registry https://acme.com/r'))}

    ${heading(toc, 2, 'Dependency Resolution')}
    <p>An item's <code>registryDependencies</code> are names, and each is fetched from the same base URL as the item that lists it. The CLI walks them depth first and installs the deepest dependency first, so an item lands after everything it imports. A name it has already visited is skipped, which also guards against cycles.</p>
    ${codeFigure(`{
  "name": "dashboard",
  "type": "registry:block",
  "registryDependencies": ["card", "chart"]
}`, { lang: 'json', title: 'dashboard.json', lineNumbers: true })}
    <p>Here <code>card</code> and <code>chart</code> are fetched from the registry <code>dashboard</code> came from, not from the WebJs UI registry. A registry that builds on kit components either ships its own copies as items or asks users to install the kit components first.</p>
    ${heading(toc, 3, 'Overriding Third-Party Resources')}
    <p>There is no override mechanism, because there is nothing to override at install time: every file the CLI writes becomes your source. To customize a third-party component, install it and edit the file. <code>diff</code> then shows how your copy differs from the registry's.</p>

    ${heading(toc, 2, 'Versioning')}
    <p>The base URL is any prefix the CLI appends <code>/&lt;name&gt;.json</code> to, so put the version in the path.</p>
    ${commandBlock(packageCommands('add auth-utils --registry https://acme.com/r/v2'))}
    <p>Keep a query string out of the base URL. The CLI appends the item path after it, so <code>https://acme.com/r?v=2</code> requests <code>https://acme.com/r?v=2/auth-utils.json</code>.</p>

    ${heading(toc, 2, 'CLI Commands')}
    ${codeFigure(`# Install from a specific registry
npx @webjsdev/ui add auth-utils --registry https://acme.com/r

# Install several items from one registry
npx @webjsdev/ui add auth-utils login-form --registry https://acme.com/r

# View an item
npx @webjsdev/ui view auth-utils --registry https://acme.com/r

# List a registry (search is the same command)
npx @webjsdev/ui list --registry https://acme.com/r
npx @webjsdev/ui search auth --registry https://acme.com/r

# Compare installed files against a registry
npx @webjsdev/ui diff --registry https://acme.com/r`, { lang: 'bash' })}

    ${heading(toc, 2, 'Error Handling')}
    ${heading(toc, 3, 'Resource Not Found')}
    ${codeFigure(`Failed to fetch registry item "auth-utils" from https://acme.com/r/auth-utils.json: HTTP 404`, { lang: 'txt' })}
    <p>Check the item name and the base URL. The URL in the message is the exact one the CLI requested.</p>
    ${heading(toc, 3, 'Index Not Found')}
    ${codeFigure(`Failed to fetch registry index from https://acme.com/r/index.json: HTTP 404`, { lang: 'txt' })}
    <p><code>list</code> and <code>diff</code> need <code>&lt;url&gt;/index.json</code>. <code>webjsui build</code> writes it.</p>
    ${heading(toc, 3, 'Authentication Failures')}
    <p>A registry that answers <code>401</code> or <code>403</code> fails the same way, with that status in the message. The CLI cannot send credentials, so the registry has to be reachable without them.</p>

    ${heading(toc, 2, 'Creating Your Own Registry')}
    <p>To make a registry, build it with <code>webjsui build</code> and serve the output folder. See <a href="/ui/docs/registry/getting-started">Getting Started</a>.</p>

    ${heading(toc, 2, 'Troubleshooting')}
    <ul>
      <li><strong>Items install from the wrong registry.</strong> Check for a <code>REGISTRY_URL</code> left set in the shell. It applies to every command without a <code>--registry</code> flag.</li>
      <li><strong>A dependency is not found.</strong> Registry dependencies resolve in the same registry as the item. Make sure each name exists there.</li>
      <li><strong>An item installs but does not list.</strong> <code>list</code> shows only <code>registry:ui</code> and <code>registry:block</code> items.</li>
    </ul>
  `;
}
