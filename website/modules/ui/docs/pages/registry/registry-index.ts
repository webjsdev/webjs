import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';

/**
 * Registry Directory, ported from shadcn's
 * content/docs/registry/registry-index.mdx (#1666). The list lives in
 * website/modules/ui/directory/registries.ts and is served at
 * /ui/r/registries.json. Unlike shadcn's, the CLI never reads it: an entry
 * gives the reader the `--registry` command, and that is all. The content
 * rule is inverted too, since this CLI installs a file only from the
 * `content` inlined in the item JSON.
 */
export const title = 'Registry Directory';
export const description = 'Open Source Registry Index';

export default async function body(toc: TocEntry[]) {
  return html`
    <p>The open source registry index is a list of the open source registries you can install from with the WebJs UI CLI.</p>
    <p>The <a href="/ui/docs/directory">Directory</a> page lists them, and each entry shows the command that installs from that registry. The CLI installs from the registry its <code>--registry</code> flag names, and from the WebJs UI registry when there is no flag.</p>
    <p>You can see the full list at <a href="/ui/r/registries.json">/ui/r/registries.json</a>.</p>
    <p>You do not need to submit a registry to the directory to use it. Any registry URL works with <code>--registry</code>. The directory is for registries you want other people to find.</p>

    ${heading(toc, 2, 'Adding a Registry')}
    <ol>
      <li>Add your registry to <a href="https://github.com/webjsdev/webjs/blob/main/website/modules/ui/directory/registries.ts"><code>website/modules/ui/directory/registries.ts</code></a>: its <code>name</code>, <code>homepage</code>, base <code>url</code>, a one-line <code>description</code>, and a square SVG <code>logo</code> drawn with <code>var(--foreground)</code>.</li>
      <li>Check that the CLI can list and install from the <code>url</code> you entered.</li>
      <li>Create a pull request to <a href="https://github.com/webjsdev/webjs">https://github.com/webjsdev/webjs</a>.</li>
    </ol>
    ${codeFigure(`{
  name: '@acme',
  homepage: 'https://acme.com',
  url: 'https://acme.com/r',
  description: 'Acme components for WebJs apps.',
  logo: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='var(--foreground)'>...</svg>",
},`, { title: 'website/modules/ui/directory/registries.ts', lineNumbers: true })}
    ${commandBlock(packageCommands('list --registry https://acme.com/r'))}
    <p>Once you have submitted your request, it will be reviewed. Once the pull request is merged, your registry appears in the directory with the next deploy of webjs.dev. An entry stays listed until someone changes the file.</p>

    ${heading(toc, 2, 'Requirements')}
    <ol>
      <li>The registry must be open source and publicly accessible, with no authentication.</li>
      <li>Every item must be valid JSON that conforms to the <a href="/ui/docs/registry/registry-item-json">registry-item schema specification</a>.</li>
      <li>The registry is expected to be a flat registry with no nested items, i.e. <code>&lt;url&gt;/index.json</code> and <code>&lt;url&gt;/component-name.json</code> files are expected at the root of the registry's base URL.</li>
      <li>Each file in an item's <code>files</code> array MUST include its <code>content</code>. The CLI writes a file from that string and never fetches a file by its <code>path</code>. <code>webjsui build</code> inlines it for you.</li>
    </ol>
    <p>Here's an example of a valid registry item, as <code>build</code> writes it to <code>&lt;url&gt;/login-form.json</code>:</p>
    ${codeFigure(`{
  "name": "login-form",
  "type": "registry:ui",
  "title": "Login Form",
  "description": "A login form component.",
  "registryDependencies": ["brand-button"],
  "files": [
    {
      "path": "components/login-form.ts",
      "type": "registry:ui",
      "content": "import { html } from '@webjsdev/core';\\n..."
    }
  ]
}`, { lang: 'json', title: 'login-form.json', lineNumbers: true })}
  `;
}
