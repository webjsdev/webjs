import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  accordionClass, accordionItemClass, accordionTriggerClass, accordionContentClass,
} from '#modules/ui/components/accordion.ts';
import { ChevronDownIcon, ChevronUpIcon } from '#lib/ui/lucide.ts';

const items = [
  {
    value: 'notifications',
    trigger: 'Notification Settings',
    content:
      'Manage how you receive notifications. You can enable email alerts for updates or push notifications for mobile devices.',
  },
  {
    value: 'privacy',
    trigger: 'Privacy & Security',
    content:
      'Control your privacy settings and security preferences. Enable two-factor authentication, manage connected devices, review active sessions, and configure data sharing preferences. You can also download your data or delete your account.',
  },
  {
    value: 'billing',
    trigger: 'Billing & Subscription',
    content:
      'View your current plan, payment history, and upcoming invoices. Update your payment method, change your subscription tier, or cancel your subscription.',
  },
];

// No name on the items, so each one opens and closes on its own.
export default function AccordionMultiple() {
  return html`
    <div data-slot="accordion" class=${cn(accordionClass(), 'max-w-lg')}>
      ${items.map((item) => html`
        <details data-slot="accordion-item" class=${accordionItemClass()} ?open=${item.value === 'notifications'}>
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
