import { html, nothing } from '@webjsdev/core';
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
import {
  CheckIcon, ChevronRightIcon, CircleDashedIcon, FileCodeIcon, FlaskConicalIcon, XIcon,
} from '#lib/ui/lucide.ts';

type Test = {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  error?: string;
};

const question = 'Run the checkout tests.';
const answer =
  'One test failed. The payment client does not retry a declined card, so the second charge attempt never happens.';

const suites: { name: string; tests: Test[] }[] = [
  {
    name: 'cart.test.ts',
    tests: [
      { name: 'adds an item', status: 'passed' },
      { name: 'removes an item', status: 'passed' },
      { name: 'applies a discount code', status: 'passed' },
    ],
  },
  {
    name: 'payment.test.ts',
    tests: [
      { name: 'charges the saved card', status: 'passed' },
      {
        name: 'retries a declined card',
        status: 'failed',
        error: `Expected 2 charge attempts, received 1

  at Object.<anonymous> (src/payment.test.ts:58:22)`,
      },
    ],
  },
];

function countTests(tests: Test[]) {
  return {
    total: tests.length,
    failed: tests.filter((test) => test.status === 'failed').length,
    skipped: tests.filter((test) => test.status === 'skipped').length,
  };
}

function formatCounts({ total, failed, skipped }: ReturnType<typeof countTests>) {
  return [
    `${total} tests`,
    failed > 0 && `${failed} failed`,
    skipped > 0 && `${skipped} skipped`,
  ].filter(Boolean).join(', ');
}

const chevron = () => html`<span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform [[open]>summary>&]:rotate-90')}>${ChevronRightIcon()}</span>`;

// A failed test opens to its error; the others are plain lines.
function TestRow(test: Test) {
  if (test.status === 'failed') {
    return html`
      <details data-slot="trace-collapsible" open class=${traceCollapsibleClass()}>
        <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
          <span data-slot="trace-line" data-status="error" class=${traceLineClass()}>
            <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${XIcon()}</span>
            <span data-slot="trace-title" class=${traceTitleClass()}>${test.name}</span>
          </span>
          ${chevron()}
        </summary>
        <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
          <div data-slot="code-block" data-variant="default" data-size="sm" class=${codeBlockClass()}>
            <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${test.error}</code></pre>
          </div>
        </div>
      </details>
    `;
  }
  return html`
    <span data-slot="trace-line" class=${traceLineClass()}>
      <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${test.status === 'skipped' ? CircleDashedIcon() : CheckIcon()}</span>
      <span data-slot="trace-title" class=${traceTitleClass()}>${test.status === 'skipped' ? 'Skipped ' + test.name : test.name}</span>
    </span>
  `;
}

// The test run as one line, open because a test failed, with a line per
// suite, open where that suite has a failure.
function TestResultsRow() {
  const summary = countTests(suites.flatMap((suite) => suite.tests));
  return html`
    <details data-slot="trace-collapsible" ?open=${summary.failed > 0} class=${traceCollapsibleClass()}>
      <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
        <span data-slot="trace-line" data-status=${summary.failed > 0 ? 'error' : nothing} class=${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${FlaskConicalIcon()}</span>
          <span data-slot="trace-title" class=${traceTitleClass()}>Ran ${formatCounts(summary)}</span>
        </span>
        ${chevron()}
      </summary>
      <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
        <div data-slot="trace" class=${traceClass()}>
          ${suites.map((suite) => {
            const counts = countTests(suite.tests);
            return html`
              <details data-slot="trace-collapsible" ?open=${counts.failed > 0} class=${traceCollapsibleClass()}>
                <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
                  <span data-slot="trace-line" data-status=${counts.failed > 0 ? 'error' : nothing} class=${traceLineClass()}>
                    <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${FileCodeIcon()}</span>
                    <span data-slot="trace-title" class=${traceTitleClass()}>${suite.name}, ${formatCounts(counts)}</span>
                  </span>
                  ${chevron()}
                </summary>
                <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
                  <div data-slot="trace" class=${traceClass()}>
                    ${suite.tests.map((test) => TestRow(test))}
                  </div>
                </div>
              </details>
            `;
          })}
        </div>
      </div>
    </details>
  `;
}

// The conversation once the run and the reply have finished.
export default function TestResultsDemo() {
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
            ${TestResultsRow()}
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
