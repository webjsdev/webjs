import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';

// The button stands for
// toast('Event has been created', { description: 'Monday, January 3rd at 6:00pm' }).
export default function SonnerDescription() {
  return html`
    <button type="button" data-slot="button" data-variant="outline" data-size="default" data-toast="Event has been created" data-toast-description="Monday, January 3rd at 6:00pm" class=${cn(buttonClass({ variant: 'outline' }), 'w-fit')}>
      Show Toast
    </button>
  `;
}
