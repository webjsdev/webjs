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

const MoreHorizontalIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;
const GaugeIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 14 4-4"></path><path d="M3.34 19a10 10 0 1 1 17.32 0"></path></svg>`;
const CalendarIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg>`;
const RepeatIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="m7 22-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path></svg>`;
const RefreshCwIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>`;
const ChevronRightIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;

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
