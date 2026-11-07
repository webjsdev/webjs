/**
 * The sidebar-15 left sidebar: the team switcher and main nav in the header,
 * then the favorites, the workspaces and a secondary nav. A fragment helper,
 * so the markup is rendered by the server; the sidebar, its rail and the
 * menus are the kit's elements. Ported from shadcn/ui's sidebar-15.
 *
 * The data below is sample data. Replace it with your own, and point each
 * `url` at a real route.
 */
import { html } from '@webjsdev/core';
import {
  sidebarContentClass,
  sidebarHeaderClass,
} from '../../../components/sidebar.ts';
import { navFavorites, type Favorite } from './nav-favorites.ts';
import { navMain, type NavMainItem } from './nav-main.ts';
import { navSecondary, type NavSecondaryItem } from './nav-secondary.ts';
import { navWorkspaces, type Workspace } from './nav-workspaces.ts';
import { teamSwitcher, type Team } from './team-switcher.ts';

const TerminalIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19h8"></path><path d="m4 17 6-6-6-6"></path></svg>`;
const AudioLinesIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 10v3"></path><path d="M6 6v11"></path><path d="M10 3v18"></path><path d="M14 8v7"></path><path d="M18 5v13"></path><path d="M22 10v3"></path></svg>`;
const SearchIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle></svg>`;
const SparklesIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle></svg>`;
const HomeIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>`;
const InboxIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`;
const CalendarIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg>`;
const Settings2Icon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 17H5"></path><path d="M19 7h-9"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>`;
const BlocksIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2"></path><rect x="14" y="2" width="8" height="8" rx="1"></rect></svg>`;
const Trash2Icon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
const MessageCircleQuestionIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>`;

// This is sample data.
const data: {
  teams: Team[];
  navMain: NavMainItem[];
  navSecondary: NavSecondaryItem[];
  favorites: Favorite[];
  workspaces: Workspace[];
} = {
  teams: [
    { name: 'Acme Inc', logo: TerminalIcon, plan: 'Enterprise' },
    { name: 'Acme Corp.', logo: AudioLinesIcon, plan: 'Startup' },
    { name: 'Evil Corp.', logo: TerminalIcon, plan: 'Free' },
  ],
  navMain: [
    { title: 'Search', url: '#', icon: SearchIcon },
    { title: 'Ask AI', url: '#', icon: SparklesIcon },
    { title: 'Home', url: '#', icon: HomeIcon, isActive: true },
    { title: 'Inbox', url: '#', icon: InboxIcon, badge: '10' },
  ],
  navSecondary: [
    { title: 'Calendar', url: '#', icon: CalendarIcon },
    { title: 'Settings', url: '#', icon: Settings2Icon },
    { title: 'Templates', url: '#', icon: BlocksIcon },
    { title: 'Trash', url: '#', icon: Trash2Icon },
    { title: 'Help', url: '#', icon: MessageCircleQuestionIcon },
  ],
  favorites: [
    { name: 'Project Management & Task Tracking', url: '#', emoji: '📊' },
    { name: 'Family Recipe Collection & Meal Planning', url: '#', emoji: '🍳' },
    { name: 'Fitness Tracker & Workout Routines', url: '#', emoji: '💪' },
    { name: 'Book Notes & Reading List', url: '#', emoji: '📚' },
    { name: 'Sustainable Gardening Tips & Plant Care', url: '#', emoji: '🌱' },
    { name: 'Language Learning Progress & Resources', url: '#', emoji: '🗣️' },
    { name: 'Home Renovation Ideas & Budget Tracker', url: '#', emoji: '🏠' },
    { name: 'Personal Finance & Investment Portfolio', url: '#', emoji: '💰' },
    { name: 'Movie & TV Show Watchlist with Reviews', url: '#', emoji: '🎬' },
    { name: 'Daily Habit Tracker & Goal Setting', url: '#', emoji: '✅' },
  ],
  workspaces: [
    {
      name: 'Personal Life Management',
      emoji: '🏠',
      pages: [
        { name: 'Daily Journal & Reflection', url: '#', emoji: '📔' },
        { name: 'Health & Wellness Tracker', url: '#', emoji: '🍏' },
        { name: 'Personal Growth & Learning Goals', url: '#', emoji: '🌟' },
      ],
    },
    {
      name: 'Professional Development',
      emoji: '💼',
      pages: [
        { name: 'Career Objectives & Milestones', url: '#', emoji: '🎯' },
        { name: 'Skill Acquisition & Training Log', url: '#', emoji: '🧠' },
        { name: 'Networking Contacts & Events', url: '#', emoji: '🤝' },
      ],
    },
    {
      name: 'Creative Projects',
      emoji: '🎨',
      pages: [
        { name: 'Writing Ideas & Story Outlines', url: '#', emoji: '✍️' },
        { name: 'Art & Design Portfolio', url: '#', emoji: '🖼️' },
        { name: 'Music Composition & Practice Log', url: '#', emoji: '🎵' },
      ],
    },
    {
      name: 'Home Management',
      emoji: '🏡',
      pages: [
        { name: 'Household Budget & Expense Tracking', url: '#', emoji: '💰' },
        { name: 'Home Maintenance Schedule & Tasks', url: '#', emoji: '🔧' },
        { name: 'Family Calendar & Event Planning', url: '#', emoji: '📅' },
      ],
    },
    {
      name: 'Travel & Adventure',
      emoji: '🧳',
      pages: [
        { name: 'Trip Planning & Itineraries', url: '#', emoji: '🗺️' },
        { name: 'Travel Bucket List & Inspiration', url: '#', emoji: '🌎' },
        { name: 'Travel Journal & Photo Gallery', url: '#', emoji: '📸' },
      ],
    },
  ],
};

export function sidebarLeft() {
  // shadcn's className lands on the sidebar's fixed container, which the
  // kit's <ui-sidebar> renders as its data-slot="sidebar-container" child.
  return html`
    <ui-sidebar class="[&>[data-slot=sidebar-container]]:border-r-0">
      <div data-slot="sidebar-header" data-sidebar="header" class=${sidebarHeaderClass()}>
        ${teamSwitcher({ teams: data.teams })}
        ${navMain({ items: data.navMain })}
      </div>
      <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
        ${navFavorites({ favorites: data.favorites })}
        ${navWorkspaces({ workspaces: data.workspaces })}
        ${navSecondary({ items: data.navSecondary, class: 'mt-auto' })}
      </div>
      <ui-sidebar-rail></ui-sidebar-rail>
    </ui-sidebar>
  `;
}
