import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  codeBlockClass, codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import {
  ArrowUpRightIcon, ChevronRightIcon, CircleCheckIcon, GlobeIcon,
} from '#lib/ui/lucide.ts';

const question = 'Why is the checkout deploy so slow?';
const log = 'install    41s\ncompile    38s\nimages   3m 52s';
const results = [
  { title: 'Image component | nextjs.org', url: 'https://nextjs.org/docs/app/api-reference/components/image' },
  { title: 'Build cache | vercel.com', url: 'https://vercel.com/docs/deployments/troubleshoot-a-build' },
];
const files = ['next.config.ts', 'scripts/optimize-images.ts'];
const answer =
  'Image optimization takes almost four minutes because its cache key includes the commit hash. Key it on the image directory instead.';

// A finished step: a check icon and the title in the past tense.
function line(title: string) {
  return html`<span data-slot="trace-line" class=${traceLineClass()}>
    <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleCheckIcon()}</span>
    <span data-slot="trace-title" class=${traceTitleClass()}>${title}</span>
  </span>`;
}

// A row that opens. The chevron after the line turns while it is open.
function collapsible(head: unknown, content: unknown, open = false) {
  return html`
    <details data-slot="trace-collapsible" ?open=${open} class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
      <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
        ${head}
        <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
      </summary>
      ${content}
    </details>
  `;
}

// The conversation once the reply has streamed. The summary closed when the
// answer started, and the build log step inside it starts open.
export default function ChainOfThoughtDemo() {
  return html`
    <div class="flex min-h-72 w-full max-w-sm flex-col gap-4 py-6 text-sm">
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>${question}</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${cn(messageContentClass(), 'gap-4')}>
          <div data-slot="trace" class=${traceClass()}>
            ${collapsible(
              line('Researched in 3 steps'),
              html`<div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
                <div data-slot="trace" class=${traceClass()}>
                  ${collapsible(
                    line('Read the build log for dpl_8Kx2'),
                    html`<div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
                      <div data-slot="code-block" data-variant="default" data-size="sm" class=${codeBlockClass()}>
                        <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${log}</code></pre>
                      </div>
                    </div>`,
                    true,
                  )}
                  ${collapsible(
                    line('Searched the web for next.js image cache key'),
                    html`<div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
                      <div data-slot="trace" class=${traceClass()}>
                        ${results.map((result) => html`
                          <a href=${result.url} target="_blank" rel="noreferrer">
                            <span data-slot="trace-line" class=${traceLineClass()}>
                              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${GlobeIcon()}</span>
                              <span data-slot="trace-title" class=${traceTitleClass()}>
                                ${result.title}
                                <span class="sr-only"> (opens in a new tab)</span>
                              </span>
                              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${ArrowUpRightIcon()}</span>
                            </span>
                          </a>
                        `)}
                      </div>
                    </div>`,
                  )}
                  ${collapsible(
                    line('Searched the code for cacheKey'),
                    html`<div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
                      <div class="flex flex-wrap gap-1.5">
                        ${files.map((file) => html`<span data-slot="badge" data-variant="secondary" class=${cn(badgeClass({ variant: 'secondary' }), 'font-mono')}>${file}</span>`)}
                      </div>
                    </div>`,
                  )}
                </div>
              </div>`,
            )}
          </div>
          <p>${answer}</p>
        </div>
      </div>
      <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'mt-auto self-start')}>
        Replay
      </button>
    </div>
  `;
}
