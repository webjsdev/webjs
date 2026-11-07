/**
 * The preview-02 "Distribute Track" empty state: a card holding the kit's
 * empty state with a create button. A fragment helper. Installed at
 * `components/preview-02/empty-distribute-track.ts`. Ported from shadcn/ui's
 * preview-02.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import { cardClass, cardContentClass } from '../../../components/card.ts';
import {
  emptyClass,
  emptyContentClass,
  emptyDescriptionClass,
  emptyHeaderClass,
  emptyMediaClass,
  emptyTitleClass,
} from '../../../components/empty.ts';

const PlusIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;

export function emptyDistributeTrack() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="empty" class=${cn(emptyClass(), 'p-4')}>
          <div data-slot="empty-icon" data-variant="icon" class=${emptyMediaClass({ variant: 'icon' })}>${PlusIcon()}</div>
          <div data-slot="empty-header" class=${emptyHeaderClass()}>
            <div data-slot="empty-title" class=${emptyTitleClass()}>Distribute Track</div>
            <p data-slot="empty-description" class=${emptyDescriptionClass()}>Upload your first master to start reaching listeners on Spotify, Apple Music, and more.</p>
          </div>
          <div data-slot="empty-content" class=${emptyContentClass()}>
            <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Create Release</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
