/**
 * The sidebar-11 app sidebar: a list of changed files with their git state,
 * and the project's files as a collapsible tree. A fragment helper, so the
 * markup is rendered by the server; each folder is a native `<details>`, so
 * the tree opens and closes with no JavaScript. Ported from shadcn/ui's
 * sidebar-11.
 *
 * The data below is sample data. Replace it with your own, and make each
 * file a link to where it opens.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { collapsibleClass, collapsibleContentClass } from '../../../components/collapsible.ts';
import {
  sidebarContentClass,
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarGroupLabelClass,
  sidebarMenuBadgeClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
  sidebarMenuSubClass,
} from '../../../components/sidebar.ts';

const FileIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path></svg>`;
const FolderIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path></svg>`;
const ChevronRightIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;

/** A file name, or a folder as `[name, ...children]`. */
type TreeItem = string | TreeItem[];

// This is sample data.
const data: { changes: { file: string; state: string }[]; tree: TreeItem[] } = {
  changes: [
    { file: 'README.md', state: 'M' },
    { file: 'api/hello/route.ts', state: 'U' },
    { file: 'app/layout.tsx', state: 'M' },
  ],
  tree: [
    ['app', ['api', ['hello', ['route.ts']], 'page.tsx', 'layout.tsx', ['blog', ['page.tsx']]]],
    ['components', ['ui', 'button.tsx', 'card.tsx'], 'header.tsx', 'footer.tsx'],
    ['lib', ['util.ts']],
    ['public', 'favicon.ico', 'vercel.svg'],
    '.eslintrc.json',
    '.gitignore',
    'next.config.js',
    'tailwind.config.js',
    'package.json',
    'README.md',
  ],
};

function tree(item: TreeItem): unknown {
  const [name, ...items] = Array.isArray(item) ? item : [item];
  if (!items.length) {
    const active = name === 'button.tsx';
    return html`
      <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
        <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" data-active=${active ? 'true' : 'false'} class=${cn(sidebarMenuButtonClass(), 'data-[active=true]:bg-transparent')}>
          ${FileIcon()}
          ${name}
        </button>
      </li>
    `;
  }
  return html`
    <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
      <details data-slot="collapsible" class=${cn(collapsibleClass(), 'group/collapsible [&[open]>summary>svg:first-child]:rotate-90')} ?open=${name === 'components' || name === 'ui'}>
        <summary data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${cn(sidebarMenuButtonClass(), 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
          ${ChevronRightIcon('transition-transform')}
          ${FolderIcon()}
          ${name}
        </summary>
        <div data-slot="collapsible-content" class=${collapsibleContentClass()}>
          <ul data-slot="sidebar-menu-sub" data-sidebar="menu-sub" class=${sidebarMenuSubClass()}>
            ${items.map((sub) => tree(sub))}
          </ul>
        </div>
      </details>
    </li>
  `;
}

export function appSidebar() {
  return html`
    <ui-sidebar>
      <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
        <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
          <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${sidebarGroupLabelClass()}>Changes</div>
          <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
            <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
              ${data.changes.map((item) => html`
                <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                  <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${sidebarMenuButtonClass()}>
                    ${FileIcon()}
                    ${item.file}
                  </button>
                  <div data-slot="sidebar-menu-badge" data-sidebar="menu-badge" class=${sidebarMenuBadgeClass()}>${item.state}</div>
                </li>
              `)}
            </ul>
          </div>
        </div>
        <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
          <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${sidebarGroupLabelClass()}>Files</div>
          <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
            <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
              ${data.tree.map((item) => tree(item))}
            </ul>
          </div>
        </div>
      </div>
      <ui-sidebar-rail></ui-sidebar-rail>
    </ui-sidebar>
  `;
}
