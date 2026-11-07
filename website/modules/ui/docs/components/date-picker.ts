import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Date Picker docs page body, ported from shadcn's
 * content/docs/components/radix/date-picker.mdx (#1666, D15): the same
 * sections in the same order, the prose rewritten where it describes React,
 * date-fns and react-day-picker.
 */
/** The demo shown above the Installation section. */
export const demo = 'date-picker-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Installation')}
    <p>The Date Picker is built using a composition of the <code>popover</code> attribute and the <code>&lt;ui-calendar&gt;</code> component.</p>
    <p>See installation instructions for the <a href="/ui/docs/components/popover#installation">Popover</a> and the <a href="/ui/docs/components/calendar#installation">Calendar</a> components.</p>

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#components/ui/button.ts';
import { popoverContentClass } from '#components/ui/popover.ts';
import '#components/ui/calendar.ts';
import { CalendarIcon } from '#lib/ui/lucide.ts';

export function DatePickerDemo() {
  return html\`
    <button
      type="button"
      popovertarget="date-picker"
      aria-haspopup="dialog"
      aria-expanded="false"
      data-empty="true"
      class=\${cn(buttonClass({ variant: 'outline' }), 'w-[280px] justify-start text-left font-normal data-[empty=true]:text-muted-foreground')}
    >
      \${CalendarIcon()}
      <span>Pick a date</span>
    </button>
    <div id="date-picker" popover role="dialog" aria-label="Pick a date" class=\${cn(popoverContentClass(), 'w-auto p-0')}>
      <ui-calendar mode="single" name="date"></ui-calendar>
    </div>
  \`;
}`, { title: 'components/example-date-picker.ts', lineNumbers: true })}
    <p>The calendar dispatches <code>ui-value-change</code> with the picked date in <code>detail.value</code> (a <code>"YYYY-MM-DD"</code> string), so a component that wants the trigger to show the date listens for it and re-renders the label. With <code>name</code>, the date also submits with the surrounding form. See the <a href="/ui/docs/components/calendar">Calendar</a> documentation for more information.</p>

    ${heading(toc, 2, 'Composition')}
    <p>A date picker is built from a popover and <code>&lt;ui-calendar&gt;</code>:</p>
    ${codeFigure(`button[popovertarget]
div[popover]  popoverContentClass()
└── ui-calendar`, { lang: 'text' })}

    ${heading(toc, 2, 'Basic')}
    <p>A basic date picker component.</p>
    ${await componentPreview('date-picker-basic')}

    ${heading(toc, 2, 'Range Picker')}
    <p>A date picker component for selecting a range of dates.</p>
    ${await componentPreview('date-picker-range')}

    ${heading(toc, 2, 'Date of Birth')}
    <p>A date picker component for selecting a date of birth. This component includes a dropdown caption layout for date and month selection.</p>
    ${await componentPreview('date-picker-dob')}

    ${heading(toc, 2, 'Input')}
    <p>A date picker component with an input field for selecting a date.</p>
    ${await componentPreview('date-picker-input')}

    ${heading(toc, 2, 'Time Picker')}
    <p>A date picker component with a time input field for selecting a time.</p>
    ${await componentPreview('date-picker-time')}

    ${heading(toc, 2, 'Natural Language Picker')}
    <p>A natural language picker turns text such as "In 2 days" into a date. Parse what the reader types with a library of your choice. The demo shows the first paint for "In 2 days".</p>
    ${await componentPreview('date-picker-natural-language')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('date-picker-rtl', { direction: 'rtl' })}
  `;
}
