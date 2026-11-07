/**
 * The preview-02 Payments card: a breadcrumb with an account menu over a list
 * of payment settings links. A fragment helper. Installed by
 * `npx @webjsdev/ui add preview-02` at `components/preview-02/payments.ts`.
 * Ported from shadcn/ui's preview-02.
 */
import { html } from '@webjsdev/core';
import { buttonClass } from '../../../components/button.ts';
import { cardClass, cardContentClass, cardHeaderClass } from '../../../components/card.ts';
import {
  breadcrumbItemClass,
  breadcrumbLinkClass,
  breadcrumbListClass,
  breadcrumbPageClass,
  breadcrumbSeparatorClass,
} from '../../../components/breadcrumb.ts';
import {
  itemClass,
  itemContentClass,
  itemDescriptionClass,
  itemGroupClass,
  itemMediaClass,
  itemTitleClass,
} from '../../../components/item.ts';
import { cn } from '../../../lib/utils.ts';
import '../../../components/dropdown-menu.ts';
import { CalendarIcon, ChevronRightIcon, GaugeIcon, MoreHorizontalIcon, RefreshCwIcon, RepeatIcon } from '../../../lib/icons.ts';

const LINKS = [
  { icon: GaugeIcon, title: 'Change transfer limit', description: 'Adjust how much you can send from your balance.' },
  { icon: CalendarIcon, title: 'Scheduled transfers', description: 'Set up a transfer to send at a later date.' },
  { icon: RepeatIcon, title: 'Direct Debits', description: 'Set up and manage regular payments.' },
  { icon: RefreshCwIcon, title: 'Recurring card payments', description: 'Manage your repeated card transactions.' },
];

const separator = () => html`<li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class=${breadcrumbSeparatorClass()}>${ChevronRightIcon()}</li>`;

export function payments() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'flex flex-col gap-3')}>
        <nav aria-label="breadcrumb" data-slot="breadcrumb">
          <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
            <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
              <a data-slot="breadcrumb-link" href="#" class=${breadcrumbLinkClass()}>Home</a>
            </li>
            ${separator()}
            <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
              <ui-dropdown-menu>
                <ui-dropdown-menu-trigger>
                  <button type="button" data-slot="button" data-variant="ghost" data-size="icon-sm" class=${buttonClass({ variant: 'ghost', size: 'icon-sm' })}>
                    ${MoreHorizontalIcon()}
                    <span class="sr-only">Account options</span>
                  </button>
                </ui-dropdown-menu-trigger>
                <ui-dropdown-menu-content align="start">
                  <ui-dropdown-menu-group>
                    <ui-dropdown-menu-item>Profile</ui-dropdown-menu-item>
                    <ui-dropdown-menu-item>Statements</ui-dropdown-menu-item>
                    <ui-dropdown-menu-item>Documents</ui-dropdown-menu-item>
                  </ui-dropdown-menu-group>
                </ui-dropdown-menu-content>
              </ui-dropdown-menu>
            </li>
            ${separator()}
            <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
              <span data-slot="breadcrumb-page" aria-current="page" class=${breadcrumbPageClass()}>Payments</span>
            </li>
          </ol>
        </nav>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div role="list" data-slot="item-group" class=${itemGroupClass()}>
          ${LINKS.map((link) => html`
            <a href="#" role="listitem" data-slot="item" data-variant="muted" data-size="default" class=${itemClass({ variant: 'muted' })}>
              <div data-slot="item-media" data-variant="icon" class=${itemMediaClass({ variant: 'icon' })}>${link.icon()}</div>
              <div data-slot="item-content" class=${itemContentClass()}>
                <div data-slot="item-title" class=${itemTitleClass()}>${link.title}</div>
                <p data-slot="item-description" class=${itemDescriptionClass()}>${link.description}</p>
              </div>
              ${ChevronRightIcon('size-4 shrink-0 text-muted-foreground')}
            </a>
          `)}
        </div>
      </div>
    </div>
  `;
}
