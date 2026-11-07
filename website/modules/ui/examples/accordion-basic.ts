import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  accordionClass, accordionItemClass, accordionTriggerClass, accordionContentClass,
} from '#modules/ui/components/accordion.ts';
import { ChevronDownIcon, ChevronUpIcon } from '#lib/ui/lucide.ts';

const items = [
  {
    value: 'item-1',
    trigger: 'How do I reset my password?',
    content:
      "Click on 'Forgot Password' on the login page, enter your email address, and we'll send you a link to reset your password. The link will expire in 24 hours.",
  },
  {
    value: 'item-2',
    trigger: 'Can I change my subscription plan?',
    content:
      'Yes, you can upgrade or downgrade your plan at any time from your account settings. Changes will be reflected in your next billing cycle.',
  },
  {
    value: 'item-3',
    trigger: 'What payment methods do you accept?',
    content:
      'We accept all major credit cards, PayPal, and bank transfers. All payments are processed securely through our payment partners.',
  },
];

// One shared name makes the items exclusive: opening one closes the others.
export default function AccordionBasic() {
  return html`
    <div data-slot="accordion" class=${cn(accordionClass(), 'max-w-lg')}>
      ${items.map((item) => html`
        <details name="accordion-basic" data-slot="accordion-item" class=${accordionItemClass()} ?open=${item.value === 'item-1'}>
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
