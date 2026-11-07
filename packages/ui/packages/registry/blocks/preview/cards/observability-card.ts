/**
 * The preview block's observability card: a tinted cover photo over an
 * announcement, with a call to action and a status badge. A fragment helper,
 * rendered by the server. Installed by `npx @webjsdev/ui add preview` at
 * `components/preview/observability-card.ts`. Ported from shadcn/ui's preview
 * block.
 *
 * The cover is shadcn's Unsplash photo (by mymind). Swap in your own image.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { badgeClass } from '../../../components/badge.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';

const PlusIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;

const COVER = 'https://images.unsplash.com/photo-1604076850742-4c7221f3101b?q=80&w=1887&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

export function observabilityCard() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'relative w-full max-w-md overflow-hidden pt-0')}>
      <div class="absolute inset-0 z-30 aspect-video bg-primary opacity-50 mix-blend-color"></div>
      <img src=${COVER} alt="Photo by mymind on Unsplash" title="Photo by mymind on Unsplash" class="relative z-20 aspect-video w-full object-cover brightness-60 grayscale">
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Observability Plus is replacing Monitoring</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>
          Switch to the improved way to explore your data, with natural
          language. Monitoring will no longer be available on the Pro plan in
          November, 2025
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Create Query ${PlusIcon()}</button>
        <span data-slot="badge" data-variant="secondary" class=${cn(badgeClass({ variant: 'secondary' }), 'ml-auto')}>Warning</span>
      </div>
    </div>
  `;
}
