/**
 * The sidebar-10 app sidebar: a notes app's team switcher and main links,
 * the favourite pages, the workspaces with their pages, and a secondary nav
 * pinned to the bottom. A fragment helper, so the markup is rendered by the
 * server; the sidebar, its rail and the menus are the kit's elements. Ported
 * from shadcn/ui's sidebar-10.
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
import { AudioLinesIcon, BlocksIcon, CalendarIcon, CommandIcon, HomeIcon, InboxIcon, MessageCircleQuestionIcon, SearchIcon, Settings2Icon, SparklesIcon, Trash2Icon } from '../../../lib/icons.ts';

// This is sample data.
const data: {
  teams: Team[];
  navMain: NavMainItem[];
  navSecondary: NavSecondaryItem[];
  favorites: Favorite[];
  workspaces: Workspace[];
} = {
  teams: [
    { name: 'Acme Inc', logo: CommandIcon, plan: 'Enterprise' },
    { name: 'Acme Corp.', logo: AudioLinesIcon, plan: 'Startup' },
    { name: 'Evil Corp.', logo: CommandIcon, plan: 'Free' },
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

export function appSidebar() {
  return html`
    <ui-sidebar class="border-r-0">
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
