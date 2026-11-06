import { html } from '@webjsdev/core';
import { badgeClass } from '#modules/ui/components/badge.ts';

export default function BadgeDemo() {
  return html`
    <div class="flex w-full flex-wrap justify-center gap-2">
      <span data-slot="badge" data-variant="default" class=${badgeClass()}>Badge</span>
      <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>Secondary</span>
      <span data-slot="badge" data-variant="destructive" class=${badgeClass({ variant: 'destructive' })}>Destructive</span>
      <span data-slot="badge" data-variant="outline" class=${badgeClass({ variant: 'outline' })}>Outline</span>
    </div>
  `;
}
