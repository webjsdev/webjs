import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { cardClass, cardHeaderClass, cardContentClass } from '#modules/ui/components/card.ts';
import {
  collapsibleClass, collapsibleContentClass,
} from '#modules/ui/components/collapsible.ts';
import { ChevronRightIcon, FileIcon, FolderIcon } from '#lib/ui/lucide.ts';

type FileTreeItem = { name: string } | { name: string; items: FileTreeItem[] };

const fileTree: FileTreeItem[] = [
  {
    name: 'components',
    items: [
      {
        name: 'ui',
        items: [
          { name: 'button.tsx' },
          { name: 'card.tsx' },
          { name: 'dialog.tsx' },
          { name: 'input.tsx' },
          { name: 'select.tsx' },
          { name: 'table.tsx' },
        ],
      },
      { name: 'login-form.tsx' },
      { name: 'register-form.tsx' },
    ],
  },
  {
    name: 'lib',
    items: [{ name: 'utils.ts' }, { name: 'cn.ts' }, { name: 'api.ts' }],
  },
  {
    name: 'hooks',
    items: [
      { name: 'use-media-query.ts' },
      { name: 'use-debounce.ts' },
      { name: 'use-local-storage.ts' },
    ],
  },
  {
    name: 'types',
    items: [{ name: 'index.d.ts' }, { name: 'api.d.ts' }],
  },
  {
    name: 'public',
    items: [
      { name: 'favicon.ico' },
      { name: 'logo.svg' },
      { name: 'images' },
    ],
  },
  { name: 'app.tsx' },
  { name: 'layout.tsx' },
  { name: 'globals.css' },
  { name: 'package.json' },
  { name: 'tsconfig.json' },
  { name: 'README.md' },
  { name: '.gitignore' },
];

// Each folder is a native <details>. The chevron turns only for its OWN
// folder: [[open]>summary>&] matches the summary of an open details, where
// group-open would also match every folder nested inside an open one. The
// summary takes the button classes alone, since the trigger helper's text-sm
// would override the small button's text size.
const renderItem = (fileItem: FileTreeItem): unknown => {
  if ('items' in fileItem) {
    return html`
      <details data-slot="collapsible" class=${collapsibleClass()}>
        <summary data-slot="collapsible-trigger" data-variant="ghost" data-size="sm" class=${cn(buttonClass({ variant: 'ghost', size: 'sm' }), 'w-full cursor-pointer list-none justify-start transition-none hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden')}>
          ${ChevronRightIcon('transition-transform [[open]>summary>&]:rotate-90')}
          ${FolderIcon()}
          ${fileItem.name}
        </summary>
        <div data-slot="collapsible-content" class=${cn(collapsibleContentClass(), 'mt-1 ml-5')}>
          <div class="flex flex-col gap-1">
            ${fileItem.items.map((child) => renderItem(child))}
          </div>
        </div>
      </details>
    `;
  }
  return html`
    <button type="button" data-slot="button" data-variant="link" data-size="sm" class=${cn(buttonClass({ variant: 'link', size: 'sm' }), 'w-full justify-start gap-2 text-foreground')}>
      ${FileIcon()}
      <span>${fileItem.name}</span>
    </button>
  `;
};

export default function CollapsibleFileTree() {
  return html`
    <div data-slot="card" data-size="sm" class=${cn(cardClass({ size: 'sm' }), 'mx-auto w-full max-w-[16rem] gap-2')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <ui-tabs value="explorer">
          <ui-tabs-list class="w-full">
            <ui-tabs-trigger value="explorer">Explorer</ui-tabs-trigger>
            <ui-tabs-trigger value="settings">Outline</ui-tabs-trigger>
          </ui-tabs-list>
        </ui-tabs>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div class="flex flex-col gap-1">
          ${fileTree.map((item) => renderItem(item))}
        </div>
      </div>
    </div>
  `;
}
