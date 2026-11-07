import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * Test Results, ported from shadcn's
 * content/docs/ai-elements/radix/test-results.mdx (#1666). shadcn's demo
 * streams a scripted chat through useChat; the demo here is the settled
 * conversation.
 */
export const title = 'Test Results';
export const description = 'Displays a test run by the agent, with its suites and failures.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('test-results-demo', RHEA)}
    <p>Test Results is a test run by the agent. The summary line counts what passed and failed. Open it to see each suite, its tests, and the error for each failure.</p>
    <p>Test Results is built with a trace, with a trace collapsible for the run and for each suite.</p>

    ${await installation(toc, {
      prose: html`Test Results is built with the <a href="/ui/docs/components/trace">Trace</a> and <a href="/ui/docs/components/code-block">Code Block</a> components.`,
      add: 'trace code-block',
      source: 'trace',
      dependencies: ['code-block'],
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { codeBlockClass, codeBlockCodeClass, codeBlockContentClass } from '#components/ui/code-block.ts';
import {
  traceClass,
  traceCollapsibleClass,
  traceCollapsibleContentClass,
  traceCollapsibleTriggerClass,
  traceIconClass,
  traceLineClass,
  traceTitleClass,
} from '#components/ui/trace.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="trace" class=\${traceClass()}>
  <details data-slot="trace-collapsible" class=\${traceCollapsibleClass()}>
    <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
      <span data-slot="trace-line" data-status="error" class=\${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>\${FlaskConicalIcon()}</span>
        <span data-slot="trace-title" class=\${traceTitleClass()}>Ran 2 tests, 1 failed</span>
      </span>
      <span data-slot="trace-icon" aria-hidden="true" class=\${cn(traceIconClass(), 'transition-transform [[open]>summary>&]:rotate-90')}>
        \${ChevronRightIcon()}
      </span>
    </summary>
    <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
      <div data-slot="trace" class=\${traceClass()}>
        <span data-slot="trace-line" class=\${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>\${CheckIcon()}</span>
          <span data-slot="trace-title" class=\${traceTitleClass()}>creates a user</span>
        </span>
        <details data-slot="trace-collapsible" class=\${traceCollapsibleClass()}>
          <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
            <span data-slot="trace-line" data-status="error" class=\${traceLineClass()}>
              <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>\${XIcon()}</span>
              <span data-slot="trace-title" class=\${traceTitleClass()}>updates a user profile</span>
            </span>
            <span data-slot="trace-icon" aria-hidden="true" class=\${cn(traceIconClass(), 'transition-transform [[open]>summary>&]:rotate-90')}>
              \${ChevronRightIcon()}
            </span>
          </summary>
          <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
            <div data-slot="code-block" data-variant="default" data-size="sm" class=\${codeBlockClass()}>
              <pre data-slot="code-block-content" data-wrap tabindex="0" class=\${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=\${codeBlockCodeClass()}>Expected status 200, received 500</code></pre>
            </div>
          </div>
        </details>
      </div>
    </div>
  </details>
</div>`, { lineNumbers: true })}
    <p>The collapsibles nest, so each chevron turns with its own <code>&lt;details&gt;</code> through <code>[[open]&gt;summary&gt;&amp;]:rotate-90</code> rather than a named group, which an outer collapsible would also match.</p>

    ${heading(toc, 2, 'Suites')}
    <p>Group tests by file. Each suite is a collapsible line with a trace of its tests. Open the suites that have a failure.</p>
    ${await componentPreview('test-results-suites', RHEA)}
    ${codeFigure(`<details data-slot="trace-collapsible" ?open=\${failed > 0} class=\${traceCollapsibleClass()}>
  <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
    <span data-slot="trace-line" data-status=\${failed > 0 ? 'error' : null} class=\${traceLineClass()}>
      <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>\${FileCodeIcon()}</span>
      <span data-slot="trace-title" class=\${traceTitleClass()}>user-api.test.ts, 14 tests, 2 failed</span>
    </span>
  </summary>
  <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
    <div data-slot="trace" class=\${traceClass()}>…</div>
  </div>
</details>`, { lineNumbers: true })}

    ${heading(toc, 2, 'AI SDK')}
    <p>Run the tests as a tool and render its output. The tool states map the same way as in <a href="/ui/docs/ai-elements/tool#states">Tool</a>, and <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> shows streaming the parts from a <code>'use server'</code> action.</p>
    ${codeFigure(`function testRun(part: RunTestsPart) {
  const tests = part.output.suites.flatMap((suite) => suite.tests);
  const failed = tests.filter((test) => test.status === 'failed').length;

  return html\`<details data-slot="trace-collapsible" ?open=\${failed > 0} class=\${traceCollapsibleClass()}>
    <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
      <span data-slot="trace-line" data-status=\${failed > 0 ? 'error' : null} class=\${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>\${FlaskConicalIcon()}</span>
        <span data-slot="trace-title" class=\${traceTitleClass()}>
          Ran \${tests.length} tests\${failed > 0 ? ', ' + failed + ' failed' : ''}
        </span>
      </span>
    </summary>
    <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>…</div>
  </details>\`;
}`, { lineNumbers: true })}

    ${migrating(toc, {
      name: 'Test Results',
      file: 'test-results.tsx',
      parts: [
        ['TestResults', html`A trace with a trace collapsible.`],
        ['TestResultsHeader, TestResultsSummary', html`The collapsible's <code>&lt;summary&gt;</code>, holding a trace line, and a trace title with the counts, like "Ran 42 tests, 2 failed". Set <code>data-status="error"</code> when a test failed.`],
        ['TestResultsContent', html`The trace collapsible content, holding a trace for the suites.`],
        ['TestSuite, TestSuiteName, TestSuiteContent', html`A trace collapsible, open when it has a failure, with its <code>&lt;summary&gt;</code> holding a trace line and its content a trace for the tests.`],
        ['Test', html`A trace line with a trace title for its name, with <code>data-status="error"</code> when it failed.`],
        ['TestError, TestErrorMessage, TestErrorStack', html`A Code Block with <code>data-size="sm"</code>, the message and the stack in its content.`],
        ['TestResultsDuration, TestResultsProgress, TestSuiteStats, TestName, TestDuration, TestStatus', html`No kit part. Keep them as markup of your own, a trace description for a duration.`],
      ],
    })}

    ${heading(toc, 2, 'API Reference')}
    <p>See <a href="/ui/docs/components/trace#api-reference">Trace</a>.</p>
  `;
}
