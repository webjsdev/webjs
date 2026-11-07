import { html } from '@webjsdev/core';

export default function QuestionnaireMultiple() {
  return html`
    <ui-questionnaire class="mx-auto w-full max-w-md" shortcuts="letters">
      <ui-questionnaire-item name="context" multiple required>
        <ui-questionnaire-title>
          What context should the agent inspect?
        </ui-questionnaire-title>
        <ui-questionnaire-description>
          Select every source that may affect the implementation.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="source">
            Relevant source files
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="tests">
            Existing tests
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="docs">
            Architecture documentation
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="history">
            Recent commit history
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-actions>
        <ui-questionnaire-submit>Share context</ui-questionnaire-submit>
      </ui-questionnaire-actions>
    </ui-questionnaire>
  `;
}
