/**
 * The preview block's codespaces card, after GitHub's "Code" menu: a
 * Codespaces tab with an empty state and a Local tab with the clone URLs.
 * A fragment helper, rendered by the server, with the kit's `<ui-tabs>`,
 * `<ui-tooltip>` and `<ui-dropdown-menu>`. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/codespaces-card.ts`.
 * Ported from shadcn/ui's preview block.
 *
 * shadcn shows a spinner on "Create Codespace" for two seconds after a click.
 * Here the button is shown at rest; give it a server action to run.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import { cardClass, cardContentClass } from '../../../components/card.ts';
import '../../../components/dropdown-menu.ts';
import {
  emptyClass,
  emptyContentClass,
  emptyDescriptionClass,
  emptyHeaderClass,
  emptyMediaClass,
  emptyTitleClass,
} from '../../../components/empty.ts';
import { fieldClass, fieldDescriptionClass, fieldLabelClass } from '../../../components/field.ts';
import {
  inputGroupAddonClass,
  inputGroupButtonClass,
  inputGroupClass,
  inputGroupInputClass,
} from '../../../components/input-group.ts';
import {
  itemActionsClass,
  itemClass,
  itemContentClass,
  itemDescriptionClass,
  itemTitleClass,
} from '../../../components/item.ts';
import { separatorClass } from '../../../components/separator.ts';
import '../../../components/tabs.ts';
import '../../../components/tooltip.ts';

const PlusIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;
const MoreHorizontalIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;
const ContainerIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z"></path><path d="M10 21.9V14L2.1 9.1"></path><path d="m10 14 11.9-6.9"></path><path d="M14 19.8v-8.1"></path><path d="M18 17.5V9.4"></path></svg>`;
const ZapIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path></svg>`;
const ServerIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"></rect><rect width="20" height="8" x="2" y="14" rx="2" ry="2"></rect><line x1="6" x2="6.01" y1="6" y2="6"></line><line x1="6" x2="6.01" y1="18" y2="18"></line></svg>`;
const ShareIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v13"></path><path d="m16 6-4-4-4 4"></path><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path></svg>`;
const InfoIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`;
const TerminalIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19h8"></path><path d="m4 17 6-6-6-6"></path></svg>`;
const CopyIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
const MonitorIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line></svg>`;
const DownloadIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path></svg>`;

const separator = () => html`<div data-slot="separator" data-orientation="horizontal" role="none" class=${cn(separatorClass(), '-mx-2 my-2 w-auto!')}></div>`;

const CLONE_URLS = [
  { value: 'https', id: 'codespaces-https-url', label: 'HTTPS URL', url: 'https://github.com/shadcn-ui/ui.git', hint: html`Clone using the web URL.` },
  { value: 'ssh', id: 'codespaces-ssh-url', label: 'SSH URL', url: 'git@github.com:shadcn-ui/ui.git', hint: html`Use a password-protected SSH key.` },
  { value: 'cli', id: 'codespaces-cli-command', label: 'CLI Command', url: 'gh repo clone shadcn-ui/ui', hint: html`Work fast with our official CLI. <a href="#learn-more">Learn more</a>` },
];

export function codespacesCard() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <ui-tabs value="codespaces">
          <ui-tabs-list class="w-full">
            <ui-tabs-trigger value="codespaces">Codespaces</ui-tabs-trigger>
            <ui-tabs-trigger value="local">Local</ui-tabs-trigger>
          </ui-tabs-list>
          <ui-tabs-content value="codespaces">
            <div data-slot="item" data-variant="default" data-size="sm" class=${cn(itemClass({ size: 'sm' }), 'px-1 pt-2')}>
              <div data-slot="item-content" class=${itemContentClass()}>
                <div data-slot="item-title" class=${itemTitleClass()}>Codespaces</div>
                <p data-slot="item-description" class=${itemDescriptionClass()}>Your workspaces in the cloud</p>
              </div>
              <div data-slot="item-actions" class=${itemActionsClass()}>
                <ui-tooltip>
                  <ui-tooltip-trigger>
                    <button type="button" aria-label="Create a codespace on main" data-slot="button" data-variant="ghost" data-size="icon-sm" class=${buttonClass({ variant: 'ghost', size: 'icon-sm' })}>
                      ${PlusIcon()}
                    </button>
                  </ui-tooltip-trigger>
                  <ui-tooltip-content side="bottom">Create a codespace on main</ui-tooltip-content>
                </ui-tooltip>
                <ui-dropdown-menu>
                  <ui-dropdown-menu-trigger>
                    <button type="button" aria-label="Codespace options" data-slot="button" data-variant="ghost" data-size="icon-sm" class=${buttonClass({ variant: 'ghost', size: 'icon-sm' })}>
                      ${MoreHorizontalIcon()}
                    </button>
                  </ui-dropdown-menu-trigger>
                  <ui-dropdown-menu-content align="end" class="w-56">
                    <ui-dropdown-menu-group>
                      <ui-dropdown-menu-item>${PlusIcon()}New with options...</ui-dropdown-menu-item>
                      <ui-dropdown-menu-item>${ContainerIcon()}Configure container</ui-dropdown-menu-item>
                      <ui-dropdown-menu-item>${ZapIcon()}Set up prebuilds</ui-dropdown-menu-item>
                    </ui-dropdown-menu-group>
                    <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                    <ui-dropdown-menu-group>
                      <ui-dropdown-menu-item>${ServerIcon()}Manage codespaces</ui-dropdown-menu-item>
                      <ui-dropdown-menu-item>${ShareIcon()}Share deep link</ui-dropdown-menu-item>
                      <ui-dropdown-menu-item>${InfoIcon()}What are codespaces?</ui-dropdown-menu-item>
                    </ui-dropdown-menu-group>
                  </ui-dropdown-menu-content>
                </ui-dropdown-menu>
              </div>
            </div>
            ${separator()}
            <div data-slot="empty" class=${cn(emptyClass(), 'p-4')}>
              <div data-slot="empty-header" class=${emptyHeaderClass()}>
                <div data-slot="empty-icon" data-variant="icon" class=${emptyMediaClass({ variant: 'icon' })}>${ServerIcon()}</div>
                <div data-slot="empty-title" class=${emptyTitleClass()}>No codespaces</div>
                <div data-slot="empty-description" class=${emptyDescriptionClass()}>
                  You don't have any codespaces with this repository
                  checked out
                </div>
              </div>
              <div data-slot="empty-content" class=${emptyContentClass()}>
                <button type="button" data-slot="button" data-variant="default" data-size="sm" class=${buttonClass({ size: 'sm' })}>Create Codespace</button>
                <a href="#learn-more" class="text-xs text-muted-foreground underline underline-offset-4">Learn more about codespaces</a>
              </div>
            </div>
            ${separator()}
            <div class="p-1.5 text-xs text-muted-foreground">
              Codespace usage for this repository is paid for by
              <span class="font-medium">shadcn</span>.
            </div>
          </ui-tabs-content>
          <ui-tabs-content value="local">
            <div data-slot="item" data-variant="default" data-size="sm" class=${cn(itemClass({ size: 'sm' }), 'hidden p-0')}>
              <div data-slot="item-content" class=${itemContentClass()}>
                <div data-slot="item-title" class=${cn(itemTitleClass(), 'gap-2')}>${TerminalIcon('size-4')}Clone</div>
              </div>
              <div data-slot="item-actions" class=${itemActionsClass()}>
                <ui-tooltip>
                  <ui-tooltip-trigger>
                    <button type="button" aria-label="Which remote URL should I use?" data-slot="button" data-variant="ghost" data-size="icon" class=${buttonClass({ variant: 'ghost', size: 'icon' })}>
                      ${InfoIcon()}
                    </button>
                  </ui-tooltip-trigger>
                  <ui-tooltip-content side="left">Which remote URL should I use?</ui-tooltip-content>
                </ui-tooltip>
              </div>
            </div>
            <ui-tabs value="https">
              <ui-tabs-list variant="underline" class="w-full justify-start border-b **:[button]:flex-0">
                <ui-tabs-trigger value="https">HTTPS</ui-tabs-trigger>
                <ui-tabs-trigger value="ssh">SSH</ui-tabs-trigger>
                <ui-tabs-trigger value="cli">GitHub CLI</ui-tabs-trigger>
              </ui-tabs-list>
              <div class="rounded-md border bg-muted/30 p-2">
                ${CLONE_URLS.map((c) => html`
                  <ui-tabs-content value=${c.value}>
                    <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'gap-2')}>
                      <label data-slot="field-label" for=${c.id} class=${cn(fieldLabelClass(), 'sr-only')}>${c.label}</label>
                      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
                        <div data-slot="input-group-addon" data-align="inline-end" role="group" class=${inputGroupAddonClass({ align: 'inline-end' })}>
                          <button type="button" aria-label="Copy" data-slot="button" data-variant="ghost" data-size="icon-xs" class=${inputGroupButtonClass({ size: 'icon-xs' })}>${CopyIcon()}</button>
                        </div>
                        <input data-slot="input-group-control" id=${c.id} value=${c.url} readonly class=${inputGroupInputClass()}>
                      </div>
                      <p data-slot="field-description" class=${fieldDescriptionClass()}>${c.hint}</p>
                    </div>
                  </ui-tabs-content>
                `)}
              </div>
            </ui-tabs>
            ${separator()}
            <div class="flex flex-col">
              <button type="button" data-slot="button" data-variant="ghost" data-size="sm" class=${cn(buttonClass({ variant: 'ghost', size: 'sm' }), 'justify-start gap-1.5')}>
                ${MonitorIcon()}Open with GitHub Desktop
              </button>
              <button type="button" data-slot="button" data-variant="ghost" data-size="sm" class=${cn(buttonClass({ variant: 'ghost', size: 'sm' }), 'justify-start gap-1.5')}>
                ${DownloadIcon()}Download ZIP
              </button>
            </div>
          </ui-tabs-content>
        </ui-tabs>
      </div>
    </div>
  `;
}
