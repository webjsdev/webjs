import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  accordionClass, accordionItemClass, accordionTriggerClass, accordionContentClass,
} from '#modules/ui/components/accordion.ts';
import { ChevronDownIcon, ChevronUpIcon } from '#lib/ui/lucide.ts';

const chevrons = () => html`
  ${ChevronDownIcon('pointer-events-none ml-auto size-4 shrink-0 text-muted-foreground group-open:hidden')}
  ${ChevronUpIcon('pointer-events-none ml-auto hidden size-4 shrink-0 text-muted-foreground group-open:inline')}
`;

// A <details> has no disabled attribute: the disabled trigger classes grey
// the item out, and inert takes it out of the tab order and the click path.
export default function AccordionDisabled() {
  return html`
    <div data-slot="accordion" class=${cn(accordionClass(), 'w-full')}>
      <details name="accordion-disabled" data-slot="accordion-item" class=${accordionItemClass()}>
        <summary data-slot="accordion-trigger" class=${accordionTriggerClass()}>
          Can I access my account history?
          ${chevrons()}
        </summary>
        <div data-slot="accordion-content" class=${accordionContentClass()}>
          Yes, you can view your complete account history including all
          transactions, plan changes, and support tickets in the Account History
          section of your dashboard.
        </div>
      </details>
      <details name="accordion-disabled" data-slot="accordion-item" data-disabled inert class=${accordionItemClass()}>
        <summary data-slot="accordion-trigger" class=${accordionTriggerClass({ disabled: true })}>
          Premium feature information
          ${chevrons()}
        </summary>
        <div data-slot="accordion-content" class=${accordionContentClass()}>
          This section contains information about premium features. Upgrade your
          plan to access this content.
        </div>
      </details>
      <details name="accordion-disabled" data-slot="accordion-item" class=${accordionItemClass()}>
        <summary data-slot="accordion-trigger" class=${accordionTriggerClass()}>
          How do I update my email address?
          ${chevrons()}
        </summary>
        <div data-slot="accordion-content" class=${accordionContentClass()}>
          You can update your email address in your account settings.
          You'll receive a verification email at your new address to
          confirm the change.
        </div>
      </details>
    </div>
  `;
}
