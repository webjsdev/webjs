import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
} from '#modules/ui/components/trace.ts';
import {
  CircleAlertIcon, CircleCheckIcon, CircleIcon, LoaderCircleIcon,
} from '#lib/ui/lucide.ts';

export default function TraceStatus() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <span data-slot="trace-line" class=${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleCheckIcon()}</span>
        <span data-slot="trace-title" class=${traceTitleClass()}>Ran pnpm install</span>
      </span>
      <span data-slot="trace-line" data-status="error" class=${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleAlertIcon()}</span>
        <span data-slot="trace-title" class=${traceTitleClass()}>Failed to run pnpm lint</span>
      </span>
      <span data-slot="trace-line" data-status="running" class=${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${LoaderCircleIcon('animate-spin')}</span>
        <span data-slot="trace-title" class=${traceTitleClass()}>Running pnpm build</span>
      </span>
      <span data-slot="trace-line" data-status="pending" class=${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleIcon()}</span>
        <span data-slot="trace-title" class=${traceTitleClass()}>Run pnpm test</span>
      </span>
    </div>
  `;
}
