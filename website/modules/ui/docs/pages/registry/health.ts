import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * Registry Health, ported from shadcn's content/docs/registry/health.mdx
 * (#1666). shadcn monitors and scores the registries in its directory.
 * webjs.dev runs no such service, so this page says so and keeps the part
 * that is true here: the checks a registry owner runs with the CLI, each of
 * which validates what it fetches against the item schema.
 */
export const title = 'Registry Health';
export const description = 'How to check that a registry works with the CLI.';

const BASE = 'https://acme.com/r';

export default async function body(toc: TocEntry[]) {
  return html`
    <p>Registries can change or go offline after they are added to the directory. Checking them keeps users from running an install command that fails.</p>
    ${callout(html`<p>A registry owner checks a registry in the <a href="/ui/docs/directory">directory</a> with the CLI, which validates everything it fetches. The checks below cover the index, the items, an install and drift.</p>`, { title: 'Check a registry with the CLI.' })}

    ${heading(toc, 2, 'What to check')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Check</th><th>Command</th><th>What it proves</th></tr></thead>
        <tbody>
          <tr><td>Registry index</td><td><code>list --registry &lt;url&gt;</code></td><td><code>&lt;url&gt;/index.json</code> is online and every entry parses as a registry item.</td></tr>
          <tr><td>Registry items</td><td><code>view &lt;name&gt; --registry &lt;url&gt;</code></td><td><code>&lt;url&gt;/&lt;name&gt;.json</code> downloads and parses as a registry item, and prints the source of every file.</td></tr>
          <tr><td>CLI install</td><td><code>add &lt;name&gt; --registry &lt;url&gt;</code></td><td>The item, its registry dependencies and its npm dependencies install into a project.</td></tr>
          <tr><td>Drift</td><td><code>diff --registry &lt;url&gt;</code></td><td>The files a project installed still match what the registry serves.</td></tr>
        </tbody>
      </table>
    </div>
    <p>Each command fails with the HTTP status when a file is missing, and with the schema error when a file does not conform, so a non-zero exit is the signal.</p>
    ${commandBlock(packageCommands(`list --registry ${BASE}`))}
    ${commandBlock(packageCommands(`view brand-button --registry ${BASE}`))}

    ${heading(toc, 2, 'Checking in CI')}
    <p>To catch a broken registry before users do, run the same commands on a schedule. <code>list --json</code> prints one JSON array of <code>{ name, type, categories, description }</code>, which a script can loop over to view every item.</p>
    ${codeFigure(`npx @webjsdev/ui list --registry ${BASE} --json > items.json

for name in $(node -e "for (const i of require('./items.json')) console.log(i.name)"); do
  npx @webjsdev/ui view "$name" --registry ${BASE} > /dev/null || exit 1
done`, { lang: 'bash', title: 'check-registry.sh', lineNumbers: true })}
    <p>To test the install itself, run <code>add</code> in a throwaway app created with <code>webjs create</code>, then run its tests.</p>

    ${heading(toc, 2, 'Directory ranking')}
    <p>The directory lists registries in the order of <code>website/modules/ui/directory/registries.ts</code>, with the WebJs UI registry first. Its search filters by name and description, and entries change only when the file does.</p>

    ${heading(toc, 2, 'Directory data in the API')}
    <p><a href="/ui/r/registries.json" data-no-router>/ui/r/registries.json</a> serves each entry's <code>name</code>, <code>homepage</code>, <code>url</code>, <code>description</code> and <code>logo</code>.</p>

    ${heading(toc, 2, 'What happens next')}
    <p>If a listed registry stops working, open an issue or a pull request on <a href="https://github.com/webjsdev/webjs">webjsdev/webjs</a> to fix or remove its entry. See <a href="/ui/docs/registry/registry-index">Registry Directory</a> for how entries are added.</p>
  `;
}
