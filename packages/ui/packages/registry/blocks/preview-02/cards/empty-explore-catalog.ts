/**
 * The preview-02 Explore Catalog card: an empty state pointing at the
 * catalog review. A fragment helper. Installed by
 * `npx @webjsdev/ui add preview-02` at
 * `components/preview-02/empty-explore-catalog.ts`. Ported from shadcn/ui's
 * preview-02.
 */
import { html } from '@webjsdev/core';
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
import { cn } from '../../../lib/utils.ts';
import { AudioLinesIcon } from '../../../lib/icons.ts';

export function emptyExploreCatalog() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="empty" class=${cn(emptyClass(), 'p-4')}>
          <div data-slot="empty-icon" data-variant="icon" aria-hidden="true" class=${emptyMediaClass({ variant: 'icon' })}>${AudioLinesIcon()}</div>
          <div data-slot="empty-header" class=${emptyHeaderClass()}>
            <div data-slot="empty-title" class=${emptyTitleClass()}>Explore Catalog</div>
            <div data-slot="empty-description" class=${emptyDescriptionClass()}>Check your ISRC codes, metadata, and visual assets before going live.</div>
          </div>
          <div data-slot="empty-content" class=${emptyContentClass()}>
            <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>View Catalog</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
