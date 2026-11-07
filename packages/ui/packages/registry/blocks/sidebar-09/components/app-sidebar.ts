/**
 * The sidebar-09 app sidebar: two sidebars nested in one. The first is an
 * icon rail of mail folders with the user menu; the second lists the open
 * folder's messages with an unread filter and a search field. The whole
 * sidebar collapses to the rail. A fragment helper, so the markup is rendered
 * by the server; the sidebars and the menu are the kit's elements. Ported
 * from shadcn/ui's sidebar-09.
 *
 * shadcn keeps the open folder and its messages in React state and reshuffles
 * the list on each click. Here the first folder renders as the open one and
 * each folder is a link: in your app the folder is a route segment or a
 * search param, so render its messages on the server and mark its link
 * `data-active="true"` and `aria-current="page"`.
 *
 * The data below is sample data. Replace it with your own.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { labelClass } from '../../../components/label.ts';
import '../../../components/switch.ts';
import {
  sidebarContentClass,
  sidebarFooterClass,
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarHeaderClass,
  sidebarInputClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';
import { navUser } from './nav-user.ts';

const CommandIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"></path></svg>`;
const InboxIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`;
const FileIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path></svg>`;
const SendIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path></svg>`;
const ArchiveXIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="5" x="2" y="3" rx="1"></rect><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path><path d="m9.5 17 5-5"></path><path d="m9.5 12 5 5"></path></svg>`;
const Trash2Icon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

interface Folder {
  title: string;
  url: string;
  icon: (cls?: string) => TemplateResult;
  isActive: boolean;
}

interface Mail {
  name: string;
  email: string;
  subject: string;
  date: string;
  teaser: string;
}

// This is sample data.
const data: {
  user: { name: string; email: string; avatar: string };
  navMain: Folder[];
  mails: Mail[];
} = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: 'https://github.com/shadcn.png',
  },
  navMain: [
    { title: 'Inbox', url: '#', icon: InboxIcon, isActive: true },
    { title: 'Drafts', url: '#', icon: FileIcon, isActive: false },
    { title: 'Sent', url: '#', icon: SendIcon, isActive: false },
    { title: 'Junk', url: '#', icon: ArchiveXIcon, isActive: false },
    { title: 'Trash', url: '#', icon: Trash2Icon, isActive: false },
  ],
  mails: [
    {
      name: 'William Smith',
      email: 'williamsmith@example.com',
      subject: 'Meeting Tomorrow',
      date: '09:34 AM',
      teaser: 'Hi team, just a reminder about our meeting tomorrow at 10 AM.\nPlease come prepared with your project updates.',
    },
    {
      name: 'Alice Smith',
      email: 'alicesmith@example.com',
      subject: 'Re: Project Update',
      date: 'Yesterday',
      teaser: "Thanks for the update. The progress looks great so far.\nLet's schedule a call to discuss the next steps.",
    },
    {
      name: 'Bob Johnson',
      email: 'bobjohnson@example.com',
      subject: 'Weekend Plans',
      date: '2 days ago',
      teaser: "Hey everyone! I'm thinking of organizing a team outing this weekend.\nWould you be interested in a hiking trip or a beach day?",
    },
    {
      name: 'Emily Davis',
      email: 'emilydavis@example.com',
      subject: 'Re: Question about Budget',
      date: '2 days ago',
      teaser: "I've reviewed the budget numbers you sent over.\nCan we set up a quick call to discuss some potential adjustments?",
    },
    {
      name: 'Michael Wilson',
      email: 'michaelwilson@example.com',
      subject: 'Important Announcement',
      date: '1 week ago',
      teaser: "Please join us for an all-hands meeting this Friday at 3 PM.\nWe have some exciting news to share about the company's future.",
    },
    {
      name: 'Sarah Brown',
      email: 'sarahbrown@example.com',
      subject: 'Re: Feedback on Proposal',
      date: '1 week ago',
      teaser: "Thank you for sending over the proposal. I've reviewed it and have some thoughts.\nCould we schedule a meeting to discuss my feedback in detail?",
    },
    {
      name: 'David Lee',
      email: 'davidlee@example.com',
      subject: 'New Project Idea',
      date: '1 week ago',
      teaser: "I've been brainstorming and came up with an interesting project concept.\nDo you have time this week to discuss its potential impact and feasibility?",
    },
    {
      name: 'Olivia Wilson',
      email: 'oliviawilson@example.com',
      subject: 'Vacation Plans',
      date: '1 week ago',
      teaser: "Just a heads up that I'll be taking a two-week vacation next month.\nI'll make sure all my projects are up to date before I leave.",
    },
    {
      name: 'James Martin',
      email: 'jamesmartin@example.com',
      subject: 'Re: Conference Registration',
      date: '1 week ago',
      teaser: "I've completed the registration for the upcoming tech conference.\nLet me know if you need any additional information from my end.",
    },
    {
      name: 'Sophia White',
      email: 'sophiawhite@example.com',
      subject: 'Team Dinner',
      date: '1 week ago',
      teaser: "To celebrate our recent project success, I'd like to organize a team dinner.\nAre you available next Friday evening? Please let me know your preferences.",
    },
  ],
};

export function appSidebar() {
  const active = data.navMain.find((item) => item.isActive) ?? data.navMain[0];
  return html`
    <ui-sidebar collapsible="icon" class="overflow-hidden **:data-[slot=sidebar-inner]:flex-row" style="--sidebar-width: 350px">
      <ui-sidebar collapsible="none" class="w-[calc(var(--sidebar-width-icon)+1px)]! border-r">
        <div data-slot="sidebar-header" data-sidebar="header" class=${sidebarHeaderClass()}>
          <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
            <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
              <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="lg" class=${cn(sidebarMenuButtonClass({ size: 'lg' }), 'md:h-8 md:p-0')}>
                <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  ${CommandIcon('size-4')}
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-medium">Acme Inc</span>
                  <span class="truncate text-xs">Enterprise</span>
                </div>
              </a>
            </li>
          </ul>
        </div>
        <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
          <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
            <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${cn(sidebarGroupContentClass(), 'px-1.5 md:px-0')}>
              <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
                ${data.navMain.map((item) => html`
                  <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                    <a href=${item.url} title=${item.title} data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" data-active=${item === active ? 'true' : 'false'} aria-current=${item === active ? 'page' : null} class=${cn(sidebarMenuButtonClass(), 'px-2.5 md:px-2')}>
                      ${item.icon()}
                      <span>${item.title}</span>
                    </a>
                  </li>
                `)}
              </ul>
            </div>
          </div>
        </div>
        <div data-slot="sidebar-footer" data-sidebar="footer" class=${sidebarFooterClass()}>
          ${navUser({ user: data.user })}
        </div>
      </ui-sidebar>

      <ui-sidebar collapsible="none" class="hidden flex-1 md:flex">
        <div data-slot="sidebar-header" data-sidebar="header" class=${cn(sidebarHeaderClass(), 'gap-3.5 border-b p-4')}>
          <div class="flex w-full items-center justify-between">
            <div class="text-base font-medium text-foreground">${active.title}</div>
            <label class=${cn(labelClass(), 'flex items-center gap-2 text-sm')}>
              <span>Unreads</span>
              <ui-switch name="unreads" class="shadow-none"></ui-switch>
            </label>
          </div>
          <input type="search" name="q" placeholder="Type to search..." aria-label="Search mail" data-slot="sidebar-input" data-sidebar="input" class=${sidebarInputClass()}>
        </div>
        <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
          <div data-slot="sidebar-group" data-sidebar="group" class=${cn(sidebarGroupClass(), 'px-0')}>
            <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
              ${data.mails.map((mail) => html`
                <a href="#" class="flex flex-col items-start gap-2 border-b p-4 text-sm leading-tight whitespace-nowrap text-inherit no-underline last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                  <div class="flex w-full items-center gap-2">
                    <span>${mail.name}</span> <span class="ml-auto text-xs">${mail.date}</span>
                  </div>
                  <span class="font-medium">${mail.subject}</span>
                  <span class="line-clamp-2 w-[260px] text-xs whitespace-break-spaces">${mail.teaser}</span>
                </a>
              `)}
            </div>
          </div>
        </div>
      </ui-sidebar>
    </ui-sidebar>
  `;
}
