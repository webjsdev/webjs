import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

export default function SonnerDemo() {
  return html`
    <button type="button" data-slot="button" data-variant="outline" data-size="default" data-toast="Event has been created" data-toast-description="Sunday, December 03, 2023 at 9:00 AM" data-toast-action="Undo" class=${buttonClass({ variant: 'outline' })}>
      Show Toast
    </button>
  `;
}
