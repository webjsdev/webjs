import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  codeBlockClass, codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass, traceDescriptionClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import {
  BrainIcon, ChevronRightIcon, FileTextIcon, TerminalIcon,
} from '#lib/ui/lucide.ts';

// A collapsible row: a details element whose summary holds the line, and a
// chevron that turns while it is open.
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

export default function TraceTurn() {
  return html`
    <div class="w-full max-w-sm">
      ${TraceCollapsible(
        html`<span data-slot="trace-line" data-status="error" class=${traceLineClass()}>
          <span data-slot="trace-title" class=${traceTitleClass()}>Worked for 2m 4s, 1 command failed</span>
        </span>`,
        html`<div data-slot="trace-collapsible-content" class=${cn(traceCollapsibleContentClass(), 'flex flex-col gap-2')}>
          <div data-slot="trace" class=${traceClass()}>
            ${TraceCollapsible(
              html`<span data-slot="trace-line" class=${traceLineClass()}>
                <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${BrainIcon()}</span>
                <span data-slot="trace-title" class=${traceTitleClass()}>Thought</span>
                <span data-slot="trace-description" class=${traceDescriptionClass()}>12s</span>
              </span>`,
              html`<div data-slot="trace-collapsible-content" class=${cn(traceCollapsibleContentClass(), 'whitespace-pre-wrap')}>I should check which package managers are installed before I scaffold anything.</div>`,
            )}
            ${TraceCollapsible(
              html`<span data-slot="trace-line" data-status="error" class=${traceLineClass()}>
                <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
                <span data-slot="trace-title" class=${traceTitleClass()}>Ran 2 commands, 1 failed</span>
              </span>`,
              html`<div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
                <div data-slot="trace" class=${traceClass()}>
                  <span data-slot="trace-line" class=${traceLineClass()}>
                    <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
                    <span data-slot="trace-title" class=${traceTitleClass()}>Ran node --version</span>
                  </span>
                  ${TraceCollapsible(
                    html`<span data-slot="trace-line" data-status="error" class=${traceLineClass()}>
                      <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
                      <span data-slot="trace-title" class=${traceTitleClass()}>Failed to run pnpm --version</span>
                    </span>`,
                    html`<div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
                      <div data-slot="code-block" data-variant="destructive" data-size="sm" class=${codeBlockClass({ variant: 'destructive' })}>
                        <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>command not found: pnpm</code></pre>
                      </div>
                    </div>`,
                  )}
                </div>
              </div>`,
              true,
            )}
          </div>
          <p>Node is installed and pnpm is not. Reading the docs config.</p>
          <div data-slot="trace" class=${traceClass()}>
            <a href="#turn">
              <span data-slot="trace-line" class=${traceLineClass()}>
                <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${FileTextIcon()}</span>
                <span data-slot="trace-title" class=${traceTitleClass()}>Read apps/v4/lib/docs.ts</span>
                <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${ChevronRightIcon()}</span>
              </span>
            </a>
          </div>
        </div>`,
        true,
      )}
    </div>
  `;
}
