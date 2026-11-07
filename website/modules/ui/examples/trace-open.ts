import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  codeBlockClass, codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';
import {
  traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon, TerminalIcon } from '#lib/ui/lucide.ts';

function Row(command: string, output: string, open: boolean) {
  return html`
    <details data-slot="trace-collapsible" ?open=${open} class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
      <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
        <span data-slot="trace-line" class=${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
          <span data-slot="trace-title" class=${traceTitleClass()}>Ran ${command}</span>
        </span>
        <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
      </summary>
      <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
        <div data-slot="code-block" data-variant="default" data-size="sm" class=${codeBlockClass()}>
          <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${output}</code></pre>
        </div>
      </div>
    </details>
  `;
}

// The first row starts open through the details element's open attribute.
// The second starts closed; script opens it by setting the element's open
// property, which is what the button below would do.
export default function TraceOpen() {
  return html`
    <div class="flex w-full max-w-sm flex-col items-start gap-4">
      ${Row('node --version', '$ node --version\nv24.18.0', true)}
      ${Row('pnpm --version', '$ pnpm --version\n10.33.4', false)}
      <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>
        Show the pnpm output
      </button>
    </div>
  `;
}
