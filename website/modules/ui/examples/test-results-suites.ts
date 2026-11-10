import { html, nothing } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  codeBlockClass, codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';
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

const suites: { name: string; tests: Test[] }[] = [
  {
    name: 'auth.test.ts',
    tests: [
      { name: 'logs in with valid credentials', status: 'passed' },
      { name: 'rejects an invalid password', status: 'passed' },
      { name: 'refreshes an expired token', status: 'passed' },
    ],
  },
  {
    name: 'user-api.test.ts',
    tests: [
      { name: 'creates a user', status: 'passed' },
      {
        name: 'updates a user profile',
        status: 'failed',
        error: `Expected status 200, received 500

  at Object.<anonymous> (src/user-api.test.ts:45:12)`,
      },
      { name: 'deletes a user', status: 'skipped' },
    ],
  },
  {
    name: 'db.test.ts',
    tests: [
      { name: 'connects to the database', status: 'passed' },
      {
        name: 'times out a slow query',
        status: 'failed',
        error: `Exceeded timeout of 5000 ms for a test.

  at Object.<anonymous> (src/db.test.ts:22:3)`,
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

function TestRow(test: Test) {
  if (test.status === 'failed') {
    return html`
      <details data-slot="trace-collapsible" class=${traceCollapsibleClass()}>
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

export default function TestResultsSuites() {
  const summary = countTests(suites.flatMap((suite) => suite.tests));
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <details data-slot="trace-collapsible" open class=${traceCollapsibleClass()}>
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
    </div>
  `;
}
