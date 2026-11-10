import { html, nothing } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { collapsibleClass, collapsibleContentClass } from '#modules/ui/components/collapsible.ts';
import { ChevronRightIcon, FileIcon, FolderIcon } from '#lib/ui/lucide.ts';

type FileNode =
  | { type: 'file'; name: string; path: string }
  | { type: 'folder'; name: string; path: string; children: FileNode[] };

const files: FileNode[] = [
  {
    type: 'folder',
    name: 'app',
    path: 'app',
    children: [
      { type: 'file', name: 'layout.tsx', path: 'app/layout.tsx' },
      { type: 'file', name: 'page.tsx', path: 'app/page.tsx' },
    ],
  },
  {
    type: 'folder',
    name: 'components',
    path: 'components',
    children: [
      {
        type: 'folder',
        name: 'ui',
        path: 'components/ui',
        children: [
          { type: 'file', name: 'button.tsx', path: 'components/ui/button.tsx' },
        ],
      },
      { type: 'file', name: 'login-form.tsx', path: 'components/login-form.tsx' },
    ],
  },
];

const selected = 'components/ui/button.tsx';

// A folder is a native <details>, open to start with. The chevron turns only
// for its OWN folder: [[open]>summary>&] matches the summary of an open
// details, where group-open would also match every folder nested inside an
// open one. The selected file is the one the reader picked. Wiring the
// selection to a click is the reader's.
function FileTreeNode(node: FileNode): unknown {
  if (node.type === 'folder') {
    return html`
      <details data-slot="collapsible" open class=${collapsibleClass()}>
        <summary data-slot="collapsible-trigger" data-variant="ghost" data-size="sm" class=${cn(buttonClass({ variant: 'ghost', size: 'sm' }), 'w-full cursor-pointer list-none justify-start font-normal [&::-webkit-details-marker]:hidden')}>
          ${ChevronRightIcon('transition-transform [[open]>summary>&]:rotate-90')}
          ${FolderIcon()}
          ${node.name}
        </summary>
        <div data-slot="collapsible-content" class=${collapsibleContentClass()}>
          <div class="ml-4 flex flex-col">
            ${node.children.map((child) => FileTreeNode(child))}
          </div>
        </div>
      </details>
    `;
  }
  const current = selected === node.path;
  return html`
    <button type="button" aria-current=${current ? 'true' : nothing} data-slot="button" data-variant="ghost" data-size="sm" class=${cn(buttonClass({ variant: 'ghost', size: 'sm' }), 'w-full justify-start font-normal', current && 'bg-accent text-accent-foreground')}>
      ${FileIcon()}
      ${node.name}
    </button>
  `;
}

export default function FileTreeDemo() {
  return html`
    <div class="flex w-full max-w-xs flex-col py-6 text-sm">
      ${files.map((node) => FileTreeNode(node))}
    </div>
  `;
}
