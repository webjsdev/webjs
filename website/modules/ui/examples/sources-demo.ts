import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ArrowUpRightIcon, ChevronRightIcon, GlobeIcon } from '#lib/ui/lucide.ts';

// The agent cited the Astro page twice, so the list is deduped by url.
const sources = [
  { url: 'https://docs.astro.build/en/install-and-setup/', title: 'Install Astro | docs.astro.build' },
  { url: 'https://www.npmjs.com/package/create-astro', title: 'create-astro | npmjs.com' },
  { url: 'https://docs.astro.build/en/install-and-setup/', title: 'Install Astro | docs.astro.build' },
  { url: 'https://pnpm.io/cli/create', title: 'pnpm create | pnpm.io' },
].filter((source, index, all) => all.findIndex((other) => other.url === source.url) === index);

export default function SourcesDemo() {
  return html`
    <div class="flex min-h-72 w-full max-w-sm flex-col gap-4 py-6 text-sm">
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>How do I start an Astro project with pnpm?</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${cn(messageContentClass(), 'gap-4')}>
          <p>Run pnpm create astro@latest and follow the prompts. It scaffolds the project and installs the dependencies.</p>
          <div data-slot="trace" class=${traceClass()}>
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
                    <a href=${source.url} target="_blank" rel="noreferrer">
                      <span data-slot="trace-line" class=${traceLineClass()}>
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
        </div>
      </div>
      <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'mt-auto self-start')}>
        Replay
      </button>
    </div>
  `;
}
