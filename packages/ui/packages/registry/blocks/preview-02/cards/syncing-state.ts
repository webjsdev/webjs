/**
 * The preview-02 "Syncing your accounts" card: the kit's empty state with a
 * spinner as its media. A fragment helper. Installed at
 * `components/preview-02/syncing-state.ts`. Ported from shadcn/ui's preview-02.
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
import { spinner } from '../../../components/spinner.ts';

export function syncingState() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'p-0')}>
        <div data-slot="empty" class=${cn(emptyClass(), 'p-4')}>
          <div data-slot="empty-header" class=${emptyHeaderClass()}>
            <div data-slot="empty-icon" data-variant="icon" class=${emptyMediaClass({ variant: 'icon' })}>${spinner({ decorative: true })}</div>
            <div data-slot="empty-title" class=${emptyTitleClass()}>Syncing your accounts</div>
            <p data-slot="empty-description" class=${emptyDescriptionClass()}>We're pulling in your latest transactions. This usually takes a few seconds.</p>
          </div>
          <div data-slot="empty-content" class=${emptyContentClass()}>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
