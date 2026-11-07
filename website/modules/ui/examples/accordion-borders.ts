import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  accordionClass, accordionItemClass, accordionTriggerClass, accordionContentClass,
} from '#modules/ui/components/accordion.ts';
import { ChevronDownIcon, ChevronUpIcon } from '#lib/ui/lucide.ts';

const items = [
  {
    value: 'billing',
    trigger: 'How does billing work?',
    content:
      'We offer monthly and annual subscription plans. Billing is charged at the beginning of each cycle, and you can cancel anytime. All plans include automatic backups, 24/7 support, and unlimited team members.',
  },
  {
    value: 'security',
    trigger: 'Is my data secure?',
    content:
      'Yes. We use end-to-end encryption, SOC 2 Type II compliance, and regular third-party security audits. All data is encrypted at rest and in transit using industry-standard protocols.',
  },
  {
    value: 'integration',
    trigger: 'What integrations do you support?',
    content:
      'We integrate with 500+ popular tools including Slack, Zapier, Salesforce, HubSpot, and more. You can also build custom integrations using our REST API and webhooks.',
  },
];

export default function AccordionBorders() {
  return html`
    <div data-slot="accordion" class=${cn(accordionClass(), 'max-w-lg rounded-lg border')}>
      ${items.map((item) => html`
        <details name="accordion-borders" data-slot="accordion-item" class=${cn(accordionItemClass(), 'border-b px-4 last:border-b-0')} ?open=${item.value === 'billing'}>
          <summary data-slot="accordion-trigger" class=${accordionTriggerClass()}>
            ${item.trigger}
            ${ChevronDownIcon('pointer-events-none ml-auto size-4 shrink-0 text-muted-foreground group-open:hidden')}
            ${ChevronUpIcon('pointer-events-none ml-auto hidden size-4 shrink-0 text-muted-foreground group-open:inline')}
          </summary>
          <div data-slot="accordion-content" class=${accordionContentClass()}>${item.content}</div>
        </details>
      `)}
    </div>
  `;
}
