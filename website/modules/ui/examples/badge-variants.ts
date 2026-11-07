import { html } from '@webjsdev/core';
import { badgeClass } from '#modules/ui/components/badge.ts';

export default function BadgeVariants() {
  return html`
    <div class="flex flex-wrap gap-2">
      <span data-slot="badge" data-variant="default" class=${badgeClass()}>Default</span>
      <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>Secondary</span>
      <span data-slot="badge" data-variant="destructive" class=${badgeClass({ variant: 'destructive' })}>Destructive</span>
      <span data-slot="badge" data-variant="outline" class=${badgeClass({ variant: 'outline' })}>Outline</span>
      <span data-slot="badge" data-variant="ghost" class=${badgeClass({ variant: 'ghost' })}>Ghost</span>
    </div>
  `;
}
