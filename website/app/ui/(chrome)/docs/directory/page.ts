import { html, unsafeHTML, nothing } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { alertClass, alertDescriptionClass } from '#modules/ui/components/alert.ts';
import {
  itemGroupClass, itemSeparatorClass, itemClass, itemMediaClass, itemContentClass,
  itemTitleClass, itemDescriptionClass, itemActionsClass,
} from '#modules/ui/components/item.ts';
import { inputGroupClass, inputGroupAddonClass, inputGroupInputClass } from '#modules/ui/components/input-group.ts';
import { dialogHeaderClass, dialogTitleClass, dialogDescriptionClass, dialogFooterClass } from '#modules/ui/components/dialog.ts';
import { docsPage, heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';
import { searchRegistries, addArgs, type Registry } from '#modules/ui/directory/registries.ts';

export const metadata = {
  title: 'Registry Directory | WebJs UI',
};

/**
 * /ui/docs/directory, shadcn's Registry Directory
 * (content/docs/(root)/directory.mdx and components/directory-list.tsx).
 *
 * The list is modules/ui/directory/registries.ts, the same data
 * /ui/r/registries.json serves. The search is a GET form, so it filters on
 * the server and works with JavaScript off; shadcn's filters as you type.
 * The list renders in the nova style, as shadcn's (base-nova) does, while
 * the docs chrome around it stays new-york. Each "Add" opens a dialog with
 * the command, in the four package managers,
 * that installs from that registry with this kit's CLI. shadcn's
 * `registry add` has no equivalent here, since the CLI takes a registry per
 * command through `--registry`.
 */

const PER_PAGE = 10;

// shadcn's Documentation section under the list: the registry docs as
// LinkedCards.
const DOC_CARDS = [
  { href: '/ui/docs/registry/getting-started', name: 'Getting Started', text: 'Set up and build your own registry' },
  { href: '/ui/docs/registry/authentication', name: 'Authentication', text: 'Secure your registry with authentication' },
  { href: '/ui/docs/registry/namespace', name: 'Namespaces', text: 'Configure registries with namespaces' },
  { href: '/ui/docs/registry/registry-index', name: 'Add a Registry', text: 'Learn how to add a registry to the directory' },
  { href: '/ui/docs/registry/examples', name: 'Examples', text: 'Registry item examples and configurations' },
  { href: '/ui/docs/registry/registry-json', name: 'Schema', text: 'Schema specification for registry.json' },
];

const searchIcon = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>`;
const plusIcon = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5l0 14"></path><path d="M5 12l14 0"></path></svg>`;
const arrowUpRight = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-4 opacity-0 group-hover:opacity-100"><path d="M17 7l-10 10"></path><path d="M8 7l9 0l0 9"></path></svg>`;

function pageHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));
  const s = params.toString();
  return s ? `/ui/docs/directory?${s}` : '/ui/docs/directory';
}

function addDialog(r: Registry) {
  return html`<ui-dialog>
    <ui-dialog-trigger>
      <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'relative z-10')}>Add ${plusIcon}</button>
    </ui-dialog-trigger>
    <ui-dialog-content class="animate-none! sm:max-w-md">
      <div data-slot="dialog-header" class=${dialogHeaderClass()}>
        <h2 data-slot="dialog-title" class=${dialogTitleClass()}>Add Registry</h2>
        <p data-slot="dialog-description" class=${dialogDescriptionClass()}>Run this command to add a component from ${r.name} to your project.</p>
      </div>
      ${commandBlock(packageCommands(addArgs(r)))}
      <div data-slot="dialog-footer" class=${dialogFooterClass()}>
        <ui-dialog-close><button type="button" data-slot="button" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Done</button></ui-dialog-close>
      </div>
    </ui-dialog-content>
  </ui-dialog>`;
}

function entry(r: Registry) {
  return html`<div role="listitem" data-slot="item" class=${cn(itemClass(), 'group/item relative gap-6 px-0')}>
    <div data-slot="item-media" data-variant="image" class=${cn(itemMediaClass({ variant: 'image' }), 'grayscale *:[svg]:size-8 *:[svg]:fill-foreground')}>${unsafeHTML(r.logo)}</div>
    <div data-slot="item-content" class=${itemContentClass()}>
      <div data-slot="item-title" class=${itemTitleClass()}>
        <a href=${r.homepage} target="_blank" rel="noopener noreferrer external" class="group flex items-center gap-1">${r.name} ${arrowUpRight}</a>
      </div>
      <p data-slot="item-description" class=${cn(itemDescriptionClass(), 'text-pretty')}>${r.description}</p>
    </div>
    <div data-slot="item-actions" class=${cn(itemActionsClass(), 'relative z-10 self-start')}>${addDialog(r)}</div>
  </div>`;
}

export default async function DirectoryPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const query = typeof sp.q === 'string' ? sp.q : '';
  const all = searchRegistries(query);
  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const page = Math.min(totalPages, Math.max(1, Number(sp.page) || 1));
  const shown = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const count = all.length;

  const toc: TocEntry[] = [];
  const body = html`
    <p>
      These registries work with the WebJs UI CLI. To add a component from one, run
      <code>npx @webjsdev/ui add &lt;component&gt;</code>, with <code>--registry &lt;url&gt;</code> for any registry
      but the first-party one.
    </p>
    <div role="note" data-slot="alert" class=${cn(alertClass(), 'not-typeset mt-6 w-auto rounded-2xl border-surface bg-surface font-semibold text-surface-foreground md:-mx-1')}>
      <div data-slot="alert-description" class=${cn(alertDescriptionClass(), 'text-card-foreground/80')}>
        Community registries are maintained by third-party developers. Always review code on installation to ensure it meets your security and quality standards.
      </div>
    </div>
    <p>Don't see a registry? Learn how to <a href="/ui/docs/registry/registry-index">add it here</a>.</p>
    <div data-not-typeset class="style-nova mt-6">
      <form method="get" action="/ui/docs/directory" role="search" data-slot="field" class="flex w-full flex-col gap-3">
        <div data-slot="input-group" role="group" class=${inputGroupClass()}>
          <div data-slot="input-group-addon" data-align="inline-start" class=${inputGroupAddonClass({ align: 'inline-start' })}>${searchIcon}</div>
          <input data-slot="input-group-control" type="search" name="q" value=${query} placeholder="Search" aria-label="Search registries" class=${cn(inputGroupInputClass(), 'h-full')} />
          <div data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
            <span class="text-muted-foreground tabular-nums sm:text-xs">${count} ${count === 1 ? 'registry' : 'registries'}</span>
          </div>
        </div>
      </form>
      ${shown.length
        ? html`<div role="list" data-slot="item-group" class=${cn(itemGroupClass(), 'my-8')}>
            ${shown.map((r, i) => html`${entry(r)}${i < shown.length - 1 ? html`<div role="separator" data-slot="item-separator" class=${cn(itemSeparatorClass(), 'my-1')}></div>` : ''}`)}
          </div>`
        : html`<p class="my-8 text-sm text-muted-foreground">No registries match "${query}".</p>`}
      ${totalPages > 1
        ? html`<nav aria-label="pagination" class="mx-auto flex w-full justify-center">
            <ul class="flex flex-row items-center gap-1">
              ${Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => html`<li>
                <a href=${pageHref(query, p)} aria-current=${p === page ? 'page' : nothing} class=${buttonClass({ variant: p === page ? 'outline' : 'ghost', size: 'icon' })}>${p}</a>
              </li>`)}
            </ul>
          </nav>`
        : ''}
    </div>
    ${heading(toc, 2, 'Documentation')}
    <p>You can use the WebJs UI CLI to install from your own code registry. Running your own registry allows you to distribute your custom components, blocks, pages, config, rules and other files to any WebJs app.</p>
    <div class="mt-6 grid gap-4 sm:grid-cols-2">
      ${DOC_CARDS.map((c) => html`<a href=${c.href} data-not-typeset class="flex w-full flex-col items-start rounded-2xl bg-surface p-6 text-sm text-surface-foreground no-underline transition-colors hover:bg-surface/80">
        <div class="font-medium">${c.name}</div>
        <div class="text-muted-foreground">${c.text}</div>
      </a>`)}
    </div>
  `;
  return docsPage({
    href: '/ui/docs/directory',
    title: 'Registry Directory',
    description: 'Discover registries for WebJs UI components and blocks.',
    toc,
    body,
  });
}
