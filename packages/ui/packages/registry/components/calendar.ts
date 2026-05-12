import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';
import {
  addMonths,
  addYears,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfWeek,
  endOfWeek,
  startOfDay,
  isAfter,
  isBefore,
  setMonth,
  setYear,
  addDays,
  addWeeks,
} from 'date-fns';

/**
 * Calendar — shadcn-parity date picker.
 *
 *   <ui-calendar
 *     mode="single|range|multiple"
 *     month=${date.toISOString()}
 *     selected=${ /* Date | {from,to} | Date[] *\/ }
 *     view="month|year|decade"
 *     week-starts-on="0"
 *     locale="en-US"
 *     number-of-months="1"
 *     show-outside-days
 *     min=${minDate?.toISOString()}
 *     max=${maxDate?.toISOString()}
 *     disabled=${ /* Date[] | (d: Date) => boolean *\/ }
 *     @change=${(e) => setValue(e.detail.selected)}
 *   ></ui-calendar>
 *
 * Modes:
 *   single   — one date (default; backwards-compatible with v1 API)
 *   range    — { from, to } with hover preview between clicks
 *   multiple — toggle days in/out of an array
 *
 * Views (drill-up via header):
 *   month  → year (3×4 month grid) → decade (3×4 year grid)
 *
 * Keyboard: arrows move focus; PageUp/Down change month; Shift+PageUp/Down
 * change year; Home/End jump to start/end of week; Enter/Space selects.
 */

type Mode = 'single' | 'range' | 'multiple';
type View = 'month' | 'year' | 'decade';
type Range = { from?: Date; to?: Date };
type SelectedAny = Date | Range | Date[] | null;
type DisabledFn = (d: Date) => boolean;

function parseDateAttr(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseSelected(raw: unknown): SelectedAny {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return raw;
  if (Array.isArray(raw)) {
    const out: Date[] = [];
    for (const v of raw) {
      const d = v instanceof Date ? v : parseDateAttr(String(v));
      if (d) out.push(d);
    }
    return out;
  }
  if (typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const from = r.from instanceof Date ? r.from : parseDateAttr(r.from as string);
    const to = r.to instanceof Date ? r.to : parseDateAttr(r.to as string);
    return { from: from ?? undefined, to: to ?? undefined };
  }
  if (typeof raw === 'string') {
    // Try JSON, then ISO date, then comma-separated array.
    try {
      const parsed = JSON.parse(raw);
      return parseSelected(parsed);
    } catch {
      if (raw.includes(',')) {
        return raw.split(',').map((s) => parseDateAttr(s.trim())).filter(Boolean) as Date[];
      }
      const d = parseDateAttr(raw);
      return d;
    }
  }
  return null;
}

function sameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return !!a && !!b && isSameDay(a, b);
}

function inRange(d: Date, from?: Date, to?: Date): boolean {
  if (!from || !to) return false;
  const [a, b] = isAfter(from, to) ? [to, from] : [from, to];
  return !isBefore(startOfDay(d), startOfDay(a)) && !isAfter(startOfDay(d), startOfDay(b));
}

export class UiCalendar extends WebComponent {
  static properties = {
    mode: { type: String, reflect: true },
    month: { type: String, reflect: true },
    selected: { type: Object },
    view: { type: String, reflect: true },
    weekStartsOn: { type: Number, attribute: 'week-starts-on' },
    locale: { type: String, reflect: true },
    numberOfMonths: { type: Number, attribute: 'number-of-months' },
    showOutsideDays: { type: Boolean, attribute: 'show-outside-days' },
    min: { type: String, reflect: true },
    max: { type: String, reflect: true },
    disabled: { type: Object },
  };
  declare mode: Mode;
  declare month: string;
  declare selected: SelectedAny | string;
  declare view: View;
  declare weekStartsOn: number;
  declare locale: string;
  declare numberOfMonths: number;
  declare showOutsideDays: boolean;
  declare min: string;
  declare max: string;
  declare disabled: Date[] | DisabledFn | string | null;

  state: { focused: Date | null; hover: Date | null } = { focused: null, hover: null };

  constructor() {
    super();
    this.mode = 'single';
    this.month = new Date().toISOString();
    this.selected = null;
    this.view = 'month';
    this.weekStartsOn = 0;
    this.locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
    this.numberOfMonths = 1;
    this.showOutsideDays = true;
    this.min = '';
    this.max = '';
    this.disabled = null;
  }

  // ---------- accessors ----------

  _monthDate(): Date { return parseDateAttr(this.month) ?? new Date(); }
  _minDate(): Date | null { return parseDateAttr(this.min); }
  _maxDate(): Date | null { return parseDateAttr(this.max); }
  _selected(): SelectedAny { return parseSelected(this.selected); }

  _isDisabled(d: Date): boolean {
    const min = this._minDate();
    const max = this._maxDate();
    if (min && isBefore(startOfDay(d), startOfDay(min))) return true;
    if (max && isAfter(startOfDay(d), startOfDay(max))) return true;
    const dis = this.disabled;
    if (!dis) return false;
    if (typeof dis === 'function') return (dis as DisabledFn)(d);
    if (Array.isArray(dis)) return dis.some((x) => sameDay(x, d));
    if (typeof dis === 'string' && dis) {
      return dis.split(',').some((s) => sameDay(parseDateAttr(s.trim()), d));
    }
    return false;
  }

  _isSelected(d: Date): boolean {
    const sel = this._selected();
    if (!sel) return false;
    if (sel instanceof Date) return sameDay(sel, d);
    if (Array.isArray(sel)) return sel.some((x) => sameDay(x, d));
    const { from, to } = sel as Range;
    return sameDay(from, d) || sameDay(to, d);
  }

  _rangeBounds(): { from?: Date; to?: Date } {
    const sel = this._selected();
    if (!sel || sel instanceof Date || Array.isArray(sel)) return {};
    const { from, to } = sel;
    if (from && to && isAfter(from, to)) return { from: to, to: from };
    return { from, to };
  }

  // ---------- navigation ----------

  _shiftMonth = (delta: number) => { this.month = addMonths(this._monthDate(), delta).toISOString(); };
  _shiftYear = (delta: number) => { this.month = addYears(this._monthDate(), delta).toISOString(); };
  _shiftDecade = (delta: number) => { this.month = addYears(this._monthDate(), delta * 10).toISOString(); };

  _onHeaderClick = () => {
    this.view = this.view === 'month' ? 'year' : this.view === 'year' ? 'decade' : 'month';
  };

  // ---------- selection ----------

  _emit(selected: SelectedAny) {
    this.dispatchEvent(new CustomEvent('change', {
      detail: { selected, mode: this.mode, date: selected instanceof Date ? selected : undefined },
      bubbles: true, composed: true,
    }));
  }

  _select(d: Date) {
    if (this._isDisabled(d)) return;
    if (this.mode === 'single') {
      this.selected = d;
      this._emit(d);
      return;
    }
    if (this.mode === 'multiple') {
      const cur = (this._selected() as Date[] | null) ?? [];
      const arr = Array.isArray(cur) ? cur : [];
      const exists = arr.some((x) => sameDay(x, d));
      const next = exists ? arr.filter((x) => !sameDay(x, d)) : [...arr, d];
      this.selected = next;
      this._emit(next);
      return;
    }
    // range
    const sel = (this._selected() as Range | null) ?? {};
    let next: Range;
    if (!sel.from || (sel.from && sel.to)) {
      next = { from: d, to: undefined };
    } else {
      next = isBefore(d, sel.from) ? { from: d, to: sel.from } : { from: sel.from, to: d };
    }
    this.selected = next;
    this._emit(next);
  }

  _onMonthSelect = (monthIdx: number) => {
    this.month = setMonth(this._monthDate(), monthIdx).toISOString();
    this.view = 'month';
  };

  _onYearSelect = (year: number) => {
    this.month = setYear(this._monthDate(), year).toISOString();
    this.view = 'year';
  };

  // ---------- keyboard ----------

  _onKeyDown = (e: KeyboardEvent) => {
    if (this.view !== 'month') return;
    let f = this.state.focused ?? this._monthDate();
    const wasFocused = this.state.focused != null;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':  f = addDays(f, -1); break;
      case 'ArrowRight': f = addDays(f, 1); break;
      case 'ArrowUp':    f = addWeeks(f, -1); break;
      case 'ArrowDown':  f = addWeeks(f, 1); break;
      case 'Home':       f = startOfWeek(f, { weekStartsOn: this.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 }); break;
      case 'End':        f = endOfWeek(f, { weekStartsOn: this.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 }); break;
      case 'PageUp':     f = e.shiftKey ? addYears(f, -1) : addMonths(f, -1); break;
      case 'PageDown':   f = e.shiftKey ? addYears(f, 1) : addMonths(f, 1); break;
      case 'Enter':
      case ' ':          if (wasFocused) { this._select(f); } break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    if (!isSameMonth(f, this._monthDate())) this.month = f.toISOString();
    this.setState({ focused: f });
    queueMicrotask(() => {
      const btn = this.querySelector<HTMLButtonElement>('[data-focused="true"]');
      btn?.focus();
    });
  };

  _onHover = (d: Date | null) => {
    if (this.mode !== 'range') return;
    const sel = this._selected() as Range | null;
    if (!sel || !sel.from || sel.to) return;
    this.setState({ hover: d });
  };

  // ---------- locale ----------

  _weekdayLabels(): string[] {
    const out: string[] = [];
    const base = startOfWeek(new Date(), { weekStartsOn: this.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    const fmt = new Intl.DateTimeFormat(this.locale, { weekday: 'narrow' });
    for (let i = 0; i < 7; i++) out.push(fmt.format(addDays(base, i)));
    return out;
  }

  _monthLabel(d: Date): string {
    return new Intl.DateTimeFormat(this.locale, { month: 'long', year: 'numeric' }).format(d);
  }

  _monthShortName(idx: number): string {
    const d = setMonth(new Date(), idx);
    return new Intl.DateTimeFormat(this.locale, { month: 'short' }).format(d);
  }

  // ---------- render ----------

  render() {
    return html`
      <div
        data-slot="calendar"
        tabindex="0"
        @keydown=${this._onKeyDown}
        class=${cn('bg-background p-3 inline-block rounded-md select-none outline-none')}
      >
        ${this.view === 'month' ? this._renderMonthView()
          : this.view === 'year' ? this._renderYearView()
          : this._renderDecadeView()}
      </div>
    `;
  }

  _renderHeader(label: string, prev: () => void, next: () => void, headerClickable = true) {
    return html`
      <div class="flex items-center justify-between mb-4">
        <button
          type="button"
          aria-label="Previous"
          class=${cn('inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground')}
          @click=${prev}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <button
          type="button"
          ?disabled=${!headerClickable}
          @click=${headerClickable ? this._onHeaderClick : undefined}
          class=${cn(
            'text-sm font-medium px-2 py-1 rounded-md',
            headerClickable && 'hover:bg-accent hover:text-accent-foreground',
            !headerClickable && 'cursor-default',
          )}
        >${label}</button>
        <button
          type="button"
          aria-label="Next"
          class=${cn('inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground')}
          @click=${next}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    `;
  }

  _renderMonthView() {
    const n = Math.max(1, this.numberOfMonths || 1);
    const grids: ReturnType<typeof html>[] = [];
    for (let i = 0; i < n; i++) {
      grids.push(this._renderMonthGrid(addMonths(this._monthDate(), i), i === 0, i === n - 1));
    }
    return html`<div class="flex flex-col sm:flex-row gap-4">${grids}</div>`;
  }

  _renderMonthGrid(monthBase: Date, showPrev: boolean, showNext: boolean) {
    const weekdays = this._weekdayLabels();
    const monthStart = startOfMonth(monthBase);
    const monthEnd = endOfMonth(monthBase);
    const ws = this.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const gridStart = startOfWeek(monthStart, { weekStartsOn: ws });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: ws });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    return html`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          ${showPrev
            ? html`<button type="button" aria-label="Previous month" class=${cn('inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground')} @click=${() => this._shiftMonth(-1)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>`
            : html`<span class="size-7"></span>`}
          <button
            type="button"
            @click=${this._onHeaderClick}
            class=${cn('text-sm font-medium px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground')}
          >${this._monthLabel(monthBase)}</button>
          ${showNext
            ? html`<button type="button" aria-label="Next month" class=${cn('inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground')} @click=${() => this._shiftMonth(1)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>`
            : html`<span class="size-7"></span>`}
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
                ${week.map((d) => this._renderDay(d, monthBase))}
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderDay(d: Date, monthBase: Date) {
    const inMonth = isSameMonth(d, monthBase);
    if (!this.showOutsideDays && !inMonth) {
      return html`<td class="flex-1 p-0"><span class="inline-flex w-full h-8"></span></td>`;
    }
    const isSelected = this._isSelected(d);
    const isToday = isSameDay(d, new Date());
    const disabled = this._isDisabled(d);
    const focused = this.state.focused ? sameDay(this.state.focused, d) : (isSelected && this.mode === 'single');

    // Range styling
    let rangeStart = false, rangeEnd = false, rangeMiddle = false, rangePreview = false;
    if (this.mode === 'range') {
      const { from, to } = this._rangeBounds();
      if (from && to) {
        rangeStart = sameDay(d, from);
        rangeEnd = sameDay(d, to);
        rangeMiddle = !rangeStart && !rangeEnd && inRange(d, from, to);
      } else if (from && this.state.hover) {
        const previewEnd = this.state.hover;
        const [a, b] = isAfter(from, previewEnd) ? [previewEnd, from] : [from, previewEnd];
        rangeStart = sameDay(d, a);
        rangeEnd = sameDay(d, b);
        rangePreview = !rangeStart && !rangeEnd && inRange(d, a, b);
      } else if (from) {
        rangeStart = sameDay(d, from);
      }
    }

    return html`
      <td class="flex-1 p-0" data-range-preview=${rangePreview ? 'true' : 'false'}>
        <button
          type="button"
          ?disabled=${disabled}
          tabindex=${focused ? '0' : '-1'}
          aria-pressed=${isSelected ? 'true' : 'false'}
          aria-selected=${isSelected ? 'true' : 'false'}
          @click=${() => this._select(d)}
          @mouseenter=${() => this._onHover(d)}
          @mouseleave=${() => this._onHover(null)}
          @focus=${() => this.setState({ focused: d })}
          data-today=${isToday ? 'true' : 'false'}
          data-selected=${isSelected ? 'true' : 'false'}
          data-outside=${!inMonth ? 'true' : 'false'}
          data-focused=${focused ? 'true' : 'false'}
          data-range-start=${rangeStart ? 'true' : 'false'}
          data-range-end=${rangeEnd ? 'true' : 'false'}
          data-range-middle=${rangeMiddle ? 'true' : 'false'}
          class=${cn(
            'inline-flex w-full h-8 items-center justify-center text-sm transition-colors',
            'rounded-md hover:bg-accent hover:text-accent-foreground',
            'disabled:pointer-events-none disabled:opacity-50',
            disabled && 'cursor-not-allowed',
            !inMonth && 'text-muted-foreground opacity-50',
            isToday && !isSelected && !rangeStart && !rangeEnd && 'bg-accent/40',
            focused && 'ring-1 ring-ring',
            // single + multiple selected
            (this.mode !== 'range') && isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-md',
            // range styling — shadcn class strings
            rangeStart && 'bg-primary text-primary-foreground rounded-l-md hover:bg-primary hover:text-primary-foreground',
            rangeEnd && 'bg-primary text-primary-foreground rounded-r-md hover:bg-primary hover:text-primary-foreground',
            rangeMiddle && 'bg-accent text-accent-foreground rounded-none',
            rangePreview && 'bg-accent/50 text-accent-foreground rounded-none',
          )}
        >${d.getDate()}</button>
      </td>
    `;
  }

  _renderYearView() {
    const base = this._monthDate();
    const year = base.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i);
    return html`
      ${this._renderHeader(String(year), () => this._shiftYear(-1), () => this._shiftYear(1))}
      <div class="grid grid-cols-3 gap-2 w-64">
        ${months.map((m) => {
          const isCurrent = m === base.getMonth();
          const sel = this._selected();
          const isSelected = sel instanceof Date && sel.getFullYear() === year && sel.getMonth() === m;
          return html`
            <button
              type="button"
              @click=${() => this._onMonthSelect(m)}
              data-selected=${isSelected ? 'true' : 'false'}
              class=${cn(
                'inline-flex h-12 items-center justify-center rounded-md text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isCurrent && !isSelected && 'bg-accent/40',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
              )}
            >${this._monthShortName(m)}</button>
          `;
        })}
      </div>
    `;
  }

  _renderDecadeView() {
    const base = this._monthDate();
    const year = base.getFullYear();
    const decadeStart = year - (((year % 10) + 10) % 10);
    const years = Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i);
    const label = `${decadeStart} – ${decadeStart + 9}`;
    return html`
      ${this._renderHeader(label, () => this._shiftDecade(-1), () => this._shiftDecade(1))}
      <div class="grid grid-cols-3 gap-2 w-64">
        ${years.map((y) => {
          const isCurrent = y === year;
          const sel = this._selected();
          const isSelected = sel instanceof Date && isSameYear(sel, new Date(y, 0, 1));
          const muted = y < decadeStart || y > decadeStart + 9;
          return html`
            <button
              type="button"
              @click=${() => this._onYearSelect(y)}
              data-selected=${isSelected ? 'true' : 'false'}
              class=${cn(
                'inline-flex h-12 items-center justify-center rounded-md text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                muted && 'text-muted-foreground opacity-50',
                isCurrent && !isSelected && 'bg-accent/40',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
              )}
            >${y}</button>
          `;
        })}
      </div>
    `;
  }
}
UiCalendar.register('ui-calendar');

function chunks<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
