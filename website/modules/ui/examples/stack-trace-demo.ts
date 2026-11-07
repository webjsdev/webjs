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
import { ChevronRightIcon, FileCodeIcon, LayersIcon, TerminalIcon } from '#lib/ui/lucide.ts';

const question = 'Reset the database and seed it.';
const answer =
  'The migrations ran, but the seed failed in seedUsers. One fixture has no profile, so profile.email is undefined.';

const RESET_OUTPUT = `Database reset successful

The following migrations have been applied:

migrations/
  └─ 20260912_init/
  └─ 20260920_add_profiles/`;

const STACK = `TypeError: Cannot read properties of undefined (reading 'email')
    at seedUsers (prisma/seed.ts:27:34)
    at main (prisma/seed.ts:51:9)
    at Module._compile (node:internal/modules/cjs/loader:1554:14)
    at Object.transformer (node_modules/tsx/dist/register.cjs:3:1104)
    at Module.load (node:internal/modules/cjs/loader:1289:32)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)`;

function parseFrame(line: string) {
  const match = line.match(/^at (.+) \((.+):(\d+):(\d+)\)$/);
  return {
    line,
    name: match?.[1],
    file: match?.[2],
    lineNumber: match?.[3],
    internal: line.includes('node_modules') || line.includes('node:'),
  };
}

const chevron = () => html`<span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform [[open]>summary>&]:rotate-90')}>${ChevronRightIcon()}</span>`;

// A failed command: the error is the title, and the content repeats it above
// the frames, with your own frames as links and the rest folded away.
function StackTrace(stack: string) {
  const [error, ...lines] = stack.split('\n').map((line) => line.trim());
  const frames = lines.map(parseFrame);
  const appFrames = frames.filter((frame) => !frame.internal);
  const internalFrames = frames.filter((frame) => frame.internal);

  return html`
    <details data-slot="trace-collapsible" open class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
      <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
        <span data-slot="trace-line" data-status="error" class=${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
          <span data-slot="trace-title" class=${traceTitleClass()}>Failed: ${error}</span>
        </span>
        ${chevron()}
      </summary>
      <div data-slot="trace-collapsible-content" class=${cn(traceCollapsibleContentClass(), 'flex flex-col gap-2')}>
        <p class="font-mono text-xs text-destructive">${error}</p>
        <div data-slot="trace" class=${traceClass()}>
          ${appFrames.map((frame) => html`
            <a href=${'#' + frame.file + ':' + frame.lineNumber}>
              <span data-slot="trace-line" class=${traceLineClass()}>
                <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${FileCodeIcon()}</span>
                <span data-slot="trace-title" class=${traceTitleClass()}>${frame.name} in ${frame.file}:${frame.lineNumber}</span>
              </span>
            </a>
          `)}
          <details data-slot="trace-collapsible" class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
            <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
              <span data-slot="trace-line" class=${traceLineClass()}>
                <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${LayersIcon()}</span>
                <span data-slot="trace-title" class=${traceTitleClass()}>${internalFrames.length} framework frames</span>
              </span>
              ${chevron()}
            </summary>
            <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
              <ol class="flex flex-col gap-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                ${internalFrames.map((frame) => html`<li class="whitespace-nowrap">${frame.line}</li>`)}
              </ol>
            </div>
          </details>
        </div>
      </div>
    </details>
  `;
}

// The conversation once the reply has finished streaming.
export default function StackTraceDemo() {
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
            <details data-slot="trace-collapsible" class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
              <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
                <span data-slot="trace-line" class=${traceLineClass()}>
                  <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
                  <span data-slot="trace-title" class=${traceTitleClass()}>Ran pnpm prisma migrate reset --skip-seed</span>
                </span>
                ${chevron()}
              </summary>
              <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
                <div data-slot="code-block" data-variant="default" data-size="sm" class=${codeBlockClass()}>
                  <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${RESET_OUTPUT}</code></pre>
                </div>
              </div>
            </details>
            ${StackTrace(STACK)}
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
