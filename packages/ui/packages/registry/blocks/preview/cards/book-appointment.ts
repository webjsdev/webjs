/**
 * The preview block's appointment card: the day's time slots as a toggle
 * group, a note for new patients, and a booking button. A fragment helper;
 * the slots are the kit's `<ui-toggle-group>`. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/book-appointment.ts`.
 * Ported from shadcn/ui's preview block.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { alertClass, alertDescriptionClass, alertTitleClass } from '../../../components/alert.ts';
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
import '../../../components/toggle-group.ts';

const SLOTS = ['9:00 AM', '10:30 AM', '11:00 AM', '1:30 PM'];

export function bookAppointment() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Book Appointment</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Dr. Sarah Chen · Cardiology</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <div data-slot="field-label" id="book-appointment-slots" class=${fieldLabelClass()}>Available on March 18, 2026</div>
            <ui-toggle-group type="multiple" spacing="2" value="slot-0" aria-labelledby="book-appointment-slots">
              ${SLOTS.map((time, index) => html`<ui-toggle-group-item value=${`slot-${index}`}>${time}</ui-toggle-group-item>`)}
            </ui-toggle-group>
          </div>
        </div>
        <div role="alert" data-slot="alert" data-variant="default" class=${alertClass()}>
          <div data-slot="alert-title" class=${alertTitleClass()}>New patient?</div>
          <div data-slot="alert-description" class=${alertDescriptionClass()}>Please arrive 15 minutes early.</div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>Book Appointment</button>
      </div>
    </div>
  `;
}
