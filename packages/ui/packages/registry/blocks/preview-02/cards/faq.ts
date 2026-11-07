/**
 * The preview-02 FAQ card: three tabs of questions, each tab an accordion
 * with its first answer open. A fragment helper; the tabs are the kit's
 * `<ui-tabs>` and each accordion is native `<details>` sharing a `name`, so
 * one answer opens at a time with no JavaScript. Installed at
 * `components/preview-02/faq.ts`. Ported from shadcn/ui's preview-02.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  accordionClass,
  accordionContentClass,
  accordionContentInnerClass,
  accordionItemClass,
  accordionTriggerClass,
} from '../../../components/accordion.ts';
import { buttonClass } from '../../../components/button.ts';
import { cardClass, cardContentClass, cardFooterClass } from '../../../components/card.ts';
import '../../../components/tabs.ts';

const ChevronDownIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>`;

interface Question { q: string; a: string }

const GENERAL_QUESTIONS: Question[] = [
  { q: 'How secure is my financial data with Ledger?', a: 'We use bank-level AES-256 encryption, SOC 2 Type II certified infrastructure, and never store your credentials. All connections use read-only access tokens. We are a SEC registered investment advisor.' },
  { q: 'How do I connect my bank or investment accounts?', a: 'Go to Settings > Linked Accounts and search for your institution. We support over 12,000 banks and brokerages via Plaid and MX.' },
  { q: 'Can I export my data for tax purposes?', a: 'Yes. Navigate to Reports > Tax Export to download a CSV or PDF summary of your transactions, dividends, and capital gains for any tax year.' },
];

const BILLING_QUESTIONS: Question[] = [
  { q: 'What is the difference between Basic and Pro pricing tiers?', a: 'Basic includes budgeting, goal tracking, and up to 3 linked accounts. Pro adds unlimited accounts, dividend tracking, portfolio analysis, and priority support.' },
  { q: 'How do I cancel my subscription?', a: 'Go to Settings > Billing > Manage Plan and click Cancel. Your access continues until the end of your current billing period.' },
  { q: 'Do you offer a free trial?', a: 'Yes. All new accounts start with a 14-day Pro trial. No credit card required.' },
];

const GOALS_QUESTIONS: Question[] = [
  { q: 'How do I set up a custom financial goal?', a: "Click New Goal from the Savings Targets card. Choose a category, set a target amount and date, and we'll calculate the monthly contribution needed." },
  { q: 'Can I track multiple goals at once?', a: 'Yes. Pro accounts can track unlimited goals. Basic accounts support up to 3 active goals.' },
  { q: 'How are monthly contributions calculated?', a: 'We divide the remaining amount by the number of months until your target date, adjusted for your current savings rate and any auto-transfer schedules.' },
];

function questionList(name: string, questions: Question[]) {
  return html`<div data-slot="accordion" class=${accordionClass()}>
    ${questions.map((item, index) => html`
      <details name=${`faq-${name}`} data-slot="accordion-item" class=${accordionItemClass()} ?open=${index === 0}>
        <summary data-slot="accordion-trigger" class=${accordionTriggerClass()}>
          <span>${item.q}</span>
          ${ChevronDownIcon('pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180')}
        </summary>
        <div data-slot="accordion-content" class=${accordionContentClass()}>
          <div class=${accordionContentInnerClass()}>${item.a}</div>
        </div>
      </details>
    `)}
  </div>`;
}

export function faq() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <ui-tabs value="general">
          <ui-tabs-list class="w-full">
            <ui-tabs-trigger value="general" class="flex-1">General</ui-tabs-trigger>
            <ui-tabs-trigger value="billing" class="flex-1">Billing</ui-tabs-trigger>
            <ui-tabs-trigger value="goals" class="flex-1">Goals</ui-tabs-trigger>
          </ui-tabs-list>
          <ui-tabs-content value="general">${questionList('general', GENERAL_QUESTIONS)}</ui-tabs-content>
          <ui-tabs-content value="billing">${questionList('billing', BILLING_QUESTIONS)}</ui-tabs-content>
          <ui-tabs-content value="goals">${questionList('goals', GOALS_QUESTIONS)}</ui-tabs-content>
        </ui-tabs>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'w-full')}>Contact Support</button>
        <a href="#" data-slot="button" data-variant="link" data-size="default" class=${cn(buttonClass({ variant: 'link' }), 'w-full')}>Learn More</a>
      </div>
    </div>
  `;
}
