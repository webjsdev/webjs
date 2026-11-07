import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ArrowUpRightIcon, ChevronRightIcon, GlobeIcon } from '#lib/ui/lucide.ts';

const sources = [
  {
    title: 'Install Astro | docs.astro.build',
    href: 'https://docs.astro.build/en/install-and-setup/',
  },
  {
    title: 'create-astro | npmjs.com',
    href: 'https://www.npmjs.com/package/create-astro',
  },
  {
    title: 'Settings: minimumReleaseAge | pnpm.io',
    href: 'https://pnpm.io/settings#minimumreleaseage',
  },
];

export default function TraceSources() {
  return html`
    <div class="w-full max-w-sm">
      <details data-slot="trace-collapsible" open class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
        <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
          <span data-slot="trace-line" class=${traceLineClass()}>
            <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${GlobeIcon()}</span>
            <span data-slot="trace-title" class=${traceTitleClass()}>Used ${sources.length} sources</span>
          </span>
          <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
        </summary>
        <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
          <div data-slot="trace" class=${traceClass()}>
            ${sources.map((source) => html`
              <a href=${source.href} target="_blank" rel="noreferrer">
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
        </div>
      </details>
    </div>
  `;
}
