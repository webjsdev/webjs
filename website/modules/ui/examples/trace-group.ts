import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
} from '#modules/ui/components/trace.ts';
import { FileTextIcon, SearchIcon, TerminalIcon } from '#lib/ui/lucide.ts';

export default function TraceGroupDemo() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <span data-slot="trace-line" class=${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${SearchIcon()}</span>
        <span data-slot="trace-title" class=${traceTitleClass()}>Searched for minimumReleaseAge</span>
      </span>
      <span data-slot="trace-line" class=${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${FileTextIcon()}</span>
        <span data-slot="trace-title" class=${traceTitleClass()}>Read pnpm-workspace.yaml</span>
      </span>
      <span data-slot="trace-line" class=${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
        <span data-slot="trace-title" class=${traceTitleClass()}>Ran pnpm install</span>
      </span>
    </div>
  `;
}
