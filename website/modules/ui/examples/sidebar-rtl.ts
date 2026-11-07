import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { avatarClass, avatarFallbackClass, avatarImageClass } from '#modules/ui/components/avatar.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { collapsibleClass, collapsibleContentClass } from '#modules/ui/components/collapsible.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';
import {
  sidebarContentClass,
  sidebarFooterClass,
  sidebarGroupClass,
  sidebarGroupLabelClass,
  sidebarHeaderClass,
  sidebarMenuActionClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
  sidebarMenuSubButtonClass,
  sidebarMenuSubClass,
  sidebarMenuSubItemClass,
} from '#modules/ui/components/sidebar.ts';
import {
  ArrowRightIcon, BadgeCheckIcon, BellIcon, BookOpenIcon, BotIcon, ChevronRightIcon, ChevronsUpDownIcon,
  CreditCardIcon, FolderIcon, FrameIcon, GalleryVerticalEndIcon, LogOutIcon, MapIcon, MoreHorizontalIcon,
  PieChartIcon, Settings2Icon, SparklesIcon, TerminalSquareIcon, Trash2Icon,
} from '#lib/utils/icons.ts';

export const description = 'A sidebar that collapses to icons, right to left';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      teamName: 'Acme Inc',
      teamPlan: 'Enterprise',
      platform: 'Platform',
      projects: 'Projects',
      viewProject: 'View Project',
      shareProject: 'Share Project',
      deleteProject: 'Delete Project',
      more: 'More',
      upgradeToPro: 'Upgrade to Pro',
      account: 'Account',
      billing: 'Billing',
      notifications: 'Notifications',
      logOut: 'Log out',
      playground: 'Playground',
      history: 'History',
      starred: 'Starred',
      settings: 'Settings',
      models: 'Models',
      genesis: 'Genesis',
      explorer: 'Explorer',
      quantum: 'Quantum',
      documentation: 'Documentation',
      introduction: 'Introduction',
      getStarted: 'Get Started',
      tutorials: 'Tutorials',
      changelog: 'Changelog',
      general: 'General',
      team: 'Team',
      limits: 'Limits',
      designEngineering: 'Design Engineering',
      salesMarketing: 'Sales & Marketing',
      travel: 'Travel',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      teamName: 'شركة أكمي',
      teamPlan: 'المؤسسة',
      platform: 'المنصة',
      projects: 'المشاريع',
      viewProject: 'عرض المشروع',
      shareProject: 'مشاركة المشروع',
      deleteProject: 'حذف المشروع',
      more: 'المزيد',
      upgradeToPro: 'ترقية إلى Pro',
      account: 'الحساب',
      billing: 'الفوترة',
      notifications: 'الإشعارات',
      logOut: 'تسجيل الخروج',
      playground: 'ملعب',
      history: 'السجل',
      starred: 'المميز',
      settings: 'الإعدادات',
      models: 'النماذج',
      genesis: 'جينيسيس',
      explorer: 'إكسبلورر',
      quantum: 'كوانتوم',
      documentation: 'التوثيق',
      introduction: 'مقدمة',
      getStarted: 'ابدأ',
      tutorials: 'الدروس',
      changelog: 'سجل التغييرات',
      general: 'عام',
      team: 'الفريق',
      limits: 'الحدود',
      designEngineering: 'هندسة التصميم',
      salesMarketing: 'المبيعات والتسويق',
      travel: 'السفر',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      teamName: 'אקמי בע״מ',
      teamPlan: 'ארגוני',
      platform: 'פלטפורמה',
      projects: 'פרויקטים',
      viewProject: 'הצג פרויקט',
      shareProject: 'שתף פרויקט',
      deleteProject: 'מחק פרויקט',
      more: 'עוד',
      upgradeToPro: 'שדרג ל-Pro',
      account: 'חשבון',
      billing: 'חיוב',
      notifications: 'התראות',
      logOut: 'התנתק',
      playground: 'מגרש משחקים',
      history: 'היסטוריה',
      starred: 'מועדפים',
      settings: 'הגדרות',
      models: 'מודלים',
      genesis: "ג'נסיס",
      explorer: 'אקספלורר',
      quantum: 'קוונטום',
      documentation: 'תיעוד',
      introduction: 'מבוא',
      getStarted: 'התחל',
      tutorials: 'מדריכים',
      changelog: 'יומן שינויים',
      general: 'כללי',
      team: 'צוות',
      limits: 'מגבלות',
      designEngineering: 'הנדסת עיצוב',
      salesMarketing: 'מכירות ושיווק',
      travel: 'נסיעות',
    },
  },
} as const;

type Icon = (cls?: string) => TemplateResult;
type Lang = keyof typeof translations;

// shadcn's LanguageSelector languages, in its order.
const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic (العربية)' },
  { value: 'he', label: 'Hebrew (עברית)' },
];

/**
 * shadcn's LanguageSelector as a GET form: the language is the `?lang=` query
 * string, so with JavaScript off the Apply button submits it, and with it on
 * `<example-bind>` submits the select as soon as it changes.
 */
function languageSelector(lang: Lang) {
  return html`<form method="get" data-view-submit class="absolute top-4 right-4 z-10 flex items-center gap-2 rtl:right-auto rtl:left-4" dir="ltr">
    <label for="sidebar-rtl-language" class="sr-only">Language</label>
    <ui-select size="sm">
      <select id="sidebar-rtl-language" name="lang" data-autosubmit class=${cn(selectTriggerClass(), 'h-8 w-36')}>
        ${LANGUAGES.map((l) => html`<option value=${l.value} ?selected=${l.value === lang}>${l.label}</option>`)}
      </select>
    </ui-select>
    <noscript><button type="submit" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Apply</button></noscript>
  </form>`;
}

const user = {
  name: 'shadcn',
  email: 'm@example.com',
  avatar: '/public/avatars/vivek.jpg',
};

function userAvatar() {
  return html`<span data-slot="avatar" data-size="default" class=${cn(avatarClass(), 'h-8 w-8 rounded-lg')}>
    <span data-slot="avatar-fallback" class=${cn(avatarFallbackClass(), 'rounded-lg')}>CN</span>
    <img data-slot="avatar-image" src=${user.avatar} alt=${user.name} class=${avatarImageClass()}>
  </span>`;
}

function userText() {
  return html`<div class="grid flex-1 text-start text-sm leading-tight">
    <span class="truncate font-medium">${user.name}</span>
    <span class="truncate text-xs">${user.email}</span>
  </div>`;
}

// The provider is the dir attribute, and the sidebar sits on the reading
// side: on the right when the page reads right to left.
export default function SidebarRtl({ lang: asked }: { lang?: string } = {}) {
  // Arabic unless ?lang= names another of the three, as shadcn's default.
  const lang: Lang = asked === 'en' || asked === 'he' ? asked : 'ar';
  const { dir, values: t } = translations[lang];
  const side = dir === 'rtl' ? 'right' : 'left';

  const navMain: { title: string; icon: Icon; isActive?: boolean; items: string[] }[] = [
    { title: t.playground, icon: TerminalSquareIcon, isActive: true, items: [t.history, t.starred, t.settings] },
    { title: t.models, icon: BotIcon, items: [t.genesis, t.explorer, t.quantum] },
    { title: t.documentation, icon: BookOpenIcon, items: [t.introduction, t.getStarted, t.tutorials, t.changelog] },
    { title: t.settings, icon: Settings2Icon, items: [t.general, t.team, t.billing, t.limits] },
  ];
  const projects: { name: string; icon: Icon }[] = [
    { name: t.designEngineering, icon: FrameIcon },
    { name: t.salesMarketing, icon: PieChartIcon },
    { name: t.travel, icon: MapIcon },
  ];

  return html`
    <example-bind class="relative block" dir=${dir} lang=${lang} data-lang=${lang}>
      ${languageSelector(lang)}
      <ui-sidebar-provider>
        <ui-sidebar collapsible="icon" side=${side}>
          <div data-slot="sidebar-header" data-sidebar="header" class=${sidebarHeaderClass()}>
            <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
              <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="lg" class=${sidebarMenuButtonClass({ size: 'lg' })}>
                  <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    ${GalleryVerticalEndIcon('size-4')}
                  </div>
                  <div class="flex flex-col gap-0.5 leading-none">
                    <span class="font-medium">${t.teamName}</span>
                    <span>${t.teamPlan}</span>
                  </div>
                </a>
              </li>
            </ul>
          </div>
          <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
            <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
              <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${sidebarGroupLabelClass()}>${t.platform}</div>
              <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
                ${navMain.map((item) => html`
                  <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                    <details data-slot="collapsible" class=${cn(collapsibleClass(), 'group/collapsible')} ?open=${!!item.isActive}>
                      <summary data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${cn(sidebarMenuButtonClass(), 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
                        ${item.icon()}
                        <span>${item.title}</span>
                        ${ChevronRightIcon('ms-auto transition-transform duration-200 group-open/collapsible:rotate-90 rtl:rotate-180 rtl:group-open/collapsible:rotate-90')}
                      </summary>
                      <div data-slot="collapsible-content" class=${collapsibleContentClass()}>
                        <ul data-slot="sidebar-menu-sub" data-sidebar="menu-sub" class=${sidebarMenuSubClass()}>
                          ${item.items.map((title) => html`
                            <li data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" class=${sidebarMenuSubItemClass()}>
                              <a href="#" data-slot="sidebar-menu-sub-button" data-sidebar="menu-sub-button" data-size="md" class=${sidebarMenuSubButtonClass()}>
                                <span>${title}</span>
                              </a>
                            </li>
                          `)}
                        </ul>
                      </div>
                    </details>
                  </li>
                `)}
              </ul>
            </div>
            <div data-slot="sidebar-group" data-sidebar="group" class=${cn(sidebarGroupClass(), 'group-data-[collapsible=icon]:hidden')}>
              <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${sidebarGroupLabelClass()}>${t.projects}</div>
              <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
                ${projects.map((item, i) => html`
                  <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                    <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${sidebarMenuButtonClass()}>
                      ${item.icon()}
                      <span>${item.name}</span>
                    </a>
                    <button type="button" id=${`sidebar-rtl-more-${i}`} data-slot="sidebar-menu-action" data-sidebar="menu-action" class=${cn(sidebarMenuActionClass({ showOnHover: true }), 'aria-expanded:bg-muted')}>
                      ${MoreHorizontalIcon()}
                      <span class="sr-only">${t.more}</span>
                    </button>
                    <ui-dropdown-menu trigger=${`sidebar-rtl-more-${i}`}>
                      <ui-dropdown-menu-content class="w-48 rounded-lg" side=${side === 'right' ? 'left' : 'right'} align="start">
                        <ui-dropdown-menu-group>
                          <ui-dropdown-menu-item>${FolderIcon('text-muted-foreground')}<span>${t.viewProject}</span></ui-dropdown-menu-item>
                          <ui-dropdown-menu-item>${ArrowRightIcon('text-muted-foreground rtl:rotate-180')}<span>${t.shareProject}</span></ui-dropdown-menu-item>
                        </ui-dropdown-menu-group>
                        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                        <ui-dropdown-menu-group>
                          <ui-dropdown-menu-item>${Trash2Icon('text-muted-foreground')}<span>${t.deleteProject}</span></ui-dropdown-menu-item>
                        </ui-dropdown-menu-group>
                      </ui-dropdown-menu-content>
                    </ui-dropdown-menu>
                  </li>
                `)}
                <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                  <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${cn(sidebarMenuButtonClass(), 'text-sidebar-foreground/70')}>
                    ${MoreHorizontalIcon('text-sidebar-foreground/70')}
                    <span>${t.more}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div data-slot="sidebar-footer" data-sidebar="footer" class=${sidebarFooterClass()}>
            <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
              <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                <ui-dropdown-menu>
                  <ui-dropdown-menu-trigger>
                    <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="lg" class=${cn(sidebarMenuButtonClass({ size: 'lg' }), 'aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground')}>
                      ${userAvatar()}
                      ${userText()}
                      ${ChevronsUpDownIcon('ms-auto size-4')}
                    </button>
                  </ui-dropdown-menu-trigger>
                  <ui-dropdown-menu-content class="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side=${side === 'right' ? 'left' : 'right'} align="end">
                    <ui-dropdown-menu-group>
                      <ui-dropdown-menu-label class="p-0 font-normal">
                        <div class="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                          ${userAvatar()}
                          ${userText()}
                        </div>
                      </ui-dropdown-menu-label>
                    </ui-dropdown-menu-group>
                    <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                    <ui-dropdown-menu-group>
                      <ui-dropdown-menu-item>${SparklesIcon()}${t.upgradeToPro}</ui-dropdown-menu-item>
                    </ui-dropdown-menu-group>
                    <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                    <ui-dropdown-menu-group>
                      <ui-dropdown-menu-item>${BadgeCheckIcon()}${t.account}</ui-dropdown-menu-item>
                      <ui-dropdown-menu-item>${CreditCardIcon()}${t.billing}</ui-dropdown-menu-item>
                      <ui-dropdown-menu-item>${BellIcon()}${t.notifications}</ui-dropdown-menu-item>
                    </ui-dropdown-menu-group>
                    <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                    <ui-dropdown-menu-group>
                      <ui-dropdown-menu-item>${LogOutIcon()}${t.logOut}</ui-dropdown-menu-item>
                    </ui-dropdown-menu-group>
                  </ui-dropdown-menu-content>
                </ui-dropdown-menu>
              </li>
            </ul>
          </div>
          <ui-sidebar-rail></ui-sidebar-rail>
        </ui-sidebar>
        <ui-sidebar-inset>
          <header class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div class="flex items-center gap-2 px-4">
              <ui-sidebar-trigger class="-ms-1"></ui-sidebar-trigger>
            </div>
          </header>
        </ui-sidebar-inset>
      </ui-sidebar-provider>
    </example-bind>
  `;
}
