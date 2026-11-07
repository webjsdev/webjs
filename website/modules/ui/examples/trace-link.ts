import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
} from '#modules/ui/components/trace.ts';
import {
  ArrowUpRightIcon, ChevronRightIcon, FileTextIcon, GlobeIcon,
} from '#lib/ui/lucide.ts';

export default function TraceLink() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <a href="#link">
        <span data-slot="trace-line" class=${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${FileTextIcon()}</span>
          <span data-slot="trace-title" class=${traceTitleClass()}>Read apps/v4/lib/docs.ts</span>
          <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${ChevronRightIcon()}</span>
        </span>
      </a>
      <a href="https://docs.astro.build/en/install-and-setup/" target="_blank" rel="noreferrer">
        <span data-slot="trace-line" class=${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${GlobeIcon()}</span>
          <span data-slot="trace-title" class=${traceTitleClass()}>
            Install Astro | docs.astro.build
            <span class="sr-only"> (opens in a new tab)</span>
          </span>
          <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${ArrowUpRightIcon()}</span>
        </span>
      </a>
    </div>
  `;
}
