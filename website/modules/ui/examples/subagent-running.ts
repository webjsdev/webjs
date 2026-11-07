import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon, CircleCheckIcon, LoaderCircleIcon } from '#lib/ui/lucide.ts';

export default function SubagentRunning() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <details data-slot="trace-collapsible" open class=${traceCollapsibleClass()}>
        <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
          <span data-slot="trace-line" data-status="running" class=${traceLineClass()}>
            <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${LoaderCircleIcon('animate-spin')}</span>
            <span data-slot="trace-title" class=${traceTitleClass()}>Running the research agent</span>
          </span>
          <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform [[open]>summary>&]:rotate-90')}>${ChevronRightIcon()}</span>
        </summary>
        <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
          <div data-slot="trace" class=${traceClass()}>
            <span data-slot="trace-line" class=${traceLineClass()}>
              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleCheckIcon()}</span>
              <span data-slot="trace-title" class=${traceTitleClass()}>Ran grep -rn cacheKey scripts</span>
            </span>
            <span data-slot="trace-line" data-status="running" class=${traceLineClass()}>
              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${LoaderCircleIcon('animate-spin')}</span>
              <span data-slot="trace-title" class=${traceTitleClass()}>Running sed -n 13,15p scripts/optimize-images.ts</span>
            </span>
          </div>
        </div>
      </details>
    </div>
  `;
}
