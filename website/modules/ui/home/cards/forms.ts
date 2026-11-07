import { html, svg } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';
import {
  breadcrumbListClass, breadcrumbItemClass, breadcrumbLinkClass,
  breadcrumbPageClass, breadcrumbSeparatorClass,
} from '#modules/ui/components/breadcrumb.ts';
import * as I from '#lib/ui/hugeicons.ts';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, ItemGroup, Item, ItemContent, ItemTitle, ItemDescription, ItemMedia,
  FieldGroup, Field, FieldLabel, FieldDescription, Input, Textarea, Progress,
} from '../parts.ts';
import { dismissButton } from './finance.ts';

/**
 * shadcn's form and navigation cards from apps/v4/app/(app)/(root)/cards/:
 * new-milestone, payout-threshold, account-access, qr-connect and payments.
 */

export function newMilestone() {
  return Card('', html`
    ${CardHeader('', html`
      ${CardTitle('', 'Set a new milestone')}
      ${CardDescription('', "Define your financial target and we'll help you pace your savings.")}
    `)}
    ${CardContent('', FieldGroup(html`
      ${Field('', html`${FieldLabel({ for: 'goal-name' }, 'Goal Name')}${Input({ id: 'goal-name', placeholder: 'e.g. New Car, Home Downpayment' })}`)}
      <div class="grid grid-cols-2 gap-3">
        ${Field('', html`${FieldLabel({ for: 'target-amount' }, 'Target Amount')}${Input({ id: 'target-amount', value: '$15,000' })}`)}
        ${Field('', html`${FieldLabel({ for: 'target-date' }, 'Target Date')}${Input({ id: 'target-date', value: 'Dec 2025' })}`)}
      </div>
    `))}
    ${CardFooter('flex-col gap-2', html`
      ${Button({ cls: 'w-full' }, 'Create Goal')}
      ${Button({ variant: 'outline', cls: 'w-full' }, 'Cancel')}
    `)}
  `);
}

const CURRENCIES = [
  { label: 'USD, United States Dollar', value: 'usd' },
  { label: 'EUR, Euro', value: 'eur' },
  { label: 'GBP, British Pound', value: 'gbp' },
  { label: 'JPY, Japanese Yen', value: 'jpy' },
];

export function payoutThreshold() {
  return Card('', html`
    ${CardHeader('', html`
      ${CardTitle('', 'Payout Threshold')}
      ${CardDescription('', 'Set the minimum balance required before a payout is triggered.')}
      ${dismissButton('Dismiss payout threshold')}
    `)}
    ${CardContent('', FieldGroup(html`
      ${Field('', html`
        ${FieldLabel({ for: 'preferred-currency' }, 'Preferred Currency')}
        <ui-select class="w-full">
          <select id="preferred-currency" class=${cn(selectTriggerClass(), 'w-full')}>
            <optgroup>
              ${CURRENCIES.map((c) => html`<option value=${c.value} selected=${c.value === 'usd'}>${c.label}</option>`)}
            </optgroup>
          </select>
        </ui-select>`)}
      ${Field('', html`
        <div class="flex items-baseline justify-between">
          ${FieldLabel({ id: 'min-payout-label' }, 'Minimum Payout Amount')}
          <span class="text-2xl font-semibold tabular-nums">$2500.00</span>
        </div>
        ${Progress(25, { labelledby: 'min-payout-label', valuetext: '$2,500 of $10,000' })}
        <div class="flex items-center justify-between">
          ${FieldDescription('$50 (MIN)')}
          ${FieldDescription('$10,000 (MAX)')}
        </div>`)}
      ${Field('', html`${FieldLabel({ for: 'payout-notes' }, 'Notes')}${Textarea({ id: 'payout-notes', placeholder: 'Add any notes for this payout configuration...', cls: 'min-h-[100px]' })}`)}
    `))}
    ${CardFooter('', Button({ cls: 'w-full' }, 'Save Threshold'))}
  `);
}

export function accountAccess() {
  return Card('', html`
    ${CardHeader('', html`
      ${CardTitle('', 'Account Access')}
      ${CardDescription('', 'Update your credentials or re-authenticate.')}
    `)}
    ${CardContent('', FieldGroup(html`
      ${Field('', html`${FieldLabel({ for: 'email-address' }, 'Email Address')}${Input({ id: 'email-address', type: 'email', placeholder: 'artist@studio.inc' })}`)}
      ${Field('', html`
        <div class="flex items-center justify-between">
          ${FieldLabel({ for: 'current-password' }, 'Current Password')}
          <a href="#" class="text-xs font-medium tracking-wider text-muted-foreground no-underline uppercase hover:text-foreground">Forgot?</a>
        </div>
        ${Input({ id: 'current-password', type: 'password', placeholder: '••••••••••••••••••••••••' })}`)}
    `))}
    ${CardFooter('flex-col gap-4', html`
      ${Button({ cls: 'w-full' }, html`${I.SquareLock02Icon('', 2)}Update Security`)}
      ${Item({ variant: 'muted', href: '#' }, html`
        ${ItemMedia(I.AlertCircleIcon('text-destructive', 2))}
        ${ItemContent('', html`${ItemTitle('Danger Zone')}${ItemDescription('line-clamp-1', 'Archive account and remove catalog')}`)}
        ${I.ArrowRight01Icon('size-4', 2)}
      `)}
    `)}
  `);
}

const QR = [
  '111111100101101111111', '100000101001001000001', '101110101111101011101',
  '101110100100001011101', '101110101010101011101', '100000100111001000001',
  '111111101010101111111', '000000001101000000000', '101011111001111010110',
  '010100001110010101001', '111010111011101111010', '001101000101000010101',
  '110111101111010111011', '000000001001010001010', '111111101101111101001',
  '100000100010001001111', '101110101011101110100', '101110100110100010011',
  '101110101000111101110', '100000101101000011001', '111111101011101101111',
];

export function qrConnect() {
  const cells = QR.flatMap((row, y) => [...row].map((c, x) => (c === '1' ? svg`<rect x=${x} y=${y} width="1" height="1"></rect>` : '')));
  return Card('', html`
    ${CardContent('flex justify-center pt-6', html`
      <div class="rounded-xl border bg-white p-4">
        <svg viewBox="0 0 21 21" class="size-40 text-black" role="img" aria-label="Connect device QR code" shape-rendering="crispEdges">
          <rect width="21" height="21" fill="white"></rect>
          ${cells}
        </svg>
      </div>
    `)}
    ${CardHeader('text-center', html`
      ${CardTitle('', 'Scan to connect your mobile device')}
      ${CardDescription('text-balance', 'Open the Ledger mobile app and scan this code to link your device.')}
    `)}
  `);
}

const chevron = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;

function paymentLink(icon: unknown, title: string, description: string) {
  return html`<div role="listitem" class="w-full">${Item({ variant: 'muted', href: '#' }, html`
    ${ItemMedia(icon)}
    ${ItemContent('', html`${ItemTitle(title)}${ItemDescription('', description)}`)}
    ${I.ArrowRight01Icon('size-4 shrink-0 text-muted-foreground', 2)}
  `)}</div>`;
}

export function payments() {
  const sep = html`<li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class=${breadcrumbSeparatorClass()}>${chevron}</li>`;
  return Card('', html`
    ${CardHeader('flex flex-col gap-3', html`
      <nav aria-label="breadcrumb" data-slot="breadcrumb">
        <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
          <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}><a data-slot="breadcrumb-link" href="#" class=${breadcrumbLinkClass()}>Home</a></li>
          ${sep}
          <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
            <ui-dropdown-menu>
              <ui-dropdown-menu-trigger>
                <button type="button" data-slot="button" aria-label="Account options" class=${buttonClass({ variant: 'ghost', size: 'icon-sm' })}>${I.MoreHorizontalCircle01Icon('', 2)}</button>
              </ui-dropdown-menu-trigger>
              <ui-dropdown-menu-content align="start">
                <ui-dropdown-menu-item>Profile</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>Statements</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>Documents</ui-dropdown-menu-item>
              </ui-dropdown-menu-content>
            </ui-dropdown-menu>
          </li>
          ${sep}
          <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}><span data-slot="breadcrumb-page" aria-current="page" class=${breadcrumbPageClass()}>Payments</span></li>
        </ol>
      </nav>
    `)}
    ${CardContent('', ItemGroup('', html`
      ${paymentLink(I.Settings01Icon('', 2), 'Change transfer limit', 'Adjust how much you can send from your balance.')}
      ${paymentLink(I.Calendar03Icon('', 2), 'Scheduled transfers', 'Set up a transfer to send at a later date.')}
      ${paymentLink(I.RefreshIcon('', 2), 'Recurring card payments', 'Manage your repeated card transactions.')}
    `))}
  `);
}
