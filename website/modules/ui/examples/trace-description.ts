import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass, traceDescriptionClass,
} from '#modules/ui/components/trace.ts';
import { FilePenIcon, SearchIcon, TerminalIcon } from '#lib/ui/lucide.ts';

export default function TraceDescriptionDemo() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <span data-slot="trace-line" class=${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${FilePenIcon()}</span>
        <span data-slot="trace-title" class=${traceTitleClass()}>
          Edited components/settings/notification-preferences-form.tsx
        </span>
        <span data-slot="trace-description" class=${cn(traceDescriptionClass(), 'font-mono')}>+48 −12</span>
      </span>
      <span data-slot="trace-line" class=${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
        <span data-slot="trace-title" class=${traceTitleClass()}>Ran pnpm test</span>
        <span data-slot="trace-description" class=${traceDescriptionClass()}>14s</span>
      </span>
      <span data-slot="trace-line" class=${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${SearchIcon()}</span>
        <span data-slot="trace-title" class=${traceTitleClass()}>Searched for useChat</span>
        <span data-slot="trace-description" class=${traceDescriptionClass()}>8 results</span>
      </span>
    </div>
  `;
}
