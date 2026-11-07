import { html } from '@webjsdev/core';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { spinner } from '#modules/ui/components/spinner.ts';

export default function BadgeWithSpinner() {
  return html`
    <div class="flex flex-wrap gap-2">
      <span data-slot="badge" data-variant="destructive" class=${badgeClass({ variant: 'destructive' })}>
        ${spinner({ decorative: true })}
        Deleting
      </span>
      <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>
        Generating
        ${spinner({ decorative: true })}
      </span>
    </div>
  `;
}
