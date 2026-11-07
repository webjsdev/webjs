import { html, svg } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import type { AppSidebarData } from '#modules/ui/blocks/dashboard-01/components/app-sidebar.ts';

/**
 * What /ui/examples/dashboard gives the dashboard-01 block's parts (#1666):
 * shadcn's example draws its sidebar and header with Tabler icons, where the
 * block draws the icon library the app picks, so the example's nav data and
 * its two other icons (the logo and the filled Quick Create circle) live
 * here. The page passes them to appSidebar() and siteHeader().
 */

type Icon = (cls?: string) => TemplateResult;

// Tabler icons (3.34.1, MIT), as @tabler/icons-react renders them.
// An icon is a function, called when it renders: building one at module scope
// would be work the elision analyser counts against every page importing this.
function tabler(name: string, cls: string, body: ReturnType<typeof svg>) {
  return html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'tabler-icon tabler-icon-' + name + (cls ? ' ' + cls : '')}><path stroke="none" d="M0 0h24v24H0z" fill="none"></path>${body}</svg>`;
}

function IconDashboard(cls = '') { return tabler('dashboard', cls, svg`<path d="M12 13m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M13.45 11.55l2.05 -2.05"></path><path d="M6.4 20a9 9 0 1 1 11.2 0z"></path>`); }
function IconListDetails(cls = '') { return tabler('list-details', cls, svg`<path d="M13 5h8"></path><path d="M13 9h5"></path><path d="M13 15h8"></path><path d="M13 19h5"></path><path d="M3 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path><path d="M3 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path>`); }
function IconChartBar(cls = '') { return tabler('chart-bar', cls, svg`<path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path><path d="M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path><path d="M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path><path d="M4 20h14"></path>`); }
function IconFolder(cls = '') { return tabler('folder', cls, svg`<path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2"></path>`); }
function IconUsers(cls = '') { return tabler('users', cls, svg`<path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"></path><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path><path d="M21 21v-2a4 4 0 0 0 -3 -3.85"></path>`); }
function IconSettings(cls = '') { return tabler('settings', cls, svg`<path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"></path><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"></path>`); }
function IconHelp(cls = '') { return tabler('help', cls, svg`<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path><path d="M12 17l0 .01"></path><path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4"></path>`); }
function IconSearch(cls = '') { return tabler('search', cls, svg`<path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"></path><path d="M21 21l-6 -6"></path>`); }
export function IconInnerShadowTop(cls = '') { return tabler('inner-shadow-top', cls, svg`<path d="M5.636 5.636a9 9 0 1 0 12.728 12.728a9 9 0 0 0 -12.728 -12.728z"></path><path d="M16.243 7.757a6 6 0 0 0 -8.486 0"></path>`); }
function IconDatabase(cls = '') { return tabler('database', cls, svg`<path d="M12 6m-8 0a8 3 0 1 0 16 0a8 3 0 1 0 -16 0"></path><path d="M4 6v6a8 3 0 0 0 16 0v-6"></path><path d="M4 12v6a8 3 0 0 0 16 0v-6"></path>`); }
function IconReport(cls = '') { return tabler('report', cls, svg`<path d="M8 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h5.697"></path><path d="M18 14v4h4"></path><path d="M18 11v-4a2 2 0 0 0 -2 -2h-2"></path><path d="M8 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"></path><path d="M18 18m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"></path><path d="M8 11h4"></path><path d="M8 15h3"></path>`); }
function IconFileWord(cls = '') { return tabler('file-word', cls, svg`<path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2"></path><path d="M9 12l1.333 5l1.667 -4l1.667 4l1.333 -5"></path>`); }

/** Tabler's filled circle-plus, the header's Quick Create icon. */
export function IconCirclePlusFilled(cls = '') {
  return html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class=${'tabler-icon tabler-icon-circle-plus-filled' + (cls ? ' ' + cls : '')}><path d="M4.929 4.929a10 10 0 1 1 14.141 14.141a10 10 0 0 1 -14.14 -14.14zm8.071 4.071a1 1 0 1 0 -2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0 -2h-2v-2z"></path></svg>`;
}

export const data: Pick<AppSidebarData, 'navMain' | 'navSecondary' | 'documents'> = {
  navMain: [
    { title: 'Dashboard', url: '#', icon: IconDashboard },
    { title: 'Lifecycle', url: '#', icon: IconListDetails },
    { title: 'Analytics', url: '#', icon: IconChartBar },
    { title: 'Projects', url: '#', icon: IconFolder },
    { title: 'Team', url: '#', icon: IconUsers },
  ],
  navSecondary: [
    { title: 'Settings', url: '#', icon: IconSettings },
    { title: 'Get Help', url: '#', icon: IconHelp },
    { title: 'Search', url: '#', icon: IconSearch },
  ],
  documents: [
    { name: 'Data Library', url: '#', icon: IconDatabase },
    { name: 'Reports', url: '#', icon: IconReport },
    { name: 'Word Assistant', url: '#', icon: IconFileWord },
  ],
};
