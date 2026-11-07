import { html } from '@webjsdev/core';

// The questionnaire owns the active question and announces each change with
// a ui-active-change event ({ detail: { name } }). A listener that writes
// the matching label into the status line keeps the host in step.
export default function QuestionnaireControlled() {
  return html`
    <div class="relative mx-auto flex h-full w-full max-w-md flex-col">
      <p class="absolute end-0 top-0 text-sm text-muted-foreground" role="status">
        Current checkpoint: Change scope
      </p>

      <ui-questionnaire class="mt-auto">
        <ui-questionnaire-progress></ui-questionnaire-progress>

        <ui-questionnaire-item name="scope" required>
          <ui-questionnaire-title>What may the agent change?</ui-questionnaire-title>
          <ui-questionnaire-description>
            The host stores the active checkpoint while Questionnaire navigates.
          </ui-questionnaire-description>
          <ui-questionnaire-choices>
            <ui-questionnaire-choice value="component">
              Only the target component
            </ui-questionnaire-choice>
            <ui-questionnaire-choice value="tests">
              Component and related tests
            </ui-questionnaire-choice>
            <ui-questionnaire-choice value="feature">
              The complete feature area
            </ui-questionnaire-choice>
          </ui-questionnaire-choices>
          <ui-questionnaire-error></ui-questionnaire-error>
        </ui-questionnaire-item>

        <ui-questionnaire-item name="checks" required>
          <ui-questionnaire-title>
            Which verification level should it use?
          </ui-questionnaire-title>
          <ui-questionnaire-choices>
            <ui-questionnaire-choice value="targeted">
              Targeted tests
            </ui-questionnaire-choice>
            <ui-questionnaire-choice value="package">
              Package tests and typecheck
            </ui-questionnaire-choice>
            <ui-questionnaire-choice value="full">
              Full workspace verification
            </ui-questionnaire-choice>
          </ui-questionnaire-choices>
          <ui-questionnaire-error></ui-questionnaire-error>
        </ui-questionnaire-item>

        <ui-questionnaire-item name="output" required>
          <ui-questionnaire-title>
            What should the agent return when finished?
          </ui-questionnaire-title>
          <ui-questionnaire-choices>
            <ui-questionnaire-choice value="summary">
              Concise summary
            </ui-questionnaire-choice>
            <ui-questionnaire-choice value="diff">
              Summary with changed files
            </ui-questionnaire-choice>
            <ui-questionnaire-choice value="handoff">
              Detailed implementation handoff
            </ui-questionnaire-choice>
          </ui-questionnaire-choices>
          <ui-questionnaire-error></ui-questionnaire-error>
        </ui-questionnaire-item>

        <ui-questionnaire-actions>
          <ui-questionnaire-previous></ui-questionnaire-previous>
          <ui-questionnaire-next>Next</ui-questionnaire-next>
          <ui-questionnaire-submit>Save workflow</ui-questionnaire-submit>
        </ui-questionnaire-actions>
      </ui-questionnaire>
    </div>
  `;
}
