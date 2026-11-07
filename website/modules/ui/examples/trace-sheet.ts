import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  sheetHeaderClass, sheetTitleClass, sheetDescriptionClass,
} from '#modules/ui/components/sheet.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon, FolderSearchIcon } from '#lib/ui/lucide.ts';

export default function TraceSheet() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <ui-sheet>
        <ui-sheet-trigger>
          <button type="button" class="flex w-fit max-w-full min-w-0 text-start outline-none">
            <span data-slot="trace-line" class=${traceLineClass()}>
              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${FolderSearchIcon()}</span>
              <span data-slot="trace-title" class=${traceTitleClass()}>Explored 4 files</span>
              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${ChevronRightIcon()}</span>
            </span>
          </button>
        </ui-sheet-trigger>
        <ui-sheet-content side="right">
          <div data-slot="sheet-header" class=${sheetHeaderClass()}>
            <h2 data-slot="sheet-title" class=${sheetTitleClass()}>Explored 4 files</h2>
            <p data-slot="sheet-description" class=${sheetDescriptionClass()}>
              Files read while preparing the response.
            </p>
          </div>
          <ul class="flex flex-col gap-2 px-6 font-mono text-xs">
            <li>apps/v4/lib/docs.ts</li>
            <li>apps/v4/lib/components.ts</li>
            <li>apps/v4/next.config.mjs</li>
            <li>apps/v4/package.json</li>
          </ul>
        </ui-sheet-content>
      </ui-sheet>
    </div>
  `;
}
