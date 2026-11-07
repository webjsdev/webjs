import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { cardClass, cardContentClass } from '#modules/ui/components/card.ts';
import {
  collapsibleClass, collapsibleTriggerClass, collapsibleContentClass,
} from '#modules/ui/components/collapsible.ts';
import { ChevronDownIcon } from '#lib/ui/lucide.ts';

export default function CollapsibleBasic() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto w-full max-w-sm')}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <details data-slot="collapsible" class=${cn(collapsibleClass(), 'rounded-md open:bg-muted')}>
          <summary data-slot="collapsible-trigger" data-variant="ghost" data-size="default" class=${cn(collapsibleTriggerClass(), buttonClass({ variant: 'ghost' }), 'w-full')}>
            Product details
            ${ChevronDownIcon('ml-auto group-open:rotate-180')}
          </summary>
          <div data-slot="collapsible-content" class=${cn(collapsibleContentClass(), 'flex flex-col items-start gap-2 p-2.5 pt-0 text-sm')}>
            <div>
              This panel can be expanded or collapsed to reveal additional
              content.
            </div>
            <button type="button" data-slot="button" data-variant="default" data-size="xs" class=${buttonClass({ size: 'xs' })}>Learn More</button>
          </div>
        </details>
      </div>
    </div>
  `;
}
