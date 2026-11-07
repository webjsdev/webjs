import { html } from '@webjsdev/core';

export default function QuestionnaireShortcuts() {
  return html`
    <ui-questionnaire class="mx-auto w-full max-w-md" shortcuts="letters">
      <ui-questionnaire-item name="action" required>
        <ui-questionnaire-title>
          What should the agent do next?
        </ui-questionnaire-title>
        <ui-questionnaire-description>
          Use the displayed shortcut or navigate with the keyboard.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="inspect">
            Inspect the implementation
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="tests">
            Run the relevant tests
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="patch">
            Prepare the patch
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-actions>
        <ui-questionnaire-submit>Confirm action</ui-questionnaire-submit>
      </ui-questionnaire-actions>
    </ui-questionnaire>
  `;
}
