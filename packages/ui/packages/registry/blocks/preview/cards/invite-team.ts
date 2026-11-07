/**
 * The preview block's invite card: two invites with a role each, an "Add
 * another" button, and a read-only invite link with a copy button. A
 * fragment helper, rendered by the server, with the kit's `<ui-select>`.
 * Installed by `npx @webjsdev/ui add preview` at
 * `components/preview/invite-team.ts`. Ported from shadcn/ui's preview block.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${sendInvites}>`) before you ship it.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { fieldClass, fieldLabelClass } from '../../../components/field.ts';
import { inputClass } from '../../../components/input.ts';
import {
  inputGroupAddonClass,
  inputGroupButtonClass,
  inputGroupClass,
  inputGroupInputClass,
} from '../../../components/input-group.ts';
import { selectTriggerClass } from '../../../components/select.ts';
import { separatorClass } from '../../../components/separator.ts';

const PlusIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;
const CopyIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;

const INVITES = [
  { email: 'alex@example.com', role: 'editor' },
  { email: 'sam@example.com', role: 'viewer' },
];

const ROLES: Array<[string, string]> = [['admin', 'Admin'], ['editor', 'Editor'], ['viewer', 'Viewer']];

export function inviteTeam() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Invite Team</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Add members to your workspace</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        <form id="invite-team-form" class="flex flex-col gap-3">
          ${INVITES.map((invite, i) => html`
            <div class="flex items-center gap-2">
              <input data-slot="input" type="email" name="email" value=${invite.email} aria-label=${`Invite ${i + 1} email`} class=${cn(inputClass(), 'flex-1')}>
              <ui-select position="popper">
                <select name="role" aria-label=${`Invite ${i + 1} role`} class=${cn(selectTriggerClass(), 'w-24')}>
                  ${ROLES.map(([value, text]) => html`<option value=${value} ?selected=${value === invite.role}>${text}</option>`)}
                </select>
              </ui-select>
            </div>
          `)}
        </form>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${PlusIcon()}Add another</button>
        <div data-slot="separator" data-orientation="horizontal" role="none" class=${separatorClass()}></div>
        <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
          <label data-slot="field-label" for="invite-team-link" class=${fieldLabelClass()}>Or share invite link</label>
          <div data-slot="input-group" role="group" class=${inputGroupClass()}>
            <input data-slot="input-group-control" id="invite-team-link" value="https://app.co/invite/x8f2k" readonly class=${inputGroupInputClass()}>
            <div data-slot="input-group-addon" data-align="inline-end" role="group" class=${inputGroupAddonClass({ align: 'inline-end' })}>
              <button type="button" aria-label="Copy link" data-slot="button" data-variant="ghost" data-size="icon-xs" class=${inputGroupButtonClass({ size: 'icon-xs' })}>${CopyIcon()}</button>
            </div>
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="submit" form="invite-team-form" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>Send Invites</button>
      </div>
    </div>
  `;
}
