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

const LockKeyholeIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="16" r="1"></circle><rect x="3" y="10" width="18" height="12" rx="2"></rect><path d="M7 10V7a5 5 0 0 1 10 0v3"></path></svg>`;
const AlertCircleIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg>`;
const ArrowRightIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>`;

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
