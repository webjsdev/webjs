import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { spinnerClass } from '#modules/ui/components/spinner.ts';

// The spinner with Lucide's loader icon in place of the default
// loader-circle: the same classes and the same status role, a different path.
function Spinner(opts: { class?: string } = {}) {
  return html`<svg data-slot="spinner" role="status" aria-label="Loading" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class=${cn(spinnerClass(), opts.class)}><path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" /><path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" /><path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" /></svg>`;
}

export default function SpinnerCustom() {
  return html`
    <div class="flex items-center gap-4">
      ${Spinner()}
    </div>
  `;
}
