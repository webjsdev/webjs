import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  itemClass, itemActionsClass, itemContentClass, itemDescriptionClass,
  itemMediaClass, itemTitleClass,
} from '#modules/ui/components/item.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon, CircleCheckIcon, TerminalIcon } from '#lib/ui/lucide.ts';

const reasoning =
  'The build output lives in dist. Deleting it cannot be undone, so I should ask before I run the command.';

// The turn waiting on the person: the thinking has settled and the command
// asks for a yes or no. A pending approval is a prompt, not a step the agent
// took, so it sits outside the trace. Deny and Approve are the reader's to
// wire to the action that answers the approval.
export default function ToolApproval() {
  return html`
    <div class="flex min-h-72 w-full max-w-sm flex-col gap-4 py-6 text-sm">
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>Clean up the build folder.</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${cn(messageContentClass(), 'gap-4')}>
          <div data-slot="trace" class=${traceClass()}>
            <details data-slot="trace-collapsible" class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
              <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
                <span data-slot="trace-line" class=${traceLineClass()}>
                  <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleCheckIcon()}</span>
                  <span data-slot="trace-title" class=${traceTitleClass()}>Thought</span>
                </span>
                <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
              </summary>
              <div data-slot="trace-collapsible-content" class=${cn(traceCollapsibleContentClass(), 'whitespace-pre-wrap')}>${reasoning}</div>
            </details>
          </div>
          <div data-slot="item" data-variant="outline" data-size="sm" class=${itemClass({ variant: 'outline', size: 'sm' })}>
            <div data-slot="item-media" data-variant="icon" class=${itemMediaClass({ variant: 'icon' })}>
              ${TerminalIcon()}
            </div>
            <div data-slot="item-content" class=${itemContentClass()}>
              <div data-slot="item-title" class=${itemTitleClass()}>Run rm -rf dist?</div>
              <p data-slot="item-description" class=${itemDescriptionClass()}>The command runs in this project.</p>
            </div>
            <div data-slot="item-actions" class=${itemActionsClass()}>
              <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Deny</button>
              <button type="button" data-slot="button" data-variant="default" data-size="sm" class=${buttonClass({ size: 'sm' })}>Approve</button>
            </div>
          </div>
        </div>
      </div>
      <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'mt-auto self-start')}>
        Reset
      </button>
    </div>
  `;
}
