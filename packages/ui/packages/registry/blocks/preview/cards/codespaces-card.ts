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
import { ContainerIcon, CopyIcon, DownloadIcon, InfoIcon, MonitorIcon, MoreHorizontalIcon, PlusIcon, ServerIcon, ShareIcon, TerminalIcon, ZapIcon } from '../../../lib/icons.ts';

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
