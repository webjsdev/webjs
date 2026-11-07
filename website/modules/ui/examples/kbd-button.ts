import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { kbdClass } from '#modules/ui/components/kbd.ts';

export default function KbdButton() {
  return html`
    <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
      Accept${' '}
      <kbd data-slot="kbd" data-icon="inline-end" class=${cn(kbdClass(), 'translate-x-0.5')}><span aria-hidden="true">⏎</span><span class="sr-only">Enter</span></kbd>
    </button>
  `;
}
