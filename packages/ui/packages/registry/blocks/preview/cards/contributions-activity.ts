/**
 * The preview block's contributions and activity card: one privacy setting as
 * a checkbox with its description. A fragment helper, rendered by the server.
 * Installed by `npx @webjsdev/ui add preview` at
 * `components/preview/contributions-activity.ts`. Ported from shadcn/ui's
 * preview block.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${saveActivity}>`) before you ship it.
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
import { checkboxClass } from '../../../components/checkbox.ts';
import {
  fieldClass,
  fieldContentClass,
  fieldDescriptionClass,
  fieldGroupClass,
  fieldLabelClass,
  fieldLegendClass,
  fieldSetClass,
} from '../../../components/field.ts';

export function contributionsActivity() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Contributions &amp; Activity</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Manage your contributions and activity visibility.</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <form id="contributions-activity">
          <div data-slot="field-group" class=${fieldGroupClass()}>
            <fieldset data-slot="field-set" class=${fieldSetClass()}>
              <legend data-slot="field-legend" data-variant="legend" class=${cn(fieldLegendClass(), 'sr-only')}>Contributions &amp; activity</legend>
              <div data-slot="field-group" class=${fieldGroupClass()}>
                <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
                  <input type="checkbox" data-slot="checkbox" id="activity-private-profile" name="private-profile" aria-describedby="activity-private-profile-description" class=${checkboxClass()}>
                  <div data-slot="field-content" class=${fieldContentClass()}>
                    <label data-slot="field-label" for="activity-private-profile" class=${fieldLabelClass()}>Make profile private and hide activity</label>
                    <p data-slot="field-description" id="activity-private-profile-description" class=${fieldDescriptionClass()}>Enabling this will hide your contributions and activity from your GitHub profile and from social features like followers, stars, feeds, leaderboards and releases.</p>
                  </div>
                </div>
              </div>
            </fieldset>
          </div>
        </form>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="submit" form="contributions-activity" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'style-sera:w-full')}>Save Changes</button>
      </div>
    </div>
  `;
}
