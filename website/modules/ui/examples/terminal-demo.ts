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
import { ChevronRightIcon, TerminalIcon } from '#lib/ui/lucide.ts';

const question = 'Run the checks, then build the app.';
const answer = 'Lint and tests pass, and the build compiled both routes.';

const COMMANDS = [
  {
    command: 'pnpm lint',
    output: ['> acme-chat@0.1.0 lint', '> eslint .'],
  },
  {
    command: 'pnpm test',
    output: [
      '> acme-chat@0.1.0 test',
      '> vitest run',
      '',
      ' ✓ lib/ai.test.ts (6 tests) 41ms',
      ' ✓ components/chat.test.tsx (9 tests) 212ms',
      '',
      ' Test Files  2 passed (2)',
      '      Tests  15 passed (15)',
    ],
  },
  {
    command: 'pnpm build',
    output: [
      '> acme-chat@0.1.0 build',
      '> next build',
      '',
      '   ▲ Next.js 16.3.0',
      '   Creating an optimized production build ...',
      ' ✓ Compiled successfully in 4.2s',
      ' ✓ Generating static pages (12/12)',
      '',
      'Route (app)                Size  First Load JS',
      '┌ ○ /                     1.9 kB       112 kB',
      '└ ƒ /api/chat              141 B       102 kB',
    ],
  },
];

// A command that exited with 0. Only the last one renders open once the
// reply has finished.
function CommandRow(entry: { command: string; output: string[] }, open: boolean) {
  return html`
    <details data-slot="trace-collapsible" ?open=${open} class=${traceCollapsibleClass()}>
      <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
        <span data-slot="trace-line" class=${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
          <span data-slot="trace-title" class=${traceTitleClass()}>Ran ${entry.command}</span>
        </span>
        <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform [[open]>summary>&]:rotate-90')}>${ChevronRightIcon()}</span>
      </summary>
      <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
        <div data-slot="code-block" data-variant="default" data-size="sm" class=${codeBlockClass()}>
          <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${entry.output.join('\n')}</code></pre>
        </div>
      </div>
    </details>
  `;
}

// The conversation once every command has exited.
export default function TerminalDemo() {
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
            ${COMMANDS.map((entry, index) => CommandRow(entry, index === COMMANDS.length - 1))}
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
