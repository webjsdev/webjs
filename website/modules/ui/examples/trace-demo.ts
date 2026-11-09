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
  ArrowUpRightIcon, ChevronRightIcon, CircleAlertIcon, CircleCheckIcon, GlobeIcon,
} from '#lib/ui/lucide.ts';

const question = 'Why does pnpm install fail in CI?';
const reasoning =
  'CI installs with a frozen lockfile, so the install stops when package.json and pnpm-lock.yaml disagree. I should check what the last commit changed, then reproduce the install.';
const answer =
  'The last commit bumped a version in package.json without updating pnpm-lock.yaml, so the frozen install fails. Run pnpm install locally and commit the lockfile.';
const sources = [
  { url: 'https://pnpm.io/cli/install#--frozen-lockfile', title: 'pnpm install | pnpm.io' },
  { url: 'https://pnpm.io/continuous-integration', title: 'Continuous Integration | pnpm.io' },
];

function TraceCollapsible(line: unknown, content: unknown, open = false) {
  return html`
    <details data-slot="trace-collapsible" ?open=${open} class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
      <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
        ${line}
        <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
      </summary>
      ${content}
    </details>
  `;
}

function ThinkingRow() {
  return TraceCollapsible(
    html`<span data-slot="trace-line" class=${traceLineClass()}>
      <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleCheckIcon()}</span>
      <span data-slot="trace-title" class=${traceTitleClass()}>Thought for 5s</span>
    </span>`,
    html`<div data-slot="trace-collapsible-content" class=${cn(traceCollapsibleContentClass(), 'whitespace-pre-wrap')}>${reasoning}</div>`,
  );
}

function ToolRow(command: string, result: { stdout?: string; errorText?: string }, defaultOpen = false) {
  const failed = result.errorText !== undefined;
  return TraceCollapsible(
    html`<span data-slot="trace-line" data-status=${failed ? 'error' : nothing} class=${traceLineClass()}>
      <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${failed ? CircleAlertIcon() : CircleCheckIcon()}</span>
      <span data-slot="trace-title" class=${traceTitleClass()}>${failed ? 'Failed to run' : 'Ran'} ${command}</span>
    </span>`,
    html`<div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
      <div data-slot="code-block" data-variant=${failed ? 'destructive' : 'default'} data-size="sm" class=${codeBlockClass({ variant: failed ? 'destructive' : 'default' })}>
        <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${failed ? result.errorText : result.stdout}</code></pre>
      </div>
    </div>`,
    defaultOpen,
  );
}

function SourcesRow() {
  return TraceCollapsible(
    html`<span data-slot="trace-line" class=${traceLineClass()}>
      <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${GlobeIcon()}</span>
      <span data-slot="trace-title" class=${traceTitleClass()}>Used ${sources.length} sources</span>
    </span>`,
    html`<div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
      <div data-slot="trace" class=${traceClass()}>
        ${sources.map((source) => html`
          <a href=${source.url} target="_blank" rel="noreferrer">
            <span data-slot="trace-line" class=${traceLineClass()}>
              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${GlobeIcon()}</span>
              <span data-slot="trace-title" class=${traceTitleClass()}>
                ${source.title}
                <span class="sr-only"> (opens in a new tab)</span>
              </span>
              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${ArrowUpRightIcon()}</span>
            </span>
          </a>
        `)}
      </div>
    </div>`,
  );
}

export default function TraceDemo() {
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
            ${ThinkingRow()}
            ${ToolRow('pnpm --version', { stdout: '10.18.0' })}
            ${ToolRow(
              'git diff --stat HEAD~1 -- package.json pnpm-lock.yaml',
              { stdout: ' package.json | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)' },
              true,
            )}
            ${ToolRow('pnpm install --frozen-lockfile', {
              errorText: 'ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with package.json',
            })}
            ${SourcesRow()}
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
