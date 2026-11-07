import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  dialogHeaderClass, dialogTitleClass, dialogDescriptionClass,
} from '#modules/ui/components/dialog.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
} from '#modules/ui/components/trace.ts';
import { ArrowUpRightIcon, ChevronRightIcon, GlobeIcon } from '#lib/ui/lucide.ts';

const results = [
  {
    title: 'Caching build outputs',
    url: 'https://nextjs.org/docs/app/guides/caching',
  },
  {
    title: 'Image optimization reference',
    url: 'https://nextjs.org/docs/app/api-reference/components/image',
  },
  {
    title: 'Deploy hooks and cache keys',
    url: 'https://vercel.com/docs/deploy-hooks',
  },
];

// The dialog's trigger wraps the line in a button, and the dialog owns the
// open state, Escape and the focus return.
export default function TraceDialog() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <ui-dialog>
        <ui-dialog-trigger>
          <button type="button" class="flex w-fit max-w-full min-w-0 text-start outline-none">
            <span data-slot="trace-line" class=${traceLineClass()}>
              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${GlobeIcon()}</span>
              <span data-slot="trace-title" class=${traceTitleClass()}>Searched the web for cache keys</span>
              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${ChevronRightIcon()}</span>
            </span>
          </button>
        </ui-dialog-trigger>
        <ui-dialog-content>
          <div data-slot="dialog-header" class=${dialogHeaderClass()}>
            <h2 data-slot="dialog-title" class=${dialogTitleClass()}>Searched the web for cache keys</h2>
            <p data-slot="dialog-description" class=${dialogDescriptionClass()}>
              Three results were used in the response.
            </p>
          </div>
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
        </ui-dialog-content>
      </ui-dialog>
    </div>
  `;
}
