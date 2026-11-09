/**
 * The preview-02 sidebar navigation pair: two cards, each holding a
 * non-collapsible sidebar with two menu groups. A fragment helper; each
 * sidebar is the kit's `<ui-sidebar collapsible="none">`, which needs no
 * provider and keeps no state. Installed at
 * `components/preview-02/sidebar-nav.ts`. Ported from shadcn/ui's preview-02.
 *
 * shadcn wraps each one in a SidebarProvider set to `min-h-0`. The kit's
 * provider is the full-height app shell, and a `collapsible="none"` sidebar
 * reads nothing from it, so the cards leave it out. Make each entry a link to
 * a real route, marked `data-active="true"` and `aria-current="page"` on the
 * current one.
 */
import { html, nothing } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { cardClass } from '../../../components/card.ts';
import {
  sidebarContentClass,
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarGroupLabelClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
  sidebarSeparatorClass,
} from '../../../components/sidebar.ts';
import '../../../components/sidebar.ts';
import { ActivityIcon, ArrowLeftRightIcon, BellIcon, BookOpenIcon, Building2Icon, CircleHelpIcon, CreditCardIcon, FileBarChartIcon, FileTextIcon, LayoutDashboardIcon, MessageSquareIcon, PaintbrushIcon, PieChartIcon, ShieldIcon, TargetIcon, TrendingUpIcon, UserIcon, WalletIcon } from '../../../lib/icons.ts';

type Entry = [icon: (cls?: string) => TemplateResult, label: string, active?: boolean];

function group(label: string, cls: string, entries: Entry[]) {
  return html`<div data-slot="sidebar-group" data-sidebar="group" class=${cn(sidebarGroupClass(), cls)}>
    <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${sidebarGroupLabelClass()}>${label}</div>
    <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
      <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
        ${entries.map(([icon, text, active]) => html`
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
            <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" data-active=${active ? 'true' : 'false'} aria-current=${active ? 'page' : nothing} class=${sidebarMenuButtonClass()}>${icon()}${text}</a>
          </li>`)}
      </ul>
    </div>
  </div>`;
}

function navCard(label: string, top: [string, Entry[]], bottom: [string, Entry[]]) {
  return html`<div data-slot="card" data-size="default" class=${cn(cardClass(), 'overflow-hidden py-0')}>
    <ui-sidebar collapsible="none" class="w-full bg-transparent">
      <nav aria-label=${label} data-slot="sidebar-content" data-sidebar="content" class=${cn(sidebarContentClass(), 'gap-0')}>
        ${group(top[0], 'pb-1', top[1])}
        <div role="none" data-slot="sidebar-separator" data-sidebar="separator" data-orientation="horizontal" class=${cn(sidebarSeparatorClass(), 'w-auto!')}></div>
        ${group(bottom[0], 'pt-1', bottom[1])}
      </nav>
    </ui-sidebar>
  </div>`;
}

export function sidebarNav() {
  return html`
    <div class="grid grid-cols-2 items-start gap-6">
      ${navCard('Overview and planning', ['Overview', [
        [LayoutDashboardIcon, 'Dashboard', true],
        [ArrowLeftRightIcon, 'Transactions'],
        [TrendingUpIcon, 'Investments'],
        [Building2Icon, 'Accounts'],
        [PieChartIcon, 'Spending'],
      ]], ['Planning', [
        [TargetIcon, 'Goals'],
        [WalletIcon, 'Budget'],
        [FileBarChartIcon, 'Reports'],
        [FileTextIcon, 'Documents'],
      ]])}
      ${navCard('Account and support', ['Account', [
        [UserIcon, 'Profile'],
        [CreditCardIcon, 'Billing', true],
        [BellIcon, 'Notifications'],
        [ShieldIcon, 'Security'],
        [PaintbrushIcon, 'Appearance'],
      ]], ['Support', [
        [CircleHelpIcon, 'Help Center'],
        [MessageSquareIcon, 'Contact Us'],
        [BookOpenIcon, 'Documentation'],
        [ActivityIcon, 'Status'],
      ]])}
    </div>
  `;
}
