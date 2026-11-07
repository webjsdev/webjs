import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * The Calendar docs page, ported from shadcn's
 * content/docs/components/radix/calendar.mdx (#1666): the same sections in
 * the same order. shadcn's calendar is React DayPicker; the kit's is
 * <ui-calendar>, a grid on Intl.DateTimeFormat, so every section says what
 * the element does, and the ones DayPicker answers with a prop the element
 * lacks say so plainly.
 */
export const demo = 'calendar-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import '#components/ui/calendar.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-calendar
  mode="single"
  value="2025-06-12"
  class="rounded-lg border"
  @ui-value-change=\${(e) => console.log(e.detail.value)}
></ui-calendar>`, { lineNumbers: true })}
    <p>The selection is the <code>value</code> attribute, a <code>"YYYY-MM-DD"</code> string, and every pick dispatches <code>ui-value-change</code>. See the <a href="#api-reference">API Reference</a> for the rest of its attributes.</p>

    ${heading(toc, 2, 'About')}
    <p><code>&lt;ui-calendar&gt;</code> is a month grid built on <code>Intl.DateTimeFormat</code>, with no dependency. The server renders the month, so the grid is in the first paint, and picking a day needs JavaScript.</p>

    ${heading(toc, 2, 'Date Picker')}
    <p>You can use <code>&lt;ui-calendar&gt;</code> to build a date picker. See the <a href="/ui/docs/components/date-picker">Date Picker</a> page for more information.</p>

    ${heading(toc, 2, 'Persian / Hijri / Jalali Calendar')}
    <p><code>&lt;ui-calendar&gt;</code> lays out Gregorian months. What a <code>locale</code> changes is the language its months and weekdays are named in, so a Persian locale gives Persian names over Gregorian dates, as below. Add <code>-u-ca-gregory</code> to the locale so the caption names the same month the grid shows.</p>
    ${codeFigure(`<ui-calendar mode="single" locale="fa-IR-u-ca-gregory" dir="rtl"></ui-calendar>`)}
    ${await componentPreview('calendar-hijri', { previewClass: 'h-[400px]' })}

    ${heading(toc, 2, 'Selected Date (With TimeZone)')}
    <p>A selected day never drifts by one between time zones: <code>&lt;ui-calendar&gt;</code> values are date-only strings, <code>"YYYY-MM-DD"</code>, and its arithmetic runs on UTC calendar dates, so a time zone can never move a day.</p>
    ${codeFigure(`<ui-calendar
  mode="single"
  @ui-value-change=\${(e) => {
    // "2025-06-20", whatever time zone the browser is in
    const day = e.detail.value;
  }}
></ui-calendar>`, { lineNumbers: true })}
    <p><strong>Note:</strong> the one value that does depend on where the reader is, the day marked as today, is read from the clock of whatever renders the calendar, the server's on the first paint and the browser's once the element renders again.</p>

    ${heading(toc, 2, 'Basic')}
    <p>A basic calendar. We used <code>class="rounded-lg border"</code> to style the calendar.</p>
    ${await componentPreview('calendar-basic', { previewClass: 'h-96' })}

    ${heading(toc, 2, 'Range Calendar')}
    <p>Use <code>mode="range"</code> to enable range selection. The value is <code>"from/to"</code>, and <code>number-of-months</code> shows more than one month.</p>
    ${await componentPreview('calendar-range', { previewClass: 'h-[36rem] md:h-96' })}

    ${heading(toc, 2, 'Month and Year Selector')}
    <p>Use <code>caption-layout="dropdown"</code> to show month and year dropdowns.</p>
    ${await componentPreview('calendar-caption', { previewClass: 'h-96' })}

    ${heading(toc, 2, 'Presets')}
    <p>Presets are buttons beside the calendar that set its <code>value</code> and <code>month</code>. The component that owns the card wires each button's click.</p>
    ${await componentPreview('calendar-presets', { previewClass: 'h-[650px]' })}

    ${heading(toc, 2, 'Date and Time Picker')}
    <p>The calendar picks a day only. Pair it with native <code>&lt;input type="time"&gt;</code> fields for the time, as below.</p>
    ${await componentPreview('calendar-time', { previewClass: 'h-[600px]' })}

    ${heading(toc, 2, 'Booked dates')}
    <p><code>&lt;ui-calendar&gt;</code> disables the days outside a <code>min</code> / <code>max</code> window, or the whole grid with <code>disabled</code>. This demo closes the booked end of February with <code>max</code>.</p>
    ${await componentPreview('calendar-booked-dates', { previewClass: 'h-96' })}

    ${heading(toc, 2, 'Custom Cell Size')}
    ${await componentPreview('calendar-custom-days', { className: '**:[.preview]:h-[560px]' })}
    <p>You can customize the size of calendar cells using the <code>--cell-size</code> CSS variable. The element's root sets its own default, so set the variable on that root, the element's <code>data-slot="calendar"</code> child. You can also make it responsive by using breakpoint-specific values:</p>
    ${codeFigure(`<ui-calendar
  mode="single"
  class="rounded-lg border *:data-[slot=calendar]:[--cell-size:--spacing(11)] md:*:data-[slot=calendar]:[--cell-size:--spacing(12)]"
></ui-calendar>`, { lineNumbers: true })}
    <p>Or use fixed values:</p>
    ${codeFigure(`<ui-calendar
  mode="single"
  class="rounded-lg border *:data-[slot=calendar]:[--cell-size:2.75rem] md:*:data-[slot=calendar]:[--cell-size:3rem]"
></ui-calendar>`, { lineNumbers: true })}
    <p><code>&lt;ui-calendar&gt;</code> renders its own day buttons and offers no slot for extra content in them, such as a price under each day.</p>

    ${heading(toc, 2, 'Week Numbers')}
    <p>Use <code>show-week-number</code> to show week numbers. Week 1 is the week that holds January 1. Add <code>iso-week</code> for ISO 8601 weeks, which start on Monday and number from the week that holds the year's first Thursday.</p>
    ${await componentPreview('calendar-week-numbers', { previewClass: 'h-96' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    <p>See also the <a href="#persian-hijri-jalali-calendar">Hijri Guide</a> for what the calendar offers for Persian / Hijri / Jalali calendars.</p>
    ${await componentPreview('calendar-rtl', { direction: 'rtl', previewClass: 'h-96' })}
    <p>When using RTL, set <code>dir="rtl"</code> on the calendar or an ancestor, and pass the language as <code>locale</code>, a BCP 47 tag. Without one the calendar reads the page's <code>lang</code>.</p>
    ${codeFigure(`<ui-calendar
  mode="single"
  locale="ar"
  dir="rtl"
></ui-calendar>`, { lineNumbers: true })}

    ${heading(toc, 2, 'API Reference')}
    <p><code>&lt;ui-calendar&gt;</code> takes the following attributes.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>mode</code></td><td><code>"single" | "multiple" | "range"</code></td><td><code>"single"</code></td></tr>
          <tr><td><code>value</code></td><td><code>string</code>: <code>"2025-06-12"</code>, a comma list for multiple, <code>"2025-06-12/2025-06-20"</code> for a range</td><td>-</td></tr>
          <tr><td><code>month</code></td><td><code>string</code>: <code>"2025-06"</code>, the first month shown</td><td>the value's month, else today's</td></tr>
          <tr><td><code>number-of-months</code></td><td><code>number</code></td><td><code>1</code></td></tr>
          <tr><td><code>caption-layout</code></td><td><code>"label" | "dropdown"</code></td><td><code>"label"</code></td></tr>
          <tr><td><code>show-outside-days</code></td><td><code>"true" | "false"</code></td><td><code>"true"</code></td></tr>
          <tr><td><code>week-starts-on</code></td><td><code>number</code> (0 is Sunday)</td><td><code>0</code></td></tr>
          <tr><td><code>show-week-number</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>iso-week</code></td><td><code>boolean</code>: ISO 8601 weeks, starting on Monday</td><td><code>false</code></td></tr>
          <tr><td><code>min</code> / <code>max</code></td><td><code>string</code>: <code>"2025-01-01"</code></td><td>-</td></tr>
          <tr><td><code>disabled</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>locale</code></td><td><code>string</code>, a BCP 47 tag</td><td>the page's <code>lang</code></td></tr>
          <tr><td><code>name</code></td><td><code>string</code>: submits the value in hidden inputs</td><td>-</td></tr>
        </tbody>
      </table>
    </div>
    <p>With <code>name</code>, the value rides hidden inputs, so a form submits it: one input for a single date, one per date for multiple, and <code>name[from]</code> / <code>name[to]</code> for a range.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Event</th><th>Detail</th></tr></thead>
        <tbody>
          <tr><td><code>ui-value-change</code></td><td><code>{ value }</code>: a date string, a string array, or <code>{ from, to }</code> for a range</td></tr>
          <tr><td><code>ui-month-change</code></td><td><code>{ month }</code>: <code>"2025-06"</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>One day is in the tab order. The arrow keys move a day or a week, Home and End go to the week's ends, PageUp and PageDown change the month (with Shift, the year), and Enter or Space picks.</p>

    ${heading(toc, 2, 'Changelog')}
    ${heading(toc, 3, 'RTL Support')}
    <p><code>&lt;ui-calendar&gt;</code> supports right-to-left layouts and localized labels out of the box: it takes <code>locale</code>, formats every label with it, and rounds range ends with logical properties (<code>rounded-s</code> / <code>rounded-e</code>, <code>start</code> / <code>end</code>), so <code>dir="rtl"</code> flips the grid with no other change.</p>
    ${callout(html`If you copied <code>components/ui/calendar.ts</code> before it took <code>locale</code>, run <code>webjs ui diff calendar</code> to see what changed and <code>webjs ui add calendar --overwrite</code> to take the current version.`)}
    ${codeFigure(`<ui-calendar mode="single" locale="en-US"></ui-calendar>`)}
  `;
}
