/**
 * The preview-02 Cover Art card: an image drop target over a real file
 * input, with an upload button that opens the same input. A fragment helper.
 * Installed by `npx @webjsdev/ui add preview-02` at
 * `components/preview-02/cover-art.ts`. Ported from shadcn/ui's preview-02.
 *
 * Wrap it in a `<form enctype="multipart/form-data">` bound to your upload
 * action, and the file input submits with it.
 */
import { html } from '@webjsdev/core';
import { buttonClass } from '../../../components/button.ts';
import { cardClass, cardContentClass, cardDescriptionClass, cardFooterClass } from '../../../components/card.ts';
import { itemClass } from '../../../components/item.ts';
import { labelClass } from '../../../components/label.ts';
import { cn } from '../../../lib/utils.ts';

const ImageIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>`;

export function coverArt() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-3')}>
        <label data-slot="label" for="cover-art" class=${cn(labelClass(), 'text-center text-xs font-normal tracking-wider text-muted-foreground uppercase')}>Cover Art</label>
        <div data-slot="item" data-variant="outline" data-size="default" class=${cn(itemClass({ variant: 'outline' }), 'aspect-square')}>
          <label for="cover-art" class="flex size-full cursor-pointer items-center justify-center">
            ${ImageIcon('size-10 text-muted-foreground/50')}
            <span class="sr-only">Choose cover art</span>
          </label>
        </div>
        <input id="cover-art" name="cover-art" type="file" accept="image/jpeg,image/png" class="sr-only">
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-2')}>
        <label for="cover-art" data-slot="button" data-variant="secondary" data-size="default" class=${cn(buttonClass({ variant: 'secondary' }), 'w-full cursor-pointer')}>Upload Artwork</label>
        <div data-slot="card-description" class=${cn(cardDescriptionClass(), 'text-center text-xs')}>
          Minimum 3000 × 3000px
          <br>
          JPEG or PNG only
        </div>
      </div>
    </div>
  `;
}
