/**
 * The preview block's empty team card: a stack of avatars over "No Team
 * Members" and an invite button. A fragment helper, rendered by the server.
 * Installed by `npx @webjsdev/ui add preview` at
 * `components/preview/no-team-members.ts`. Ported from shadcn/ui's preview
 * block.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  avatarClass,
  avatarFallbackClass,
  avatarGroupClass,
  avatarImageClass,
} from '../../../components/avatar.ts';
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

const MEMBERS = [
  { src: 'https://webjs.dev/public/avatars/vivek.jpg', alt: '@vivek', fallback: 'VK' },
  { src: 'https://github.com/maxleiter.png', alt: '@maxleiter', fallback: 'LR' },
  { src: 'https://github.com/evilrabbit.png', alt: '@evilrabbit', fallback: 'ER' },
];

export function noTeamMembers() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="empty" class=${cn(emptyClass(), 'h-56 border')}>
          <div data-slot="empty-header" class=${emptyHeaderClass()}>
            <div data-slot="empty-icon" data-variant="default" class=${emptyMediaClass()}>
              <div data-slot="avatar-group" class=${cn(avatarGroupClass(), 'grayscale')}>
                ${MEMBERS.map((m) => html`
                  <span data-slot="avatar" data-size="lg" class=${avatarClass({ size: 'lg' })}>
                    <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>${m.fallback}</span>
                    <img data-slot="avatar-image" src=${m.src} alt=${m.alt} class=${avatarImageClass()}>
                  </span>
                `)}
              </div>
            </div>
            <div data-slot="empty-title" class=${emptyTitleClass()}>No Team Members</div>
            <div data-slot="empty-description" class=${emptyDescriptionClass()}>
              Invite your team to collaborate on this project.
            </div>
          </div>
          <div data-slot="empty-content" class=${emptyContentClass()}>
            <button type="button" data-slot="button" data-variant="default" data-size="sm" class=${buttonClass({ size: 'sm' })}>Invite Members</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
