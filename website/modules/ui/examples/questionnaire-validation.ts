import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  cardClass, cardHeaderClass, cardActionClass, cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';

// The schema check runs in your own submit listener: read the answers with
// FormData, and when the pair is rejected, call preventDefault() and put the
// message in that question's <ui-questionnaire-error>.
export default function QuestionnaireValidation() {
  return html`
    <ui-questionnaire class="mx-auto w-full max-w-md">
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'w-full')}>
        <ui-questionnaire-item name="detail" required>
          <div data-slot="card-header" class=${cardHeaderClass()}>
            <ui-questionnaire-title>
              How much detail should the answer include?
            </ui-questionnaire-title>
            <ui-questionnaire-description>
              Choose the response depth.
            </ui-questionnaire-description>
            <div data-slot="card-action" class=${cardActionClass()}>
              <ui-questionnaire-progress class="min-w-0"></ui-questionnaire-progress>
            </div>
          </div>
          <div data-slot="card-content" class=${cardContentClass()}>
            <ui-questionnaire-choices>
              <ui-questionnaire-choice value="summary">
                Concise summary
              </ui-questionnaire-choice>
              <ui-questionnaire-choice value="complete">
                Complete answer
              </ui-questionnaire-choice>
            </ui-questionnaire-choices>
            <ui-questionnaire-error></ui-questionnaire-error>
          </div>
        </ui-questionnaire-item>

        <ui-questionnaire-item name="audience" required>
          <div data-slot="card-header" class=${cardHeaderClass()}>
            <ui-questionnaire-title>Who will read the answer?</ui-questionnaire-title>
            <ui-questionnaire-description>
              Public answers require complete context.
            </ui-questionnaire-description>
            <div data-slot="card-action" class=${cardActionClass()}>
              <ui-questionnaire-progress class="min-w-0"></ui-questionnaire-progress>
            </div>
          </div>
          <div data-slot="card-content" class=${cardContentClass()}>
            <ui-questionnaire-choices>
              <ui-questionnaire-choice value="team">
                My team
              </ui-questionnaire-choice>
              <ui-questionnaire-choice value="public">
                Public audience
              </ui-questionnaire-choice>
            </ui-questionnaire-choices>
            <ui-questionnaire-error></ui-questionnaire-error>
          </div>
        </ui-questionnaire-item>

        <div data-slot="card-footer" class=${cardFooterClass()}>
          <ui-questionnaire-actions class="w-full">
            <ui-questionnaire-previous></ui-questionnaire-previous>
            <ui-questionnaire-next>Next</ui-questionnaire-next>
            <ui-questionnaire-submit>Validate answers</ui-questionnaire-submit>
          </ui-questionnaire-actions>
        </div>
      </div>
    </ui-questionnaire>
  `;
}
