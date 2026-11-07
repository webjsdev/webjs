import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass, traceDescriptionClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon, CircleCheckIcon } from '#lib/ui/lucide.ts';

export default function ReasoningDuration() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <details data-slot="trace-collapsible" class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
        <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
          <span data-slot="trace-line" class=${traceLineClass()}>
            <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleCheckIcon()}</span>
            <span data-slot="trace-title" class=${traceTitleClass()}>Thought</span>
            <span data-slot="trace-description" class=${traceDescriptionClass()}>12s</span>
          </span>
          <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
        </summary>
        <div data-slot="trace-collapsible-content" class=${cn(traceCollapsibleContentClass(), 'whitespace-pre-wrap')}>
          The build log shows install and compile finish in under a minute.
          Image optimization takes almost four, and it reruns on every deploy
          because the cache key includes the commit hash.
        </div>
      </details>
    </div>
  `;
}
