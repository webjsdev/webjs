import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon, CircleXIcon, FileCodeIcon, LayersIcon } from '#lib/ui/lucide.ts';

const STACK = `TypeError: Cannot read properties of undefined (reading 'total')
    at formatInvoice (app/lib/billing.ts:42:31)
    at InvoiceRow (app/components/invoice-row.tsx:18:12)
    at renderWithHooks (node_modules/react-dom/cjs/react-dom.development.js:14985:18)
    at beginWork (node_modules/react-dom/cjs/react-dom.development.js:19049:16)
    at performUnitOfWork (node_modules/react-dom/cjs/react-dom.development.js:22776:12)
    at workLoopSync (node_modules/react-dom/cjs/react-dom.development.js:22707:5)`;

function parseFrame(line: string) {
  const match = line.match(/^at (.+) \((.+):(\d+):(\d+)\)$/);
  return {
    line,
    name: match?.[1],
    file: match?.[2],
    lineNumber: match?.[3],
    internal: line.includes('node_modules'),
  };
}

const [error, ...lines] = STACK.split('\n').map((line) => line.trim());
const frames = lines.map(parseFrame);
const appFrames = frames.filter((frame) => !frame.internal);
const internalFrames = frames.filter((frame) => frame.internal);

const chevron = () => html`<span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform [[open]>summary>&]:rotate-90')}>${ChevronRightIcon()}</span>`;

export default function StackTraceFrames() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <details data-slot="trace-collapsible" open class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
        <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
          <span data-slot="trace-line" data-status="error" class=${traceLineClass()}>
            <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleXIcon()}</span>
            <span data-slot="trace-title" class=${traceTitleClass()}>Failed: ${error}</span>
          </span>
          ${chevron()}
        </summary>
        <div data-slot="trace-collapsible-content" class=${cn(traceCollapsibleContentClass(), 'flex flex-col gap-2')}>
          <p class="font-mono text-xs text-destructive">${error}</p>
          <div data-slot="trace" class=${traceClass()}>
            ${appFrames.map((frame) => html`
              <a href=${'#' + frame.file + ':' + frame.lineNumber}>
                <span data-slot="trace-line" class=${traceLineClass()}>
                  <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${FileCodeIcon()}</span>
                  <span data-slot="trace-title" class=${traceTitleClass()}>${frame.name} in ${frame.file}:${frame.lineNumber}</span>
                </span>
              </a>
            `)}
            <details data-slot="trace-collapsible" class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
              <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
                <span data-slot="trace-line" class=${traceLineClass()}>
                  <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${LayersIcon()}</span>
                  <span data-slot="trace-title" class=${traceTitleClass()}>${internalFrames.length} framework frames</span>
                </span>
                ${chevron()}
              </summary>
              <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
                <ol class="flex flex-col gap-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                  ${internalFrames.map((frame) => html`<li class="whitespace-nowrap">${frame.line}</li>`)}
                </ol>
              </div>
            </details>
          </div>
        </div>
      </details>
    </div>
  `;
}
