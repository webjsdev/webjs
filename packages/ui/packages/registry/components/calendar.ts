/**
 * Calendar: a month grid for picking a date, several dates, or a range.
 * Tier-2. shadcn's is react-day-picker; this is the same grid hand-rolled on
 * `Intl.DateTimeFormat`, with no dependency. The server renders the month, so
 * the grid is in the first paint; picking needs JavaScript.
 *
 * shadcn parity:
 *   Calendar mode="single" | "multiple" | "range"
 *                            → <ui-calendar mode value>
 *   selected                 → `value`: "2025-06-12"; for multiple a comma list;
 *                              for range "2025-06-12/2025-06-20"
 *   month / defaultMonth     → `month`: "2025-06" (the first month shown)
 *   numberOfMonths           → `number-of-months`
 *   showOutsideDays          → `show-outside-days="false"` hides them (shown by default)
 *   weekStartsOn             → `week-starts-on` (0 is Sunday, the default)
 *   showWeekNumber           → `show-week-number` (a leading column of week numbers)
 *   ISOWeek                  → `iso-week` (ISO 8601 weeks: Monday first, ISO numbers)
 *   captionLayout="dropdown" → `caption-layout="dropdown"` (month and year selects)
 *   disabled / startMonth / endMonth
 *                            → `min` / `max` ("2025-01-01"), and `disabled` for the whole grid
 *   locale                   → `locale` (a BCP 47 tag), else the page's `lang`
 *   onSelect                 → `ui-value-change` ({ detail: { value } }): a date string, a
 *                              string array, or { from, to } for a range
 *   onMonthChange            → `ui-month-change` ({ detail: { month } })
 *
 * With `name`, the value also rides hidden inputs, so a form submits it: one
 * input for a single date, one per date for multiple, and `name[from]` /
 * `name[to]` for a range.
 *
 * Keyboard (the WAI-ARIA date grid): one day is in the tab order. The arrows
 * move a day or a week (left and right swap under `dir="rtl"`), Home / End go
 * to the week's ends, PageUp / PageDown change the month and with Shift the
 * year, and Enter or Space picks. Moving past the shown months turns the page.
 *
 * A11y (handled by the element): each month is a `role="grid"` labelled by its
 * caption, every day button is named by its full date (and says "Today" and
 * "selected"), days outside `min` / `max` are disabled, and the previous and
 * next buttons are named.
 *
 * @example
 * ```html
 * <ui-calendar mode="single" value="2025-06-12" class="rounded-lg border"></ui-calendar>
 *
 * <ui-calendar mode="range" value="2025-06-12/2025-06-20" number-of-months="2" name="stay"></ui-calendar>
 * ```
 */
import { WebComponent, html, prop, signal } from '@webjsdev/core';
import { cn } from '../lib/utils.ts';
import { buttonClass } from './button.ts';

// --------------------------------------------------------------------------
// Date maths, all on UTC calendar dates written as YYYY-MM-DD, so a timezone
// can never move a day.
// --------------------------------------------------------------------------

/** A date-only value: the calendar's unit. */
export type CalendarDate = { y: number; m: number; d: number };

/** Parse "YYYY-MM-DD" (or "YYYY-MM", day 1); null when it is not a date. */
export function parseDate(s: string | null | undefined): CalendarDate | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec((s ?? '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = m[3] ? Number(m[3]) : 1;
  const t = new Date(Date.UTC(y, mo, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo || t.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

/** Format as "YYYY-MM-DD". */
export function formatDate(c: CalendarDate): string {
  return `${String(c.y).padStart(4, '0')}-${String(c.m + 1).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`;
}

function toUTC(c: CalendarDate): Date {
  return new Date(Date.UTC(c.y, c.m, c.d));
}

function fromUTC(t: Date): CalendarDate {
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}

/** `c` moved by `days`. */
export function addDays(c: CalendarDate, days: number): CalendarDate {
  const t = toUTC(c);
  t.setUTCDate(t.getUTCDate() + days);
  return fromUTC(t);
}

/** `c` moved by `months`, clamped to the last day of the target month. */
export function addMonths(c: CalendarDate, months: number): CalendarDate {
  const first = new Date(Date.UTC(c.y, c.m + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return { y: first.getUTCFullYear(), m: first.getUTCMonth(), d: Math.min(c.d, last) };
}

/** -1, 0 or 1. */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

/** Whether `a` and `b` are the same day. */
export function sameDay(a: CalendarDate | null, b: CalendarDate | null): boolean {
  return !!a && !!b && compareDates(a, b) === 0;
}

/**
 * The weeks of a month as rows of seven days, starting on `weekStartsOn`
 * (0 Sunday). Days of the neighbouring months fill the first and last rows;
 * there are only as many rows as the month needs.
 */
export function monthWeeks(y: number, m: number, weekStartsOn = 0): CalendarDate[][] {
  const first = { y, m, d: 1 };
  const lead = (toUTC(first).getUTCDay() - weekStartsOn + 7) % 7;
  const daysIn = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const total = Math.ceil((lead + daysIn) / 7) * 7;
  const start = addDays(first, -lead);
  const weeks: CalendarDate[][] = [];
  for (let i = 0; i < total; i += 7) {
    weeks.push(Array.from({ length: 7 }, (_, j) => addDays(start, i + j)));
  }
  return weeks;
}

/**
 * The number of the week `date` falls in, as the calendar labels a row, the
 * way react-day-picker numbers it. By default week 1 is the week holding
 * January 1, with weeks counted from `weekStartsOn` (date-fns getWeek, with
 * the en-US first week). With `iso` the week is ISO 8601's: weeks start on
 * Monday and week 1 holds the year's first Thursday (date-fns getISOWeek),
 * whatever `weekStartsOn` says.
 */
export function weekNumber(date: CalendarDate, weekStartsOn = 0, iso = false): number {
  const DAY = 86400000;
  const start = iso ? 1 : weekStartsOn;
  // The day of January that week 1 must contain.
  const anchor = iso ? 4 : 1;
  const startOfWeek = (ms: number): number => ms - ((new Date(ms).getUTCDay() - start + 7) % 7) * DAY;
  const at = Date.UTC(date.y, date.m, date.d);
  const firstOf = (y: number): number => startOfWeek(Date.UTC(y, 0, anchor));
  const year = at >= firstOf(date.y + 1) ? date.y + 1 : at >= firstOf(date.y) ? date.y : date.y - 1;
  return Math.round((startOfWeek(at) - firstOf(year)) / (7 * DAY)) + 1;
}

/** A range in progress or complete. */
export type CalendarRange = { from: CalendarDate | null; to: CalendarDate | null };

/**
 * The range after picking `day`: the first pick starts it, the second ends
 * it (swapping if it lies before the start), and a pick on a complete range
 * starts a new one.
 */
export function addToRange(range: CalendarRange, day: CalendarDate): CalendarRange {
  const { from, to } = range;
  if (!from || (from && to)) return { from: day, to: null };
  if (compareDates(day, from) < 0) return { from: day, to: from };
  return { from, to: day };
}

// --------------------------------------------------------------------------
// Classes
// --------------------------------------------------------------------------

/** The root's classes (the element applies them). */
export function calendarClass(): string {
  return 'cn-calendar group/calendar bg-background in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent rtl:**:[.rdp-button-next>svg]:rotate-180 rtl:**:[.rdp-button-previous>svg]:rotate-180';
}
/** A month caption's label. */
export const calendarCaptionClass = (): string => 'cn-calendar-caption text-sm';
// shadcn names the dropdown caption's box and label `cn-calendar-dropdown-root`
// and `cn-calendar-caption-label`, but its build bakes only the first name of
// each component file, so `shadcn add` leaves both unstyled in every style and
// ui.shadcn.com draws neither a border nor a padded label. The kit gives them
// names only new-york maps, which keeps new-york's bordered dropdowns and
// matches shadcn's output in the other styles.
/** A dropdown caption's visible label. */
export const calendarCaptionLabelClass = (): string =>
  'cn-calendar-dropdown-label flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground';
/** A caption dropdown's box. */
export const calendarDropdownRootClass = (): string => 'cn-calendar-dropdown-box relative rounded-(--cell-radius)';
/** A day button's classes (the element applies them). */
export const calendarDayButtonClass = (): string =>
  'cn-calendar-day-button relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-e-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-s-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70';

const NAV_BUTTON = 'size-(--cell-size) p-0 select-none aria-disabled:opacity-50';

// --------------------------------------------------------------------------
// <ui-calendar>
// --------------------------------------------------------------------------

let uid = 0;

export class UiCalendar extends WebComponent({
  mode: prop<'single' | 'multiple' | 'range'>(String),
  value: String,
  name: String,
  month: String,
  numberOfMonths: prop(Number, { attribute: 'number-of-months' }),
  showOutsideDays: prop(String, { attribute: 'show-outside-days' }),
  weekStartsOn: prop(Number, { attribute: 'week-starts-on' }),
  showWeekNumber: prop(Boolean, { attribute: 'show-week-number' }),
  isoWeek: prop(Boolean, { attribute: 'iso-week' }),
  captionLayout: prop<'label' | 'dropdown'>(String, { attribute: 'caption-layout' }),
  min: String,
  max: String,
  disabled: Boolean,
  locale: String,
}) {
  // The live state: what is chosen, which month is shown, which day has focus.
  readonly #selection = signal<{ days: string[]; from: string; to: string }>({ days: [], from: '', to: '' });
  readonly #shown = signal('');
  readonly #focused = signal('');
  _id = '';
  _parsed = false;

  constructor() {
    super();
    this.mode = 'single';
    this.value = '';
    this.name = '';
    this.month = '';
    this.numberOfMonths = 1;
    this.showOutsideDays = 'true';
    this.weekStartsOn = 0;
    this.showWeekNumber = false;
    this.isoWeek = false;
    this.captionLayout = 'label';
    this.min = '';
    this.max = '';
    this.disabled = false;
    this.locale = '';
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    this._id ||= `ui-calendar-${++uid}`;
  }

  // Read the attributes into state once, on the first render (server or client).
  willUpdate(changedProperties: Map<string, unknown>): void {
    super.willUpdate?.(changedProperties);
    if (this._parsed) return;
    this._parsed = true;
    const v = this.value ?? '';
    if (this.mode === 'range') {
      const [a, b] = v.split('/');
      const from = parseDate(a);
      const to = parseDate(b);
      this.#selection.set({ days: [], from: from ? formatDate(from) : '', to: to ? formatDate(to) : '' });
    } else {
      const days = (this.mode === 'multiple' ? v.split(',') : [v]).map(parseDate).filter((d): d is CalendarDate => !!d).map(formatDate);
      this.#selection.set({ days, from: '', to: '' });
    }
    const anchor = parseDate(this.month) ?? parseDate(this.#selection.get().from || this.#selection.get().days[0]) ?? this._today();
    this.#shown.set(formatDate({ y: anchor.y, m: anchor.m, d: 1 }));
  }

  _today(): CalendarDate {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
  }

  _locale(): string {
    if (this.locale) return this.locale;
    const lang = typeof document !== 'undefined' ? document.documentElement?.lang : '';
    return lang || 'en-US';
  }

  _fmt(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(this._locale(), { ...opts, timeZone: 'UTC' });
  }

  _min(): CalendarDate | null {
    return parseDate(this.min);
  }

  _max(): CalendarDate | null {
    return parseDate(this.max);
  }

  _isDisabled(day: CalendarDate): boolean {
    if (this.disabled) return true;
    const lo = this._min();
    const hi = this._max();
    return (!!lo && compareDates(day, lo) < 0) || (!!hi && compareDates(day, hi) > 0);
  }

  _first(): CalendarDate {
    return parseDate(this.#shown.get()) ?? this._today();
  }

  /** The value in the shape `ui-value-change` reports. */
  get selected(): string | string[] | { from: string; to: string } {
    const s = this.#selection.get();
    if (this.mode === 'range') return { from: s.from, to: s.to };
    if (this.mode === 'multiple') return [...s.days];
    return s.days[0] ?? '';
  }

  /** Pick `iso`, as a click or Enter does. */
  pick(iso: string): void {
    const day = parseDate(iso);
    if (!day || this._isDisabled(day)) return;
    const s = this.#selection.get();
    if (this.mode === 'range') {
      const next = addToRange({ from: parseDate(s.from), to: parseDate(s.to) }, day);
      this.#selection.set({ days: [], from: next.from ? formatDate(next.from) : '', to: next.to ? formatDate(next.to) : '' });
    } else if (this.mode === 'multiple') {
      const days = s.days.includes(iso) ? s.days.filter((d) => d !== iso) : [...s.days, iso].sort();
      this.#selection.set({ days, from: '', to: '' });
    } else {
      this.#selection.set({ days: s.days[0] === iso ? [] : [iso], from: '', to: '' });
    }
    this.#focused.set(iso);
    this.dispatchEvent(new CustomEvent('ui-value-change', { bubbles: true, detail: { value: this.selected } }));
  }

  /** Show the month containing `iso` first. */
  goToMonth(iso: string): void {
    const day = parseDate(iso);
    if (!day) return;
    const next = formatDate({ y: day.y, m: day.m, d: 1 });
    if (next === this.#shown.get()) return;
    this.#shown.set(next);
    this.dispatchEvent(new CustomEvent('ui-month-change', { bubbles: true, detail: { month: next.slice(0, 7) } }));
  }

  _canGo(by: number): boolean {
    const first = this._first();
    const lo = this._min();
    const hi = this._max();
    if (by < 0 && lo) return compareDates(addMonths(first, -1), { y: lo.y, m: lo.m, d: 1 }) >= 0;
    if (by > 0 && hi) {
      const lastShown = addMonths(first, (this.numberOfMonths || 1) - 1);
      return compareDates(addMonths(lastShown, 1), { y: hi.y, m: hi.m, d: 1 }) <= 0;
    }
    return true;
  }

  _turn(by: number): void {
    if (!this._canGo(by)) return;
    this.goToMonth(formatDate(addMonths(this._first(), by)));
  }

  // The state a day is drawn in.
  _dayState(day: CalendarDate): { selected: boolean; single: boolean; start: boolean; end: boolean; middle: boolean } {
    const s = this.#selection.get();
    const iso = formatDate(day);
    if (this.mode === 'range') {
      const from = parseDate(s.from);
      const to = parseDate(s.to);
      const start = sameDay(day, from);
      const end = sameDay(day, to);
      const middle = !!from && !!to && compareDates(day, from) > 0 && compareDates(day, to) < 0;
      // A range of one day (or one not yet ended) draws its start as a single pick.
      const lone = start && (!to || sameDay(from, to));
      return { selected: start || end || middle, single: lone, start: start && !lone, end: end && !lone, middle };
    }
    const on = s.days.includes(iso);
    return { selected: on, single: on, start: false, end: false, middle: false };
  }

  // The day that owns the tab stop: the focused one, else the first chosen
  // day shown, else today if shown, else the first day of the first month.
  _tabDay(months: CalendarDate[]): string {
    const inShown = (iso: string) => {
      const d = parseDate(iso);
      return !!d && months.some((m) => m.y === d.y && m.m === d.m);
    };
    if (this.#focused.get() && inShown(this.#focused.get())) return this.#focused.get();
    const chosen = [this.#selection.get().from, ...this.#selection.get().days].find((d) => d && inShown(d));
    if (chosen) return chosen;
    const today = formatDate(this._today());
    if (inShown(today)) return today;
    return formatDate(months[0]);
  }

  render() {
    const months = Array.from({ length: Math.max(1, this.numberOfMonths || 1) }, (_, i) => addMonths(this._first(), i));
    const tab = this._tabDay(months);
    const today = formatDate(this._today());
    const outside = this.showOutsideDays !== 'false';
    const weekday = this._fmt({ weekday: 'short' });
    const weekdayLong = this._fmt({ weekday: 'long' });
    const caption = this._fmt({ month: 'long', year: 'numeric' });
    const full = this._fmt({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const en = this._locale().toLowerCase().startsWith('en');
    const headerDays = monthWeeks(2024, 0, this._weekStart())[1];
    const dropdown = this.captionLayout === 'dropdown';
    const weeks = !!this.showWeekNumber;
    const hidden = this.name ? this._hiddenInputs() : '';
    return html`<div
      data-slot="calendar"
      class=${cn('w-fit', calendarClass())}
      @keydown=${this._onKeyDown}
    ><div class="relative flex flex-col gap-4 md:flex-row"><nav aria-label="Navigation" class="absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1"><button
      type="button"
      aria-label="Go to the Previous Month"
      aria-disabled=${this._canGo(-1) ? null : 'true'}
      class=${cn(buttonClass({ variant: 'ghost' }), NAV_BUTTON, 'rdp-button-previous')}
      @click=${() => this._turn(-1)}
    ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="cn-rtl-flip size-4 rtl:rotate-180"><path d="m15 18-6-6 6-6"></path></svg></button><button
      type="button"
      aria-label="Go to the Next Month"
      aria-disabled=${this._canGo(1) ? null : 'true'}
      class=${cn(buttonClass({ variant: 'ghost' }), NAV_BUTTON, 'rdp-button-next')}
      @click=${() => this._turn(1)}
    ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="cn-rtl-flip size-4 rtl:rotate-180"><path d="m9 18 6-6-6-6"></path></svg></button></nav>${months.map((mo, mi) => {
      // No id before connect (the server never connects an element): a served
      // `-caption-0` would be shared by every calendar on the page.
      const captionId = this._id ? `${this._id}-caption-${mi}` : null;
      return html`<div class="flex w-full flex-col gap-4"><div class="flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)">${dropdown && mi === 0
        ? this._dropdowns(mo, captionId)
        : html`<span id=${captionId} role="status" aria-live="polite" class=${cn('font-medium select-none', calendarCaptionClass())}>${caption.format(toUTC(mo))}</span>`}</div><table
        role="grid"
        aria-labelledby=${captionId}
        aria-multiselectable=${this.mode === 'single' ? null : 'true'}
        class="w-full border-collapse"
      ><thead aria-hidden="true"><tr class="flex">${weeks
        ? html`<th scope="col" aria-label="Week Number" class="w-(--cell-size) select-none"></th>`
        : ''}${headerDays.map((d) => {
        const short = weekday.format(toUTC(d));
        return html`<th scope="col" aria-label=${weekdayLong.format(toUTC(d))} class="flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none">${en ? short.slice(0, 2) : short}</th>`;
      })}</tr></thead><tbody>${monthWeeks(mo.y, mo.m, this._weekStart()).map((week) => html`<tr class="mt-2 flex w-full">${weeks
        ? this._weekNumberCell(week)
        : ''}${week.map((day) => {
        const iso = formatDate(day);
        const isOutside = day.m !== mo.m;
        if (isOutside && !outside) {
          return html`<td role="gridcell" class="group/day relative aspect-square h-full w-full p-0 invisible"></td>`;
        }
        const st = this._dayState(day);
        const off = this._isDisabled(day);
        const isToday = iso === today;
        const label = `${isToday ? 'Today, ' : ''}${full.format(toUTC(day))}${st.selected ? ', selected' : ''}`;
        return html`<td
          role="gridcell"
          data-day=${iso}
          aria-selected=${st.selected ? 'true' : null}
          data-selected=${st.selected ? 'true' : null}
          data-today=${isToday ? 'true' : null}
          data-outside=${isOutside ? 'true' : null}
          data-disabled=${off ? 'true' : null}
          data-focused=${this.#focused.get() === iso ? 'true' : null}
          class=${cn(
            'group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-e-(--cell-radius) [&:first-child[data-selected=true]_button]:rounded-s-(--cell-radius)',
            // A week-number column makes the row's first day its second cell,
            // which takes the first day's corner instead.
            weeks ? '[&:nth-child(2)[data-selected=true]_button]:rounded-s-(--cell-radius)' : '',
            st.start ? 'relative isolate z-0 rounded-s-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:end-0 after:w-4 after:bg-muted' : '',
            st.middle ? 'rounded-none' : '',
            st.end ? 'relative isolate z-0 rounded-e-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:start-0 after:w-4 after:bg-muted' : '',
            isToday ? 'rounded-(--cell-radius) bg-muted text-foreground data-[selected=true]:rounded-none' : '',
            isOutside ? 'text-muted-foreground aria-selected:text-muted-foreground' : '',
            off ? 'text-muted-foreground opacity-50' : '',
          )}
        ><button
          type="button"
          tabindex=${iso === tab ? '0' : '-1'}
          aria-label=${label}
          ?disabled=${off}
          data-day=${iso}
          data-selected-single=${st.single ? 'true' : 'false'}
          data-range-start=${st.start ? 'true' : 'false'}
          data-range-end=${st.end ? 'true' : 'false'}
          data-range-middle=${st.middle ? 'true' : 'false'}
          class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), calendarDayButtonClass())}
          @click=${() => this.pick(iso)}
          @focus=${() => { this.#focused.set(iso); }}
        >${day.d}</button></td>`;
      })}</tr>`)}</tbody></table></div>`;
    })}</div>${hidden}</div>`;
  }

  // The first day of a week: Monday for ISO weeks, as react-day-picker's
  // ISOWeek lays them out, else `week-starts-on`.
  _weekStart(): number {
    return this.isoWeek ? 1 : this.weekStartsOn || 0;
  }

  // A row's week number, a header cell for the row as react-day-picker draws
  // it: named "Week N" and shown two digits wide.
  _weekNumberCell(week: CalendarDate[]): unknown {
    const n = weekNumber(week[0], this._weekStart(), !!this.isoWeek);
    return html`<td role="rowheader" scope="row" aria-label=${`Week ${n}`} class="text-[0.8rem] text-muted-foreground select-none"><div class="flex size-(--cell-size) items-center justify-center text-center">${String(n).padStart(2, '0')}</div></td>`;
  }

  _hiddenInputs(): unknown {
    const s = this.#selection.get();
    if (this.mode === 'range') {
      return html`<input type="hidden" name=${`${this.name}[from]`} value=${s.from}><input type="hidden" name=${`${this.name}[to]`} value=${s.to}>`;
    }
    return s.days.map((d) => html`<input type="hidden" name=${this.name} value=${d}>`);
  }

  // Month and year selects over the caption, as react-day-picker draws them.
  _dropdowns(mo: CalendarDate, captionId: string | null): unknown {
    const monthName = this._fmt({ month: 'short' });
    const lo = this._min() ?? { y: mo.y - 100, m: 0, d: 1 };
    const hi = this._max() ?? { y: mo.y + 10, m: 11, d: 31 };
    const years: number[] = [];
    for (let y = lo.y; y <= hi.y; y++) years.push(y);
    const months = Array.from({ length: 12 }, (_, i) => i);
    const chevron = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>`;
    return html`<div id=${captionId} class="flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium"><span class=${calendarDropdownRootClass()}><select
      aria-label="Choose the Month"
      class="absolute inset-0 bg-popover opacity-0"
      @change=${(e: Event) => this.goToMonth(formatDate({ y: mo.y, m: Number((e.target as HTMLSelectElement).value), d: 1 }))}
    >${months.map((m) => html`<option value=${String(m)} ?selected=${m === mo.m}>${monthName.format(toUTC({ y: mo.y, m, d: 1 }))}</option>`)}</select><span
      aria-hidden="true" class=${cn('font-medium select-none', calendarCaptionLabelClass())}>${monthName.format(toUTC(mo))}${chevron}</span></span><span class=${calendarDropdownRootClass()}><select
      aria-label="Choose the Year"
      class="absolute inset-0 bg-popover opacity-0"
      @change=${(e: Event) => this.goToMonth(formatDate({ y: Number((e.target as HTMLSelectElement).value), m: mo.m, d: 1 }))}
    >${years.map((y) => html`<option value=${String(y)} ?selected=${y === mo.y}>${y}</option>`)}</select><span
      aria-hidden="true" class=${cn('font-medium select-none', calendarCaptionLabelClass())}>${mo.y}${chevron}</span></span></div>`;
  }

  _onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    const iso = target.getAttribute?.('data-day');
    if (!iso || target.tagName !== 'BUTTON') return;
    const day = parseDate(iso);
    if (!day) return;
    const rtl = typeof getComputedStyle === 'function' && getComputedStyle(this).direction === 'rtl';
    const w = this._weekStart();
    let next: CalendarDate | null = null;
    switch (e.key) {
      case 'ArrowLeft': next = addDays(day, rtl ? 1 : -1); break;
      case 'ArrowRight': next = addDays(day, rtl ? -1 : 1); break;
      case 'ArrowUp': next = addDays(day, -7); break;
      case 'ArrowDown': next = addDays(day, 7); break;
      case 'Home': next = addDays(day, -((toUTC(day).getUTCDay() - w + 7) % 7)); break;
      case 'End': next = addDays(day, 6 - ((toUTC(day).getUTCDay() - w + 7) % 7)); break;
      case 'PageUp': next = e.shiftKey ? addMonths(day, -12) : addMonths(day, -1); break;
      case 'PageDown': next = e.shiftKey ? addMonths(day, 12) : addMonths(day, 1); break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.pick(iso);
        return;
      default:
        return;
    }
    e.preventDefault();
    this.focusDay(formatDate(next));
  };

  /** Move focus to `iso`, turning the page when it is not shown. */
  focusDay(iso: string): void {
    const day = parseDate(iso);
    if (!day) return;
    const first = this._first();
    const last = addMonths(first, (this.numberOfMonths || 1) - 1);
    if (compareDates({ ...day, d: 1 }, { ...first, d: 1 }) < 0) this.goToMonth(iso);
    else if (compareDates({ ...day, d: 1 }, { ...last, d: 1 }) > 0) this.goToMonth(formatDate(addMonths(day, -((this.numberOfMonths || 1) - 1))));
    this.#focused.set(iso);
    this.updateComplete.then(() => {
      this.querySelector<HTMLButtonElement>(`button[data-day="${iso}"]`)?.focus();
    });
  }
}
UiCalendar.register('ui-calendar');
