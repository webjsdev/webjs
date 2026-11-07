import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass,
} from '#modules/ui/components/card.ts';
import {
  accordionClass, accordionItemClass, accordionTriggerClass, accordionContentClass,
} from '#modules/ui/components/accordion.ts';
import { ChevronDownIcon, ChevronUpIcon } from '#lib/ui/lucide.ts';

const items = [
  {
    value: 'plans',
    trigger: 'What subscription plans do you offer?',
    content:
      'We offer three subscription tiers: Starter ($9/month), Professional ($29/month), and Enterprise ($99/month). Each plan includes increasing storage limits, API access, priority support, and team collaboration features.',
  },
  {
    value: 'billing',
    trigger: 'How does billing work?',
    content:
      "Billing occurs automatically at the start of each billing cycle. We accept all major credit cards, PayPal, and ACH transfers for enterprise customers. You'll receive an invoice via email after each payment.",
  },
  {
    value: 'cancel',
    trigger: 'How do I cancel my subscription?',
    content:
      'You can cancel your subscription anytime from your account settings. There are no cancellation fees or penalties. Your access will continue until the end of your current billing period.',
  },
];

export default function AccordionCard() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'w-full max-w-sm')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Subscription & Billing</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>
          Common questions about your account, plans, payments and
          cancellations.
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="accordion" class=${accordionClass()}>
          ${items.map((item) => html`
            <details name="accordion-card" data-slot="accordion-item" class=${accordionItemClass()} ?open=${item.value === 'plans'}>
              <summary data-slot="accordion-trigger" class=${accordionTriggerClass()}>
                ${item.trigger}
                ${ChevronDownIcon('pointer-events-none ml-auto size-4 shrink-0 text-muted-foreground group-open:hidden')}
                ${ChevronUpIcon('pointer-events-none ml-auto hidden size-4 shrink-0 text-muted-foreground group-open:inline')}
              </summary>
              <div data-slot="accordion-content" class=${accordionContentClass()}>${item.content}</div>
            </details>
          `)}
        </div>
      </div>
    </div>
  `;
}
