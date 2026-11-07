import { html } from '@webjsdev/core';

// The saved answers are the choices' checked attributes.
export default function QuestionnaireResume() {
  return html`
    <ui-questionnaire class="mx-auto w-full max-w-md">
      <ui-questionnaire-progress></ui-questionnaire-progress>

      <ui-questionnaire-item name="change" required>
        <ui-questionnaire-title>What kind of migration is this?</ui-questionnaire-title>
        <ui-questionnaire-description>
          This answer was saved during the previous session.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="incremental" checked>
            Incremental migration
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="cutover">
            Single cutover
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-item name="verification" multiple required>
        <ui-questionnaire-title>
          How should the migration be verified?
        </ui-questionnaire-title>
        <ui-questionnaire-description>
          These checks were selected during the previous session.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="tests" checked>
            Run migration tests
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="typecheck" checked>
            Run the typecheck
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="manual">
            Perform a manual smoke test
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-item name="notes">
        <ui-questionnaire-title>
          Anything else the agent should remember?
        </ui-questionnaire-title>
        <ui-questionnaire-description>
          This note was saved with the draft.
        </ui-questionnaire-description>
        <ui-questionnaire-input aria-label="Saved migration note"></ui-questionnaire-input>
      </ui-questionnaire-item>

      <ui-questionnaire-actions>
        <ui-questionnaire-previous></ui-questionnaire-previous>
        <ui-questionnaire-next>Next</ui-questionnaire-next>
        <ui-questionnaire-submit>Update draft</ui-questionnaire-submit>
      </ui-questionnaire-actions>
    </ui-questionnaire>
  `;
}
