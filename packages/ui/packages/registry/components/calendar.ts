import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';
import { addMonths, startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isSameMonth, startOfWeek, endOfWeek, isAfter, isBefore } from 'date-fns';

/**
 * Calendar (date picker) — month grid view.
 *
 *   <ui-calendar
 *     month=${someDate.toISOString()}
 *     selected=${selectedDate?.toISOString()}
 *     min=${minDate?.toISOString()}
 *     max=${maxDate?.toISOString()}
 *     disabled-days="2026-05-12,2026-05-15"
 *     @change=${(e) => setDate(e.detail.date)}
 *   ></ui-calendar>
 *
 * v1 SCOPE: single-date selection, month view only. Prev/next chevrons
 * move by month. Days outside the current month render but are visually
 * muted.
 *
 * TODO(v2): range and multi-select modes, year/decade views, week
 * number column, week-start configurability beyond the date-fns default
 * (Sunday).
 */

function parseDateAttr(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export class UiCalendar extends WebComponent {
  static properties = {
    month: { type: String, reflect: true },
    selected: { type: String, reflect: true },
    min: { type: String, reflect: true },
    max: { type: String, reflect: true },
    disabledDays: { type: String, attribute: 'disabled-days' },
  };
  declare month: string;
  declare selected: string;
  declare min: string;
  declare max: string;
  declare disabledDays: string;

  constructor() {
    super();
    this.month = new Date().toISOString();
    this.selected = '';
    this.min = '';
    this.max = '';
    this.disabledDays = '';
  }

  _monthDate(): Date {
    return parseDateAttr(this.month) ?? new Date();
  }

  _selectedDate(): Date | null {
    return parseDateAttr(this.selected);
  }

  _minDate(): Date | null { return parseDateAttr(this.min); }
  _maxDate(): Date | null { return parseDateAttr(this.max); }

  _disabledSet(): Set<string> {
    if (!this.disabledDays) return new Set();
    return new Set(this.disabledDays.split(',').map((s) => {
      const d = parseDateAttr(s.trim());
      return d ? format(d, 'yyyy-MM-dd') : '';
    }).filter(Boolean));
  }

  _isDisabled(d: Date): boolean {
    const min = this._minDate();
    const max = this._maxDate();
    if (min && isBefore(d, min)) return true;
    if (max && isAfter(d, max)) return true;
    return this._disabledSet().has(format(d, 'yyyy-MM-dd'));
  }

  _prev = () => {
    this.month = addMonths(this._monthDate(), -1).toISOString();
  };

  _next = () => {
    this.month = addMonths(this._monthDate(), 1).toISOString();
  };

  _select(d: Date) {
    if (this._isDisabled(d)) return;
    this.selected = d.toISOString();
    this.dispatchEvent(new CustomEvent('change', { detail: { date: d }, bubbles: true, composed: true }));
  }

  render() {
    const month = this._monthDate();
    const selected = this._selectedDate();
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return html`
      <div
        data-slot="calendar"
        class=${cn('bg-background p-3 inline-block rounded-md select-none')}
      >
        <div class="flex items-center justify-between mb-4">
          <button
            type="button"
            aria-label="Previous month"
            class=${cn('inline-flex size-7 items-center justify-center rounded-md hover:bg-accent')}
            @click=${this._prev}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div class="text-sm font-medium">${format(month, 'MMMM yyyy')}</div>
          <button
            type="button"
            aria-label="Next month"
            class=${cn('inline-flex size-7 items-center justify-center rounded-md hover:bg-accent')}
            @click=${this._next}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
        <table class="w-full border-collapse">
          <thead>
            <tr class="flex">
              ${weekdays.map((d) => html`
                <th class="flex-1 rounded-md text-[0.8rem] font-normal text-muted-foreground select-none py-1">${d}</th>
              `)}
            </tr>
          </thead>
          <tbody>
            ${chunks(days, 7).map((week) => html`
              <tr class="mt-2 flex w-full">
                ${week.map((d) => this._renderDay(d, month, selected))}
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderDay(d: Date, month: Date, selected: Date | null) {
    const inMonth = isSameMonth(d, month);
    const isSelected = selected ? isSameDay(d, selected) : false;
    const isToday = isSameDay(d, new Date());
    const disabled = this._isDisabled(d);
    return html`
      <td class="flex-1 p-0">
        <button
          type="button"
          ?disabled=${disabled}
          aria-pressed=${isSelected ? 'true' : 'false'}
          @click=${() => this._select(d)}
          data-today=${isToday ? 'true' : 'false'}
          data-selected=${isSelected ? 'true' : 'false'}
          data-outside=${!inMonth ? 'true' : 'false'}
          class=${cn(
            'inline-flex w-full h-8 items-center justify-center rounded-md text-sm transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'disabled:pointer-events-none disabled:opacity-30',
            !inMonth && 'text-muted-foreground opacity-50',
            isToday && !isSelected && 'bg-accent/40',
            isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
          )}
        >${d.getDate()}</button>
      </td>
    `;
  }
}
UiCalendar.register('ui-calendar');

function chunks<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
