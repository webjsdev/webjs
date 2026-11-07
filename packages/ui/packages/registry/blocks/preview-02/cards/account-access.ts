/**
 * The preview-02 Account Access card: an email and password form with a
 * danger zone link. A fragment helper. Installed by
 * `npx @webjsdev/ui add preview-02` at `components/preview-02/account-access.ts`.
 * Ported from shadcn/ui's preview-02.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${updateCredentials}>`) before you ship it.
 */
import { html } from '@webjsdev/core';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { fieldClass, fieldGroupClass, fieldLabelClass } from '../../../components/field.ts';
import { inputClass } from '../../../components/input.ts';
import {
  itemClass,
  itemContentClass,
  itemDescriptionClass,
  itemMediaClass,
  itemTitleClass,
} from '../../../components/item.ts';
import { cn } from '../../../lib/utils.ts';
import { AlertCircleIcon, ArrowRightIcon, LockKeyholeIcon } from '../../../lib/icons.ts';

export function accountAccess() {
  return html`
    <form data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Account Access</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Update your credentials or re-authenticate.</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="email-address" class=${fieldLabelClass()}>Email Address</label>
            <input data-slot="input" id="email-address" name="email" type="email" value="artist@studio.inc" class=${inputClass()}>
          </div>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <div class="flex items-center justify-between">
              <label data-slot="field-label" for="current-password" class=${fieldLabelClass()}>Current Password</label>
              <a href="#" class="text-xs font-medium tracking-wider text-muted-foreground uppercase hover:text-foreground">Forgot?</a>
            </div>
            <input data-slot="input" id="current-password" name="password" type="password" value="password123" class=${inputClass()}>
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-4')}>
        <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>
          ${LockKeyholeIcon()}
          Update Security
        </button>
        <a href="#" data-slot="item" data-variant="muted" data-size="default" class=${itemClass({ variant: 'muted' })}>
          <div data-slot="item-media" data-variant="icon" class=${itemMediaClass({ variant: 'icon' })}>${AlertCircleIcon('text-destructive')}</div>
          <div data-slot="item-content" class=${itemContentClass()}>
            <div data-slot="item-title" class=${itemTitleClass()}>Danger Zone</div>
            <p data-slot="item-description" class=${cn(itemDescriptionClass(), 'line-clamp-1')}>Archive account and remove catalog</p>
          </div>
          ${ArrowRightIcon('size-4')}
        </a>
      </div>
    </form>
  `;
}
