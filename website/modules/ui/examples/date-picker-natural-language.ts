import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { CalendarIcon } from '#lib/ui/lucide.ts';

function formatDate(date: Date | undefined) {
  if (!date) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// shadcn parses the text with chrono-node. The kit ships no parser, so this
// shows the first paint for "In 2 days": the date it resolves to, worked out
// here. Parsing what the reader types is yours to add (any date library).
export default function DatePickerNaturalLanguage() {
  const value = 'In 2 days';
  const date = new Date();
  date.setDate(date.getDate() + 2);
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'mx-auto max-w-xs')}>
      <label data-slot="field-label" for="date-optional" class=${fieldLabelClass()}>Schedule Date</label>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input
          data-slot="input-group-control"
          id="date-optional"
          value=${value}
          placeholder="Tomorrow or next week"
          class=${inputGroupInputClass()}
        >
        <div role="group" data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <button
            type="button"
            id="date-picker-natural"
            popovertarget="date-picker-natural-content"
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-label="Select date"
            data-slot="button"
            data-variant="ghost"
            data-size="icon-xs"
            class=${inputGroupButtonClass({ size: 'icon-xs', variant: 'ghost' })}
          >
            ${CalendarIcon()}
            <span class="sr-only">Select date</span>
          </button>
          <div id="date-picker-natural-content" popover role="dialog" aria-label="Select date" data-slot="popover-content" class=${cn(popoverContentClass({ align: 'end', sideOffset: 8 }), 'w-auto overflow-hidden p-0')}>
            <ui-calendar mode="single" caption-layout="dropdown" value=${iso} month=${iso.slice(0, 7)}></ui-calendar>
          </div>
        </div>
      </div>
      <div class="px-1 text-sm text-muted-foreground">
        Your post will be published on
        <span class="font-medium">${formatDate(date)}</span>.
      </div>
    </div>
  `;
}
