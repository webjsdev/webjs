import { html } from '@webjsdev/core';

export default function QuestionnaireFreeform() {
  return html`
    <ui-questionnaire class="mx-auto w-full max-w-md" shortcuts="letters">
      <ui-questionnaire-item name="approach" required>
        <ui-questionnaire-title>
          How should the agent approach this refactor?
        </ui-questionnaire-title>
        <ui-questionnaire-description>
          Choose a strategy or write a more specific instruction.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="incremental">
            Make the smallest safe change
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="module">
            Refactor one module at a time
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="rewrite">
            Replace the implementation completely
          </ui-questionnaire-choice>
          <ui-questionnaire-input
            aria-label="Another refactoring approach"
            placeholder="Describe another approach…"
          ></ui-questionnaire-input>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-actions>
        <ui-questionnaire-submit>Use this approach</ui-questionnaire-submit>
      </ui-questionnaire-actions>
    </ui-questionnaire>
  `;
}
