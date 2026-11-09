import { html, nothing } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass, traceDescriptionClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import {
  ChevronRightIcon, CircleCheckIcon, CircleIcon, RouteIcon,
} from '#lib/ui/lucide.ts';

const steps = [
  'Add a dark variant to the theme tokens',
  'Read the theme from a cookie on the server',
  'Add a toggle to the settings page',
  'Check contrast on the charts',
];

export default function PlanDescription() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <details data-slot="trace-collapsible" open class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
        <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
          <span data-slot="trace-line" class=${traceLineClass()}>
            <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${RouteIcon()}</span>
            <span data-slot="trace-title" class=${traceTitleClass()}>Plan: add dark mode</span>
            <span data-slot="trace-description" class=${traceDescriptionClass()}>1 of ${steps.length} done</span>
          </span>
          <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
        </summary>
        <div data-slot="trace-collapsible-content" class=${cn(traceCollapsibleContentClass(), 'flex flex-col gap-3')}>
          <p>
            Store the theme in a cookie so the server renders the right one and
            the page does not flash on load.
          </p>
          <div data-slot="trace" class=${traceClass()}>
            ${steps.map((step, index) => html`
              <span data-slot="trace-line" data-status=${index > 0 ? 'pending' : nothing} class=${traceLineClass()}>
                <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${index === 0 ? CircleCheckIcon() : CircleIcon()}</span>
                <span data-slot="trace-title" class=${traceTitleClass()}>${step}</span>
              </span>
            `)}
          </div>
        </div>
      </details>
    </div>
  `;
}
