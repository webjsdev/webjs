/**
 * The preview-02 Connect Bank card: an empty state asking to set up payouts.
 * A fragment helper. Installed by `npx @webjsdev/ui add preview-02` at
 * `components/preview-02/empty-connect-bank.ts`. Ported from shadcn/ui's
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

const CreditCardIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" x2="22" y1="10" y2="10"></line></svg>`;

export function emptyConnectBank() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="empty" class=${cn(emptyClass(), 'p-4')}>
          <div data-slot="empty-icon" data-variant="icon" aria-hidden="true" class=${emptyMediaClass({ variant: 'icon' })}>${CreditCardIcon()}</div>
          <div data-slot="empty-header" class=${emptyHeaderClass()}>
            <div data-slot="empty-title" class=${emptyTitleClass()}>Connect Bank</div>
            <div data-slot="empty-description" class=${emptyDescriptionClass()}>Link your payout method to receive monthly royalty distributions automatically.</div>
          </div>
          <div data-slot="empty-content" class=${emptyContentClass()}>
            <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Set Up Payouts</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
