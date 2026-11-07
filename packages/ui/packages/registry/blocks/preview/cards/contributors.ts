/**
 * The preview block's contributors card: a count badge over a wall of
 * contributor avatars, and a link to the rest. A fragment helper, rendered by
 * the server. Installed by `npx @webjsdev/ui add preview` at
 * `components/preview/contributors.ts`. Ported from shadcn/ui's preview block.
 *
 * The avatars are GitHub profile pictures by username. Replace the list with
 * your own contributors.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { avatarClass, avatarFallbackClass, avatarImageClass } from '../../../components/avatar.ts';
import { badgeClass } from '../../../components/badge.ts';
import {
  cardClass,
  cardContentClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';

// GitHub usernames shown as contributor avatars.
const USERNAMES = [
  'shadcn', 'vercel', 'nextjs', 'tailwindlabs', 'typescript-lang', 'eslint', 'prettier', 'babel',
  'webpack', 'rollup', 'parcel', 'vite', 'react', 'vue', 'angular', 'solid',
];

export function contributors() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'max-w-sm')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>
          Contributors <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>312</span>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div class="flex flex-wrap gap-2">
          ${USERNAMES.map((username) => html`
            <span data-slot="avatar" data-size="default" class=${cn(avatarClass(), 'grayscale')}>
              <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>${username.charAt(0)}</span>
              <img data-slot="avatar-image" src=${`https://github.com/${username}.png`} alt=${username} class=${avatarImageClass()}>
            </span>
          `)}
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <a href="#" class="text-sm underline underline-offset-4">+ 810 contributors</a>
      </div>
    </div>
  `;
}
