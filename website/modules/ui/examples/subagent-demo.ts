import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  codeBlockClass, codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon, CircleCheckIcon } from '#lib/ui/lucide.ts';

const question = 'Why does image optimization rerun on every deploy?';
const report =
  'The cache is keyed on the commit SHA, so every deploy misses it and optimizes all 1,240 images again.';
const answer =
  'Image optimization reruns because its cache is keyed on the commit SHA, which changes on every deploy. Key the cache on a hash of public/images instead, and unchanged images will be skipped.';

const steps = [
  {
    command: 'grep -rn cacheKey scripts',
    stdout: 'scripts/optimize-images.ts:14:  const cacheKey = process.env.COMMIT_SHA',
  },
  {
    command: 'sed -n 13,15p scripts/optimize-images.ts',
    stdout:
      'const cacheDir = ".next/cache/images"\nconst cacheKey = process.env.COMMIT_SHA\nconst cached = await restoreCache(cacheDir, cacheKey)',
  },
  {
    command: 'ls public/images | wc -l',
    stdout: '1240',
  },
];

const chevron = () => html`<span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform [[open]>summary>&]:rotate-90')}>${ChevronRightIcon()}</span>`;

// One finished tool call of the subagent, expanding to its output.
function StepRow(step: { command: string; stdout: string }) {
  return html`
    <details data-slot="trace-collapsible" class=${traceCollapsibleClass()}>
      <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
        <span data-slot="trace-line" class=${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleCheckIcon()}</span>
          <span data-slot="trace-title" class=${traceTitleClass()}>Ran ${step.command}</span>
        </span>
        ${chevron()}
      </summary>
      <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
        <div data-slot="code-block" data-variant="default" data-size="sm" class=${codeBlockClass()}>
          <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${step.stdout}</code></pre>
        </div>
      </div>
    </details>
  `;
}

// The conversation once the subagent and the reply have finished, with the
// subagent's run left open.
export default function SubagentDemo() {
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
            <details data-slot="trace-collapsible" open class=${traceCollapsibleClass()}>
              <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
                <span data-slot="trace-line" class=${traceLineClass()}>
                  <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleCheckIcon()}</span>
                  <span data-slot="trace-title" class=${traceTitleClass()}>Ran the research subagent</span>
                </span>
                ${chevron()}
              </summary>
              <div data-slot="trace-collapsible-content" class=${cn(traceCollapsibleContentClass(), 'flex flex-col gap-3')}>
                <div data-slot="trace" class=${traceClass()}>
                  ${steps.map((step) => StepRow(step))}
                </div>
                <p>${report}</p>
              </div>
            </details>
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
