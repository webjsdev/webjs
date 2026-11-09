import { html, nothing } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon } from '#lib/ui/lucide.ts';

const question = 'Why is the checkout deploy so slow?';
const reasoning =
  'The deploy log has three phases. Install takes 38s and next build takes 52s, both normal for this repo.\n\nImage optimization takes 3m 50s. It reruns on every deploy because its cache key includes the commit hash, so the cache never hits.';
const answer =
  'Image optimization is the bottleneck. Key its cache on the lockfile and the image directory instead of the commit hash, and the deploy should take under two minutes.';

// A reasoning row. While it streams (running) the title shimmers and the row
// is open; once it settles it reads "Thought for 5s". With no text yet it is
// a plain line, since there is nothing to expand.
function ReasoningRow(text: string, running: boolean, open: boolean) {
  const line = html`<span data-slot="trace-line" data-status=${running ? 'running' : nothing} class=${traceLineClass()}>
    <span data-slot="trace-title" class=${traceTitleClass()}>${running ? 'Thinking' : 'Thought for 5s'}</span>
  </span>`;
  if (text.length === 0) return line;
  return html`
    <details data-slot="trace-collapsible" ?open=${open || running} class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
      <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
        ${line}
        <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
      </summary>
      <div data-slot="trace-collapsible-content" class=${cn(traceCollapsibleContentClass(), 'whitespace-pre-wrap')}>${text}</div>
    </details>
  `;
}

// The conversation once the reply has finished streaming, with the thinking
// left open.
export default function ReasoningDemo() {
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
            ${ReasoningRow(reasoning, false, true)}
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
