/**
 * The preview-02 Front Door card: a smart lock's status over a striped live
 * camera placeholder. A fragment helper. Installed by
 * `npx @webjsdev/ui add preview-02` at `components/preview-02/front-door.ts`.
 * Ported from shadcn/ui's preview-02.
 */
import { html } from '@webjsdev/core';
import { badgeClass } from '../../../components/badge.ts';
import {
  cardActionClass,
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { cn } from '../../../lib/utils.ts';

const LockIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

export function frontDoor() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Front Door</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Smart Lock Pro</div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
            Locked
            ${LockIcon('size-4')}
          </div>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div class="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-muted bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,var(--border)_10px,var(--border)_11px)]">
          <span data-slot="badge" data-variant="destructive" class=${cn(badgeClass({ variant: 'destructive' }), 'absolute top-2 right-2')}>Live</span>
        </div>
      </div>
    </div>
  `;
}
