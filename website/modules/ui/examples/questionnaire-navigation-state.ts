import { html } from '@webjsdev/core';

// Next validates the active question itself: pressed with no answer, it
// stays put, marks the question invalid and shows its error.
export default function QuestionnaireNavigationState() {
  return html`
    <ui-questionnaire class="mx-auto w-full max-w-md">
      <ui-questionnaire-progress></ui-questionnaire-progress>

      <ui-questionnaire-item name="permission" required>
        <ui-questionnaire-title>What may the agent modify?</ui-questionnaire-title>
        <ui-questionnaire-description>
          Next stays on this question until an answer is selected.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="files">Project files</ui-questionnaire-choice>
          <ui-questionnaire-choice value="tests">
            Project files and tests
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="config">
            Files, tests, and configuration
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-item name="verification" required>
        <ui-questionnaire-title>
          What must pass before completion?
        </ui-questionnaire-title>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="tests">Tests</ui-questionnaire-choice>
          <ui-questionnaire-choice value="types">
            Tests and types
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="all">
            Tests, types, and visual QA
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-actions>
        <ui-questionnaire-previous></ui-questionnaire-previous>
        <ui-questionnaire-next variant="secondary">Next</ui-questionnaire-next>
        <ui-questionnaire-submit>Save permissions</ui-questionnaire-submit>
      </ui-questionnaire-actions>
    </ui-questionnaire>
  `;
}
