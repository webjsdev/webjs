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
import { ChevronRightIcon, FileIcon, FolderIcon } from '../../../lib/icons.ts';

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
