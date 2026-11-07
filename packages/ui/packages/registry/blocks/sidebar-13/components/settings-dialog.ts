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
import { BellIcon, CheckIcon, ChevronRightIcon, GlobeIcon, HomeIcon, KeyboardIcon, LinkIcon, LockIcon, MenuIcon, MessageCircleIcon, PaintbrushIcon, SettingsIcon, VideoIcon } from '../../../lib/icons.ts';

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
