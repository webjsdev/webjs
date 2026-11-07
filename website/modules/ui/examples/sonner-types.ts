import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

// Each button stands for one toast() call: toast(), toast.success(),
// toast.info(), toast.warning(), toast.error() and toast.promise().
export default function SonnerTypes() {
  return html`
    <div class="flex flex-wrap gap-2">
      <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
        Default
      </button>
      <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
        Success
      </button>
      <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
        Info
      </button>
      <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
        Warning
      </button>
      <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
        Error
      </button>
      <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
        Promise
      </button>
    </div>
  `;
}
