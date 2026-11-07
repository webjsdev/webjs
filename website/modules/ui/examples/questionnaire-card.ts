import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';

// The title and description keep their own legend and description roles,
// so the card's classes go on them rather than on a separate card title.
export default function QuestionnaireCard() {
  return html`
    <ui-questionnaire class="mx-auto w-full max-w-md" shortcuts="numbers">
      <div data-slot="card" data-size="default" class=${cardClass()}>
        <ui-questionnaire-item name="task" required>
          <div data-slot="card-header" class=${cardHeaderClass()}>
            <ui-questionnaire-title class=${cardTitleClass()}>
              What should the agent work on?
            </ui-questionnaire-title>
            <ui-questionnaire-description class=${cardDescriptionClass()}>
              Choose the task that should be handled next.
            </ui-questionnaire-description>
            <div data-slot="card-action" class=${cardActionClass()}>
              <ui-questionnaire-progress></ui-questionnaire-progress>
            </div>
          </div>
          <div data-slot="card-content" class=${cardContentClass()}>
            <ui-questionnaire-choices>
              <ui-questionnaire-choice value="fix">
                Fix the failing tests
              </ui-questionnaire-choice>
              <ui-questionnaire-choice value="refactor">
                Refactor the data layer
              </ui-questionnaire-choice>
              <ui-questionnaire-choice value="docs">
                Update the integration guide
              </ui-questionnaire-choice>
            </ui-questionnaire-choices>
            <ui-questionnaire-error></ui-questionnaire-error>
          </div>
        </ui-questionnaire-item>

        <ui-questionnaire-item name="output" required>
          <div data-slot="card-header" class=${cardHeaderClass()}>
            <ui-questionnaire-title class=${cardTitleClass()}>
              What should the final handoff include?
            </ui-questionnaire-title>
            <ui-questionnaire-description class=${cardDescriptionClass()}>
              Pick the level of detail needed for review.
            </ui-questionnaire-description>
            <div data-slot="card-action" class=${cardActionClass()}>
              <ui-questionnaire-progress></ui-questionnaire-progress>
            </div>
          </div>
          <div data-slot="card-content" class=${cardContentClass()}>
            <ui-questionnaire-choices>
              <ui-questionnaire-choice value="summary">
                Summary only
              </ui-questionnaire-choice>
              <ui-questionnaire-choice value="files">
                Summary and changed files
              </ui-questionnaire-choice>
              <ui-questionnaire-choice value="review">
                Full review handoff
              </ui-questionnaire-choice>
            </ui-questionnaire-choices>
            <ui-questionnaire-error></ui-questionnaire-error>
          </div>
        </ui-questionnaire-item>

        <div data-slot="card-footer" class=${cardFooterClass()}>
          <ui-questionnaire-actions class="w-full">
            <ui-questionnaire-previous></ui-questionnaire-previous>
            <ui-questionnaire-next>Next</ui-questionnaire-next>
            <ui-questionnaire-submit>Create task</ui-questionnaire-submit>
          </ui-questionnaire-actions>
        </div>
      </div>
    </ui-questionnaire>
  `;
}
