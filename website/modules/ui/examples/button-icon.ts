import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { CircleFadingArrowUpIcon } from '#lib/ui/lucide.ts';

export default function ButtonIcon() {
  return html`
    <button type="button" data-slot="button" aria-label="Upgrade" class=${buttonClass({ variant: 'outline', size: 'icon' })}>${CircleFadingArrowUpIcon()}</button>
  `;
}
