import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  BellIcon, CreditCardIcon, DownloadIcon, EyeIcon, FileCodeIcon, FileIcon,
  FileTextIcon, FolderIcon, FolderOpenIcon, FolderSearchIcon, HelpCircleIcon,
  KeyboardIcon, LanguagesIcon, LayoutIcon, LogOutIcon, MailIcon, MonitorIcon,
  MoonIcon, MoreHorizontalIcon, PaletteIcon, SaveIcon, SettingsIcon, ShieldIcon,
  SunIcon, UserIcon,
} from '#lib/ui/lucide.ts';

export default function DropdownMenuComplex() {
  return html`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Complex Menu</button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content class="w-44">
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-label>File</ui-dropdown-menu-label>
          <ui-dropdown-menu-item>
            ${FileIcon()}
            New File
            <ui-dropdown-menu-shortcut>⌘N</ui-dropdown-menu-shortcut>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${FolderIcon()}
            New Folder
            <ui-dropdown-menu-shortcut>⇧⌘N</ui-dropdown-menu-shortcut>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-sub>
            <ui-dropdown-menu-sub-trigger>
              ${FolderOpenIcon()}
              Open Recent
            </ui-dropdown-menu-sub-trigger>
            <ui-dropdown-menu-sub-content>
              <ui-dropdown-menu-group>
                <ui-dropdown-menu-label>Recent Projects</ui-dropdown-menu-label>
                <ui-dropdown-menu-item>
                  ${FileCodeIcon()}
                  Project Alpha
                </ui-dropdown-menu-item>
                <ui-dropdown-menu-item>
                  ${FileCodeIcon()}
                  Project Beta
                </ui-dropdown-menu-item>
                <ui-dropdown-menu-sub>
                  <ui-dropdown-menu-sub-trigger>
                    ${MoreHorizontalIcon()}
                    More Projects
                  </ui-dropdown-menu-sub-trigger>
                  <ui-dropdown-menu-sub-content>
                    <ui-dropdown-menu-item>
                      ${FileCodeIcon()}
                      Project Gamma
                    </ui-dropdown-menu-item>
                    <ui-dropdown-menu-item>
                      ${FileCodeIcon()}
                      Project Delta
                    </ui-dropdown-menu-item>
                  </ui-dropdown-menu-sub-content>
                </ui-dropdown-menu-sub>
              </ui-dropdown-menu-group>
              <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
              <ui-dropdown-menu-group>
                <ui-dropdown-menu-item>
                  ${FolderSearchIcon()}
                  Browse...
                </ui-dropdown-menu-item>
              </ui-dropdown-menu-group>
            </ui-dropdown-menu-sub-content>
          </ui-dropdown-menu-sub>
          <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
          <ui-dropdown-menu-item>
            ${SaveIcon()}
            Save
            <ui-dropdown-menu-shortcut>⌘S</ui-dropdown-menu-shortcut>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${DownloadIcon()}
            Export
            <ui-dropdown-menu-shortcut>⇧⌘E</ui-dropdown-menu-shortcut>
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-label>View</ui-dropdown-menu-label>
          <ui-dropdown-menu-item type="checkbox" value="sidebar" checked>
            ${EyeIcon()}
            Show Sidebar
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item type="checkbox" value="status-bar">
            ${LayoutIcon()}
            Show Status Bar
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-sub>
            <ui-dropdown-menu-sub-trigger>
              ${PaletteIcon()}
              Theme
            </ui-dropdown-menu-sub-trigger>
            <ui-dropdown-menu-sub-content>
              <ui-dropdown-menu-group>
                <ui-dropdown-menu-label>Appearance</ui-dropdown-menu-label>
                <ui-dropdown-menu-group aria-label="Appearance">
                  <ui-dropdown-menu-item type="radio" value="light" checked>
                    ${SunIcon()}
                    Light
                  </ui-dropdown-menu-item>
                  <ui-dropdown-menu-item type="radio" value="dark">
                    ${MoonIcon()}
                    Dark
                  </ui-dropdown-menu-item>
                  <ui-dropdown-menu-item type="radio" value="system">
                    ${MonitorIcon()}
                    System
                  </ui-dropdown-menu-item>
                </ui-dropdown-menu-group>
              </ui-dropdown-menu-group>
            </ui-dropdown-menu-sub-content>
          </ui-dropdown-menu-sub>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-label>Account</ui-dropdown-menu-label>
          <ui-dropdown-menu-item>
            ${UserIcon()}
            Profile
            <ui-dropdown-menu-shortcut>⇧⌘P</ui-dropdown-menu-shortcut>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${CreditCardIcon()}
            Billing
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-sub>
            <ui-dropdown-menu-sub-trigger>
              ${SettingsIcon()}
              Settings
            </ui-dropdown-menu-sub-trigger>
            <ui-dropdown-menu-sub-content>
              <ui-dropdown-menu-group>
                <ui-dropdown-menu-label>Preferences</ui-dropdown-menu-label>
                <ui-dropdown-menu-item>
                  ${KeyboardIcon()}
                  Keyboard Shortcuts
                </ui-dropdown-menu-item>
                <ui-dropdown-menu-item>
                  ${LanguagesIcon()}
                  Language
                </ui-dropdown-menu-item>
                <ui-dropdown-menu-sub>
                  <ui-dropdown-menu-sub-trigger>
                    ${BellIcon()}
                    Notifications
                  </ui-dropdown-menu-sub-trigger>
                  <ui-dropdown-menu-sub-content>
                    <ui-dropdown-menu-group>
                      <ui-dropdown-menu-label>Notification Types</ui-dropdown-menu-label>
                      <ui-dropdown-menu-item type="checkbox" value="push" checked>
                        ${BellIcon()}
                        Push Notifications
                      </ui-dropdown-menu-item>
                      <ui-dropdown-menu-item type="checkbox" value="email" checked>
                        ${MailIcon()}
                        Email Notifications
                      </ui-dropdown-menu-item>
                    </ui-dropdown-menu-group>
                  </ui-dropdown-menu-sub-content>
                </ui-dropdown-menu-sub>
              </ui-dropdown-menu-group>
              <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
              <ui-dropdown-menu-group>
                <ui-dropdown-menu-item>
                  ${ShieldIcon()}
                  Privacy &amp; Security
                </ui-dropdown-menu-item>
              </ui-dropdown-menu-group>
            </ui-dropdown-menu-sub-content>
          </ui-dropdown-menu-sub>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item>
            ${HelpCircleIcon()}
            Help &amp; Support
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${FileTextIcon()}
            Documentation
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item variant="destructive">
            ${LogOutIcon()}
            Sign Out
            <ui-dropdown-menu-shortcut>⇧⌘Q</ui-dropdown-menu-shortcut>
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
