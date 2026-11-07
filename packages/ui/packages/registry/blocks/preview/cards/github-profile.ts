/**
 * The preview block's profile card: a name, a public email and a bio. A
 * fragment helper, rendered by the server. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/github-profile.ts`.
 * Ported from shadcn/ui's preview block.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${saveProfile}>`) before you ship it.
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
import { fieldClass, fieldDescriptionClass, fieldGroupClass, fieldLabelClass } from '../../../components/field.ts';
import { inputClass } from '../../../components/input.ts';
import { nativeSelectClass, nativeSelectIconClass, nativeSelectWrapperClass } from '../../../components/native-select.ts';
import { textareaClass } from '../../../components/textarea.ts';
import { ChevronDownIcon } from '../../../lib/icons.ts';

export function githubProfile() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto w-full max-w-md')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Profile</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Manage your profile information.</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <form id="profile">
          <div data-slot="field-group" class=${fieldGroupClass()}>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="field-label" for="profile-name" class=${fieldLabelClass()}>Name</label>
              <input data-slot="input" id="profile-name" name="name" placeholder="shadcn" class=${inputClass()}>
              <p data-slot="field-description" class=${fieldDescriptionClass()}>Your name may appear around GitHub where you contribute or are mentioned. You can remove it at any time.</p>
            </div>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="field-label" for="profile-email" class=${fieldLabelClass()}>Public Email</label>
              <div data-slot="native-select-wrapper" class=${nativeSelectWrapperClass()}>
                <select data-slot="native-select" id="profile-email" name="email" class=${nativeSelectClass()}>
                  <option value="m@shadcn.com">m@shadcn.com</option>
                  <option value="m@gmail.com">m@gmail.com</option>
                </select>
                ${ChevronDownIcon(nativeSelectIconClass())}
              </div>
              <p data-slot="field-description" class=${fieldDescriptionClass()}>You can manage verified email addresses in your <a href="#email-settings">email settings</a>.</p>
            </div>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="field-label" for="profile-bio" class=${fieldLabelClass()}>Bio</label>
              <textarea data-slot="textarea" id="profile-bio" name="bio" placeholder="Tell us a little bit about yourself" class=${textareaClass()}></textarea>
              <p data-slot="field-description" class=${fieldDescriptionClass()}>You can <span>@mention</span> other users and organizations to link to them.</p>
            </div>
          </div>
        </form>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="submit" form="profile" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'style-sera:w-full')}>Save Profile</button>
      </div>
    </div>
  `;
}
