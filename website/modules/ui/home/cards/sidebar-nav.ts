import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  sidebarContentClass, sidebarGroupClass, sidebarGroupLabelClass, sidebarGroupContentClass,
  sidebarMenuClass, sidebarMenuItemClass, sidebarMenuButtonClass,
} from '#modules/ui/components/sidebar.ts';
import * as I from '#lib/ui/hugeicons.ts';
import { Card } from '../parts.ts';

/**
 * shadcn's SidebarNav card (apps/v4/app/(app)/(root)/cards/sidebar-nav.tsx):
 * four menus, each a `collapsible="none"` sidebar inside a card. A
 * non-collapsible sidebar is a plain flex column with no provider or state,
 * so it is written here as the markup that sidebar renders.
 */
type Entry = [icon: (cls?: string, sw?: number) => unknown, label: string, active?: boolean];

function section(label: string, cls: string, entries: Entry[]) {
  return Card(cn('w-full overflow-hidden rounded-3xl py-0', cls), html`
    <div data-slot="sidebar" class="flex h-full w-full min-h-0 flex-col bg-transparent text-sidebar-foreground">
      <div data-slot="sidebar-content" data-sidebar="content" class=${cn(sidebarContentClass(), 'gap-0 overflow-hidden')}>
        <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
          <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${sidebarGroupLabelClass()}>${label}</div>
          <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
            <ul data-slot="sidebar-menu" data-sidebar="menu" class=${cn(sidebarMenuClass(), 'gap-1')}>
              ${entries.map(([icon, text, active]) => html`
                <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                  <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" data-active=${active ? 'true' : 'false'} class=${sidebarMenuButtonClass()}>
                    ${icon('', 2)}<span>${text}</span>
                  </button>
                </li>`)}
            </ul>
          </div>
        </div>
      </div>
    </div>`);
}

export function sidebarNav() {
  return html`
    <div class="grid w-full grid-cols-2 gap-4 xl:gap-6">
      ${section('Overview', 'xl:col-start-1 xl:row-start-2', [
        [I.Analytics01Icon, 'Analytics', true],
        [I.ArrowDataTransferHorizontalIcon, 'Transactions'],
        [I.AnalyticsUpIcon, 'Investments'],
        [I.BankIcon, 'Accounts'],
        [I.PieChartIcon, 'Spending'],
      ])}
      ${section('Planning', 'xl:col-start-1 xl:row-start-1', [
        [I.File02Icon, 'Documents'],
        [I.Wallet01Icon, 'Budget'],
        [I.ChartBarLineIcon, 'Reports'],
        [I.Target02Icon, 'Goals'],
        [I.Calendar03Icon, 'Calendar'],
      ])}
      ${section('Support', 'flex xl:col-start-2 xl:row-start-1', [
        [I.HelpCircleIcon, 'Help Center'],
        [I.BookOpen02Icon, 'Docs'],
        [I.Message01Icon, 'Contact Us'],
        [I.ActivityIcon, 'Status'],
        [I.Globe02Icon, 'Community'],
      ])}
      ${section('Account', 'flex xl:col-start-2 xl:row-start-2', [
        [I.UserIcon, 'Profile'],
        [I.CreditCardIcon, 'Billing', true],
        [I.Notification03Icon, 'Notifications'],
        [I.ShieldIcon, 'Security'],
        [I.PaintBoardIcon, 'Appearance'],
      ])}
    </div>`;
}
