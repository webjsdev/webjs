import { html } from '@webjsdev/core';

// A disabled question is left out of the flow. Toggle the environment
// question's disabled attribute from a change listener on the runtime
// answer, and the progress and actions follow.
export default function QuestionnaireConditional() {
  return html`
    <ui-questionnaire class="mx-auto w-full max-w-md">
      <ui-questionnaire-progress></ui-questionnaire-progress>

      <ui-questionnaire-item name="runtime" required>
        <ui-questionnaire-title>Where should the agent run?</ui-questionnaire-title>
        <ui-questionnaire-description>
          Cloud runs add an environment question to this flow.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="local" checked>
            Local workspace
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="cloud">
            Cloud workspace
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-item name="environment" required disabled>
        <ui-questionnaire-title>
          Which cloud environment should it use?
        </ui-questionnaire-title>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="preview">Preview</ui-questionnaire-choice>
          <ui-questionnaire-choice value="staging">Staging</ui-questionnaire-choice>
          <ui-questionnaire-choice value="isolated">
            Isolated sandbox
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-item name="approval" required>
        <ui-questionnaire-title>
          When should the agent request approval?
        </ui-questionnaire-title>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="writes">
            Before writing files
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="commands">
            Before running commands
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="sensitive">
            Only for sensitive actions
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-actions>
        <ui-questionnaire-previous></ui-questionnaire-previous>
        <ui-questionnaire-next>Next</ui-questionnaire-next>
        <ui-questionnaire-submit>Save execution plan</ui-questionnaire-submit>
      </ui-questionnaire-actions>
    </ui-questionnaire>
  `;
}
