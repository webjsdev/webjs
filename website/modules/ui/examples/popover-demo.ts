import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { labelClass } from '#modules/ui/components/label.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';

const field = (id: string, label: string, value: string) => html`
  <div class="grid grid-cols-3 items-center gap-4">
    <label data-slot="label" for=${id} class=${labelClass()}>${label}</label>
    <input data-slot="input" id=${id} value=${value} class=${cn(inputClass(), 'col-span-2 h-8')}>
  </div>
`;

export default function PopoverDemo() {
  return html`
    <button type="button" popovertarget="popover-demo" aria-haspopup="dialog" aria-expanded="false" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Open popover</button>
    <div id="popover-demo" popover role="dialog" aria-labelledby="popover-demo-title" data-slot="popover-content" data-side="bottom" data-align="center" class=${cn(popoverContentClass(), 'w-80')}>
      <div class="grid gap-4">
        <div class="space-y-2">
          <h4 id="popover-demo-title" class="leading-none font-medium">Dimensions</h4>
          <p class="text-sm text-muted-foreground">
            Set the dimensions for the layer.
          </p>
        </div>
        <div class="grid gap-2">
          ${field('width', 'Width', '100%')}
          ${field('maxWidth', 'Max. width', '300px')}
          ${field('height', 'Height', '25px')}
          ${field('maxHeight', 'Max. height', 'none')}
        </div>
      </div>
    </div>
  `;
}
