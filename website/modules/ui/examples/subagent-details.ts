import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass, traceDescriptionClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon, CircleCheckIcon } from '#lib/ui/lucide.ts';

export default function SubagentDetails() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <details data-slot="trace-collapsible" open class=${traceCollapsibleClass()}>
        <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
          <span data-slot="trace-line" class=${traceLineClass()}>
            <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleCheckIcon()}</span>
            <span data-slot="trace-title" class=${traceTitleClass()}>Ran the research agent</span>
            <span data-slot="trace-description" class=${traceDescriptionClass()}>48s</span>
          </span>
          <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform [[open]>summary>&]:rotate-90')}>${ChevronRightIcon()}</span>
        </summary>
        <div data-slot="trace-collapsible-content" class=${cn(traceCollapsibleContentClass(), 'flex flex-col gap-3')}>
          <div class="flex flex-wrap gap-1.5">
            <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>anthropic/claude-sonnet-4.5</span>
            <span data-slot="badge" data-variant="outline" class=${cn(badgeClass({ variant: 'outline' }), 'font-mono')}>runCommand</span>
          </div>
          <p>Find out why image optimization reruns on every deploy.</p>
          <div data-slot="trace" class=${traceClass()}>
            <span data-slot="trace-line" class=${traceLineClass()}>
              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleCheckIcon()}</span>
              <span data-slot="trace-title" class=${traceTitleClass()}>Ran grep -rn cacheKey scripts</span>
            </span>
            <span data-slot="trace-line" class=${traceLineClass()}>
              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleCheckIcon()}</span>
              <span data-slot="trace-title" class=${traceTitleClass()}>Ran sed -n 13,15p scripts/optimize-images.ts</span>
            </span>
          </div>
          <p>The cache is keyed on the commit SHA.</p>
        </div>
      </details>
    </div>
  `;
}
