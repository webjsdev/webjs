import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

// Each button fires one toast() call through its data-toast attributes:
// toast(), toast.success(), toast.info(), toast.warning(), toast.error(),
// and for toast.promise() its two-second loading state, since a promise has
// no declarative form.
export default function SonnerTypes() {
  return html`
    <div class="flex flex-wrap gap-2">
      <button type="button" data-slot="button" data-variant="outline" data-size="default" data-toast="Event has been created" class=${buttonClass({ variant: 'outline' })}>
        Default
      </button>
      <button type="button" data-slot="button" data-variant="outline" data-size="default" data-toast="Event has been created" data-toast-type="success" class=${buttonClass({ variant: 'outline' })}>
        Success
      </button>
      <button type="button" data-slot="button" data-variant="outline" data-size="default" data-toast="Be at the area 10 minutes before the event time" data-toast-type="info" class=${buttonClass({ variant: 'outline' })}>
        Info
      </button>
      <button type="button" data-slot="button" data-variant="outline" data-size="default" data-toast="Event start time cannot be earlier than 8am" data-toast-type="warning" class=${buttonClass({ variant: 'outline' })}>
        Warning
      </button>
      <button type="button" data-slot="button" data-variant="outline" data-size="default" data-toast="Event has not been created" data-toast-type="error" class=${buttonClass({ variant: 'outline' })}>
        Error
      </button>
      <button type="button" data-slot="button" data-variant="outline" data-size="default" data-toast="Loading..." data-toast-type="loading" data-toast-duration="2000" class=${buttonClass({ variant: 'outline' })}>
        Promise
      </button>
    </div>
  `;
}
