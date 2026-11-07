/**
 * The preview block's agent activation card: what the agent does, as a
 * checked list, a trial-credit notice, and cancel and enable buttons. A
 * fragment helper, rendered by the server. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/activate-agent-dialog.ts`.
 * Ported from shadcn/ui's preview block.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { alertClass, alertDescriptionClass } from '../../../components/alert.ts';
import { badgeClass } from '../../../components/badge.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import {
  itemClass,
  itemContentClass,
  itemGroupClass,
  itemMediaClass,
  itemTitleClass,
} from '../../../components/item.ts';
import { CheckCircle2Icon } from '../../../lib/icons.ts';

// What the agent does, one line each.
const agentFeatures = () => [
  html`<strong>Code reviews</strong> with full codebase context to catch <strong>hard-to-find</strong> bugs.`,
  html`<strong>Code suggestions</strong> validated in sandboxes before you merge.`,
  html`<strong>Root-cause analysis</strong> for production issues with deployment context.
    <span data-slot="badge" data-variant="secondary" class=${cn(badgeClass({ variant: 'secondary' }), 'bg-chart-1 text-chart-5')}>Requires Observability Plus</span>`,
];

export function activateAgentDialog() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Ship faster &amp; safer with Vercel Agent</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>
          Your use is subject to Vercel's
          <a href="#">Public Beta Agreement</a> and
          <a href="#">AI Product Terms</a>.
        </div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        <div role="list" data-slot="item-group" class=${cn(itemGroupClass(), 'gap-0')}>
          ${agentFeatures().map((feature) => html`
            <div role="listitem" data-slot="item" data-variant="default" data-size="xs" class=${cn(itemClass({ size: 'xs' }), 'px-0')}>
              <div data-slot="item-media" data-variant="icon" class=${cn(itemMediaClass({ variant: 'icon' }), 'self-start')}>
                ${CheckCircle2Icon('size-5 fill-primary text-primary-foreground')}
              </div>
              <div data-slot="item-content" class=${itemContentClass()}>
                <div data-slot="item-title" class=${cn(itemTitleClass(), 'inline leading-relaxed font-normal text-muted-foreground *:[strong]:font-medium *:[strong]:text-foreground')}>
                  ${feature}
                </div>
              </div>
            </div>
          `)}
        </div>
        <div role="status" data-slot="alert" data-variant="default" class=${alertClass()}>
          <div data-slot="alert-description" class=${alertDescriptionClass()}>
            Pro teams get $100 in Vercel Agent trial credit for 2 weeks after
            activation.
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'justify-end gap-2')}>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'style-sera:hidden')}>Cancel</button>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'style-sera:w-full')}>Enable with $100 credits</button>
      </div>
    </div>
  `;
}
