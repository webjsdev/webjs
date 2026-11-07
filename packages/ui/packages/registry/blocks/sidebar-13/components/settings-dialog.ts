/**
 * The sidebar-13 settings dialog: the kit's `<ui-dialog>` holding a
 * non-collapsible sidebar of settings sections beside the current section's
 * content. A fragment helper; the dialog and the sidebar are the kit's
 * elements. Ported from shadcn/ui's sidebar-13.
 *
 * shadcn's dialog starts open. A modal opens only through `showModal()`, so
 * the small inline script below opens it once the element is ready, and the
 * trigger reopens it after a close. Drop the script for a dialog that waits
 * for its trigger. "Messages & media" is the current section. Point each
 * `href` at a real settings route and mark the current one from your router.
 */
import { html, cspNonce } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  breadcrumbItemClass,
  breadcrumbLinkClass,
  breadcrumbListClass,
  breadcrumbPageClass,
  breadcrumbSeparatorClass,
} from '../../../components/breadcrumb.ts';
import { buttonClass } from '../../../components/button.ts';
import '../../../components/dialog.ts';
import '../../../components/sidebar.ts';
import {
  sidebarContentClass,
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';

const BellIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>`;
const MenuIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path></svg>`;
const HomeIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>`;
const PaintbrushIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.622 17.897-10.68-2.913"></path><path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z"></path><path d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15"></path></svg>`;
const MessageCircleIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path></svg>`;
const GlobeIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>`;
const KeyboardIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 8h.01"></path><path d="M12 12h.01"></path><path d="M14 8h.01"></path><path d="M16 12h.01"></path><path d="M18 8h.01"></path><path d="M6 8h.01"></path><path d="M7 16h10"></path><path d="M8 12h.01"></path><rect width="20" height="16" x="2" y="4" rx="2"></rect></svg>`;
const CheckIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>`;
const VideoIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"></path><rect x="2" y="6" width="14" height="12" rx="2"></rect></svg>`;
const LinkIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
const LockIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
const SettingsIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const ChevronRightIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;

const data: { nav: { name: string; icon: (cls?: string) => TemplateResult }[] } = {
  nav: [
    { name: 'Notifications', icon: BellIcon },
    { name: 'Navigation', icon: MenuIcon },
    { name: 'Home', icon: HomeIcon },
    { name: 'Appearance', icon: PaintbrushIcon },
    { name: 'Messages & media', icon: MessageCircleIcon },
    { name: 'Language & region', icon: GlobeIcon },
    { name: 'Accessibility', icon: KeyboardIcon },
    { name: 'Mark as read', icon: CheckIcon },
    { name: 'Audio & video', icon: VideoIcon },
    { name: 'Connected accounts', icon: LinkIcon },
    { name: 'Privacy & visibility', icon: LockIcon },
    { name: 'Advanced', icon: SettingsIcon },
  ],
};

export function settingsDialog() {
  return html`
    <ui-dialog id="settings-dialog">
      <ui-dialog-trigger>
        <button type="button" data-slot="button" data-size="sm" class=${buttonClass({ size: 'sm' })}>Open Dialog</button>
      </ui-dialog-trigger>
      <ui-dialog-content class="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
        <h2 data-slot="dialog-title" class="sr-only">Settings</h2>
        <p data-slot="dialog-description" class="sr-only">Customize your settings here.</p>
        <ui-sidebar-provider class="[&>[data-slot=sidebar-wrapper]]:items-start">
          <ui-sidebar collapsible="none" class="hidden md:flex">
            <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
              <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
                <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
                  <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
                    ${data.nav.map((item) => {
                      const active = item.name === 'Messages & media';
                      return html`
                        <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                          <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" data-active=${active ? 'true' : 'false'} aria-current=${active ? 'page' : null} class=${sidebarMenuButtonClass()}>
                            ${item.icon()}
                            <span>${item.name}</span>
                          </a>
                        </li>
                      `;
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </ui-sidebar>
          <main class="flex h-[480px] flex-1 flex-col overflow-hidden">
            <header class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div class="flex items-center gap-2 px-4">
                <nav aria-label="breadcrumb" data-slot="breadcrumb">
                  <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
                    <li data-slot="breadcrumb-item" class=${cn(breadcrumbItemClass(), 'hidden md:block')}>
                      <a data-slot="breadcrumb-link" class=${breadcrumbLinkClass()} href="#">Settings</a>
                    </li>
                    <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class=${cn(breadcrumbSeparatorClass(), 'hidden md:block')}>${ChevronRightIcon()}</li>
                    <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
                      <span data-slot="breadcrumb-page" class=${breadcrumbPageClass()} aria-current="page">Messages &amp; media</span>
                    </li>
                  </ol>
                </nav>
              </div>
            </header>
            <div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
              ${Array.from({ length: 10 }, () => html`<div class="aspect-video max-w-3xl rounded-xl bg-muted/50"></div>`)}
            </div>
          </main>
        </ui-sidebar-provider>
      </ui-dialog-content>
    </ui-dialog>
    <script nonce=${cspNonce()}>
      customElements.whenDefined('ui-dialog').then(function () {
        var d = document.getElementById('settings-dialog');
        if (d) d.updateComplete.then(function () { d.open = true; });
      });
    </script>
  `;
}
