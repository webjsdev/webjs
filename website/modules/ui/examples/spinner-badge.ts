import { html } from '@webjsdev/core';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { spinner } from '#modules/ui/components/spinner.ts';

export default function SpinnerBadge() {
  return html`
    <div class="flex items-center gap-4 [--radius:1.2rem]">
      <span data-slot="badge" data-variant="default" class=${badgeClass()}>
        ${spinner({ decorative: true })}
        Syncing
      </span>
      <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>
        ${spinner({ decorative: true })}
        Updating
      </span>
      <span data-slot="badge" data-variant="outline" class=${badgeClass({ variant: 'outline' })}>
        ${spinner({ decorative: true })}
        Processing
      </span>
    </div>
  `;
}
