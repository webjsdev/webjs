import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon, CircleCheckIcon } from '#lib/ui/lucide.ts';

const question = 'Add Open Graph metadata to the home page.';
const answer =
  'Added Open Graph defaults to app/layout.tsx and a title, description and image for the home page in app/page.tsx.';

const tasks = [
  {
    title: 'Found the project files',
    steps: ['Searched for generateMetadata', 'Read app/layout.tsx', 'Read app/page.tsx'],
  },
  {
    title: 'Updated the page metadata',
    steps: ['Edited app/layout.tsx', 'Edited app/page.tsx'],
  },
];

// A finished task: past tense, closed, its steps a trace under the line.
function TaskRow(task: { title: string; steps: string[] }) {
  return html`
    <details data-slot="trace-collapsible" class=${traceCollapsibleClass()}>
      <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
        <span data-slot="trace-line" class=${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleCheckIcon()}</span>
          <span data-slot="trace-title" class=${traceTitleClass()}>${task.title}</span>
        </span>
        <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform [[open]>summary>&]:rotate-90')}>${ChevronRightIcon()}</span>
      </summary>
      <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
        <div data-slot="trace" class=${traceClass()}>
          ${task.steps.map((step) => html`
            <span data-slot="trace-line" class=${traceLineClass()}>
              <span data-slot="trace-title" class=${traceTitleClass()}>${step}</span>
            </span>
          `)}
        </div>
      </div>
    </details>
  `;
}

// The conversation once both tasks are done, so both are closed.
export default function TaskDemo() {
  return html`
    <div class="flex min-h-72 w-full max-w-sm flex-col gap-4 py-6 text-sm">
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>${question}</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${cn(messageContentClass(), 'gap-4')}>
          <div data-slot="trace" class=${traceClass()}>
            ${tasks.map((task) => TaskRow(task))}
          </div>
          <p>${answer}</p>
        </div>
      </div>
      <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'mt-auto self-start')}>
        Replay
      </button>
    </div>
  `;
}
