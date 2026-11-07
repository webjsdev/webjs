import { html } from '@webjsdev/core';
import type { TocEntry } from '#lib/ui/docs/page.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * The Registry introduction, ported from shadcn's
 * content/docs/registry/index.mdx (#1666). The cards link only to the
 * registry pages that describe something this kit's CLI does; shadcn's
 * GitHub, Namespaces and Authentication cards point at features it lacks,
 * so the Directory takes their place.
 */
export const title = 'Introduction';
export const description = 'Run your own code registry.';

const card = (href: string, name: string, text: string) => html`
  <a href=${href} data-not-typeset class="flex w-full flex-col items-start rounded-2xl bg-surface p-6 text-sm text-surface-foreground no-underline transition-colors hover:bg-surface/80 md:p-6">
    <div class="font-medium">${name}</div>
    <div class="text-muted-foreground">${text}</div>
  </a>`;

export default async function body(_toc: TocEntry[]) {
  return html`
    <p>You can use the WebJs UI CLI to install from your own code registry. Running your own registry allows you to distribute your custom components, blocks, helpers, pages and other files to any WebJs app, with the same <code>add</code>, <code>list</code>, <code>view</code> and <code>diff</code> commands that install the kit's own components.</p>
    ${callout(html`<strong>Note:</strong> A registry is plain JSON served over HTTP, in the same item format shadcn/ui uses. The CLI writes whatever files an item carries, so a registry is not limited to UI components, but it installs into a project that has a <code>components.json</code>, which <code>webjs ui init</code> writes.`)}

    <p>Ready to create your own registry? In the next section, we'll walk you through setting up your own custom registry step-by-step, from creating your first component to publishing it for others to use.</p>

    <div class="mt-6 grid gap-4 sm:grid-cols-2">
      ${card('/ui/docs/registry/getting-started', 'Getting Started', 'Set up and build your own registry')}
      ${card('/ui/docs/registry/examples', 'Examples', 'Browse example registry items')}
      ${card('/ui/docs/registry/registry-json', 'Schema', 'Schema specification for registry.json')}
      ${card('/ui/docs/registry/registry-item-json', 'Item Schema', 'Specification for registry items')}
      ${card('/ui/docs/directory', 'Directory', 'Registries you can install from')}
      ${card('/ui/docs/registry/faq', 'FAQ', 'Frequently asked questions about running a registry')}
    </div>
  `;
}
