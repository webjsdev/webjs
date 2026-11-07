import { html } from '@webjsdev/core';

export default function QuestionnaireSkipExample() {
  return html`
    <ui-questionnaire class="mx-auto w-full max-w-md">
      <ui-questionnaire-progress></ui-questionnaire-progress>

      <ui-questionnaire-item name="task" required>
        <ui-questionnaire-title>What kind of change is this?</ui-questionnaire-title>
        <ui-questionnaire-description>
          Choose the category that best describes the work.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="feature">New feature</ui-questionnaire-choice>
          <ui-questionnaire-choice value="fix">Bug fix</ui-questionnaire-choice>
          <ui-questionnaire-choice value="refactor">Refactor</ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-item name="constraints">
        <ui-questionnaire-title>
          Are there any implementation constraints?
        </ui-questionnaire-title>
        <ui-questionnaire-description>
          Answer if needed, or intentionally skip this question.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="no-dependencies">
            Do not add dependencies
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="no-migrations">
            Do not change the database
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="preserve-api">
            Preserve the public API
          </ui-questionnaire-choice>
          <ui-questionnaire-input
            aria-label="Another implementation constraint"
            placeholder="Describe another constraint…"
          ></ui-questionnaire-input>
        </ui-questionnaire-choices>
      </ui-questionnaire-item>

      <ui-questionnaire-item name="review" required>
        <ui-questionnaire-title>
          How should the work be reviewed?
        </ui-questionnaire-title>
        <ui-questionnaire-description>
          Choose the checks the agent should complete before handoff.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="tests">
            Run the test suite
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="diff">
            Review the final diff
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="both">
            Tests and diff review
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-actions>
        <ui-questionnaire-previous></ui-questionnaire-previous>
        <ui-questionnaire-skip></ui-questionnaire-skip>
        <ui-questionnaire-next>Next</ui-questionnaire-next>
        <ui-questionnaire-submit>Submit brief</ui-questionnaire-submit>
      </ui-questionnaire-actions>
    </ui-questionnaire>
  `;
}
