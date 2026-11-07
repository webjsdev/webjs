import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass, traceDescriptionClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import {
  ChevronRightIcon, CircleCheckIcon, CircleDotIcon, CircleIcon, RouteIcon,
} from '#lib/ui/lucide.ts';

type Step = { title: string; status: 'done' | 'running' | 'pending' };

const plan: { title: string; steps: Step[] } = {
  title: 'Plan: migrate to Base UI',
  steps: [
    { title: 'Install @base-ui/react', status: 'done' },
    { title: 'Replace the Radix imports', status: 'done' },
    { title: 'Rename asChild to render', status: 'done' },
    { title: 'Run the type checker', status: 'done' },
  ],
};

const done = plan.steps.filter((step) => step.status === 'done').length;

function stepIcon(status: Step['status']) {
  if (status === 'done') return CircleCheckIcon();
  return status === 'running' ? CircleDotIcon() : CircleIcon();
}

// The conversation once the plan has finished: every step is done and the
// reply has streamed after it.
export default function PlanDemo() {
  return html`
    <div class="flex min-h-72 w-full max-w-sm flex-col gap-4 py-6 text-sm">
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>Migrate the dialog components to Base UI.</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${cn(messageContentClass(), 'gap-4')}>
          <div data-slot="trace" class=${traceClass()}>
            <details data-slot="trace-collapsible" open class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
              <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
                <span data-slot="trace-line" class=${traceLineClass()}>
                  <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${RouteIcon()}</span>
                  <span data-slot="trace-title" class=${traceTitleClass()}>${plan.title}</span>
                  <span data-slot="trace-description" class=${traceDescriptionClass()}>${done} of ${plan.steps.length} done</span>
                </span>
                <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
              </summary>
              <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
                <div data-slot="trace" class=${traceClass()}>
                  ${plan.steps.map((step) => html`
                    <span data-slot="trace-line" data-status=${step.status === 'pending' ? 'pending' : null} class=${traceLineClass()}>
                      <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${stepIcon(step.status)}</span>
                      <span data-slot="trace-title" class=${traceTitleClass()}>${step.title}</span>
                    </span>
                  `)}
                </div>
              </div>
            </details>
          </div>
          <p>Migrated Dialog and AlertDialog. The type checker passes.</p>
        </div>
      </div>
      <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'mt-auto self-start')}>
        Replay
      </button>
    </div>
  `;
}
