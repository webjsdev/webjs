import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass, cardFooterClass } from '#modules/ui/components/card.ts';
import { fieldClass, fieldGroupClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import { Clock2Icon } from '#lib/ui/lucide.ts';

const pad = (n: number) => String(n).padStart(2, '0');

const TIME_INPUT = 'appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none';

export default function CalendarWithTime() {
  const now = new Date();

  return html`
    <div data-slot="card" data-size="sm" class=${cn(cardClass({ size: 'sm' }), 'mx-auto w-fit')}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <ui-calendar
          mode="single"
          value=${now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-12'}
          class="*:data-[slot=calendar]:p-0"
        ></ui-calendar>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'border-t bg-card')}>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="time-from" class=${fieldLabelClass()}>Start Time</label>
            <div data-slot="input-group" role="group" class=${inputGroupClass()}>
              <input data-slot="input-group-control" id="time-from" type="time" step="1" value="10:30:00" class=${cn(inputGroupInputClass(), TIME_INPUT)}>
              <label data-slot="input-group-addon" data-align="inline-start" for="time-from" class=${inputGroupAddonClass()}>
                ${Clock2Icon('text-muted-foreground')}
              </label>
            </div>
          </div>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="time-to" class=${fieldLabelClass()}>End Time</label>
            <div data-slot="input-group" role="group" class=${inputGroupClass()}>
              <input data-slot="input-group-control" id="time-to" type="time" step="1" value="12:30:00" class=${cn(inputGroupInputClass(), TIME_INPUT)}>
              <label data-slot="input-group-addon" data-align="inline-start" for="time-to" class=${inputGroupAddonClass()}>
                ${Clock2Icon('text-muted-foreground')}
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
