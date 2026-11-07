import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
} from '#modules/ui/components/trace.ts';
import { GitBranchIcon } from '#lib/ui/lucide.ts';

export default function TraceStatic() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <span data-slot="trace-line" class=${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${GitBranchIcon()}</span>
        <span data-slot="trace-title" class=${traceTitleClass()}>Created branch fix/frozen-lockfile</span>
      </span>
    </div>
  `;
}
