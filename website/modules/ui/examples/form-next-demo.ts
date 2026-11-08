import { html, nothing } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import {
  fieldGroupClass, fieldClass, fieldLabelClass, fieldDescriptionClass, fieldErrorClass,
} from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';
import { spinner } from '#modules/ui/components/spinner.ts';
import type { submitBugReport } from './form-next-demo-action.server.ts';

export interface BugReportState {
  fieldErrors?: Partial<Record<'title' | 'description', string>>;
  values?: Partial<Record<'title' | 'description', string>>;
}

// One template renders the first paint and the 422 re-render: the page binds
// the action and passes its actionData in as `state` after a failed submission.
export default function BugReportForm(state: BugReportState = {}, action?: typeof submitBugReport) {
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return html`
    <form id="bug-report" action=${action} novalidate class="group w-full max-w-md">
      <div data-slot="card" data-size="default" class=${cardClass()}>
        <div data-slot="card-header" class=${cardHeaderClass()}>
          <div data-slot="card-title" class=${cardTitleClass()}>Bug Report</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>
            Help us improve by reporting bugs you encounter.
          </div>
        </div>
        <div data-slot="card-content" class=${cardContentClass()}>
          <div data-slot="field-group" class=${fieldGroupClass()}>
            <div data-slot="field" data-orientation="vertical" data-invalid=${errors.title ? 'true' : nothing} class=${fieldClass()}>
              <label data-slot="field-label" for="bug-report-title" class=${fieldLabelClass()}>Bug Title</label>
              <input
                data-slot="input"
                id="bug-report-title"
                name="title"
                value=${values.title ?? ''}
                placeholder="Login button not working on mobile"
                autocomplete="off"
                aria-invalid=${errors.title ? 'true' : nothing}
                aria-describedby=${errors.title ? 'bug-report-title-error' : nothing}
                class=${cn(inputClass(), 'group-aria-busy:opacity-50')}
              >
              ${errors.title ? html`
                <div role="alert" data-slot="field-error" id="bug-report-title-error" class=${fieldErrorClass()}>${errors.title}</div>
              ` : ''}
            </div>
            <div data-slot="field" data-orientation="vertical" data-invalid=${errors.description ? 'true' : nothing} class=${fieldClass()}>
              <label data-slot="field-label" for="bug-report-description" class=${fieldLabelClass()}>Description</label>
              <textarea
                data-slot="textarea"
                id="bug-report-description"
                name="description"
                rows="6"
                placeholder="I'm having an issue with the login button on mobile."
                aria-invalid=${errors.description ? 'true' : nothing}
                aria-describedby=${errors.description ? 'bug-report-description-desc bug-report-description-error' : 'bug-report-description-desc'}
                class=${cn(textareaClass(), 'min-h-24 resize-none group-aria-busy:opacity-50')}
              >${values.description ?? ''}</textarea>
              <p data-slot="field-description" id="bug-report-description-desc" class=${fieldDescriptionClass()}>
                Include steps to reproduce, expected behavior, and what actually happened.
              </p>
              ${errors.description ? html`
                <div role="alert" data-slot="field-error" id="bug-report-description-error" class=${fieldErrorClass()}>${errors.description}</div>
              ` : ''}
            </div>
          </div>
        </div>
        <div data-slot="card-footer" class=${cardFooterClass()}>
          <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'group-aria-busy:pointer-events-none group-aria-busy:opacity-50')}>
            ${spinner({ decorative: true, class: 'hidden group-aria-busy:inline-block' })}
            Submit
          </button>
        </div>
      </div>
    </form>
  `;
}
