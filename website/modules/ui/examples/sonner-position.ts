import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

const positions = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

// Each button stands for a toast shown in a <ui-sonner> mounted at that
// position.
export default function SonnerPosition() {
  return html`
    <div class="flex flex-wrap justify-center gap-2">
      ${positions.map((position) => html`
        <button type="button" data-slot="button" data-variant="outline" data-size="default" data-position=${position.value} class=${buttonClass({ variant: 'outline' })}>
          ${position.label}
        </button>
      `)}
    </div>
  `;
}
