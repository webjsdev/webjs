import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  accordionClass, accordionItemClass, accordionTriggerClass, accordionContentClass, accordionContentInnerClass,
} from '#modules/ui/components/accordion.ts';
import { ChevronDownIcon, ChevronUpIcon } from '#lib/ui/lucide.ts';

const ITEMS = [
  {
    value: 'shipping',
    trigger: 'What are your shipping options?',
    content: 'We offer standard (5-7 days), express (2-3 days), and overnight shipping. Free shipping on international orders.',
  },
  {
    value: 'returns',
    trigger: 'What is your return policy?',
    content: 'Returns accepted within 30 days. Items must be unused and in original packaging. Refunds processed within 5-7 business days.',
  },
  {
    value: 'support',
    trigger: 'How can I contact customer support?',
    content: 'Reach us via email, live chat, or phone. We respond within 24 hours during business days.',
  },
];

export default function AccordionDemo() {
  return html`
    <div data-slot="accordion" class=${cn(accordionClass(), 'max-w-lg')}>
      ${ITEMS.map((item) => html`
        <details name="accordion-demo" data-slot="accordion-item" class=${accordionItemClass()} ?open=${item.value === 'shipping'}>
          <summary data-slot="accordion-trigger" class=${accordionTriggerClass()}>
            ${item.trigger}
            ${ChevronDownIcon('pointer-events-none ml-auto size-4 shrink-0 text-muted-foreground group-open:hidden')}
            ${ChevronUpIcon('pointer-events-none ml-auto hidden size-4 shrink-0 text-muted-foreground group-open:inline')}
          </summary>
          <div data-slot="accordion-content" class=${accordionContentClass()}>
            <div class=${accordionContentInnerClass()}>${item.content}</div>
          </div>
        </details>
      `)}
    </div>
  `;
}
