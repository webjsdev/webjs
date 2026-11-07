import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import {
  codeBlockClass, codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon, FileTextIcon, SearchIcon } from '#lib/ui/lucide.ts';

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

export default function TraceSteps() {
  return html`
    <div class="w-full max-w-sm">
      ${TraceCollapsible(
        html`<span data-slot="trace-line" data-status="running" class=${traceLineClass()}>
          <span data-slot="trace-title" class=${traceTitleClass()}>Looking into the slow deploy</span>
        </span>`,
        html`<div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
          <div data-slot="trace" class=${traceClass()}>
            ${TraceCollapsible(
              html`<span data-slot="trace-line" class=${traceLineClass()}>
                <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${SearchIcon()}</span>
                <span data-slot="trace-title" class=${traceTitleClass()}>Searched for the checkout build log</span>
              </span>`,
              html`<div data-slot="trace-collapsible-content" class=${cn(traceCollapsibleContentClass(), 'flex flex-wrap gap-1.5')}>
                <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>vercel.com</span>
                <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>github.com</span>
              </div>`,
            )}
            <a href="#steps">
              <span data-slot="trace-line" class=${traceLineClass()}>
                <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${FileTextIcon()}</span>
                <span data-slot="trace-title" class=${traceTitleClass()}>Read the last twelve deploys</span>
                <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${ChevronRightIcon()}</span>
              </span>
            </a>
            ${TraceCollapsible(
              html`<span data-slot="trace-line" data-status="running" class=${traceLineClass()}>
                <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${SearchIcon()}</span>
                <span data-slot="trace-title" class=${traceTitleClass()}>Searching for the cache key</span>
              </span>`,
              html`<div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
                <div data-slot="code-block" data-variant="default" data-size="sm" class=${codeBlockClass()}>
                  <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>cache key image optimization</code></pre>
                </div>
              </div>`,
            )}
          </div>
        </div>`,
        true,
      )}
    </div>
  `;
}
