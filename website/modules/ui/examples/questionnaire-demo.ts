import { html } from '@webjsdev/core';

export default function QuestionnaireDemo() {
  return html`
    <ui-questionnaire class="mx-auto max-w-md" shortcuts="letters">
      <ui-questionnaire-progress></ui-questionnaire-progress>

      <ui-questionnaire-item name="direction" required>
        <ui-questionnaire-title>
          What should the agent build next?
        </ui-questionnaire-title>
        <ui-questionnaire-description>
          Choose a direction or describe another task.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="tool-calls">
            <span class="font-medium">Tool call timeline</span>
            <span class="text-muted-foreground">
              Show what the agent ran and what came back.
            </span>
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="approvals">
            <span class="font-medium">Approval checkpoints</span>
            <span class="text-muted-foreground">
              Ask before sensitive or destructive actions.
            </span>
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="handoffs">
            <span class="font-medium">Sub-agent handoffs</span>
            <span class="text-muted-foreground">
              Make delegated work and results easier to follow.
            </span>
          </ui-questionnaire-choice>
          <ui-questionnaire-input
            aria-label="Another agent feature"
            placeholder="Describe another feature…"
          ></ui-questionnaire-input>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-item name="signals" multiple>
        <ui-questionnaire-title>
          What should every progress update include?
        </ui-questionnaire-title>
        <ui-questionnaire-description>
          Select all that apply, or skip this question.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="progress">Progress</ui-questionnaire-choice>
          <ui-questionnaire-choice value="decisions">Decisions</ui-questionnaire-choice>
          <ui-questionnaire-choice value="risks">Risks</ui-questionnaire-choice>
          <ui-questionnaire-choice value="next-step">Next step</ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-item name="timing" required>
        <ui-questionnaire-title>When should work begin?</ui-questionnaire-title>
        <ui-questionnaire-description>
          Choose when the agent should begin the work.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="now">Start now</ui-questionnaire-choice>
          <ui-questionnaire-choice value="next-cycle">
            Next development cycle
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="backlog">
            Add it to the backlog
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-actions>
        <ui-questionnaire-previous></ui-questionnaire-previous>
        <ui-questionnaire-skip></ui-questionnaire-skip>
        <ui-questionnaire-next>Next</ui-questionnaire-next>
        <ui-questionnaire-submit>Save plan</ui-questionnaire-submit>
      </ui-questionnaire-actions>
    </ui-questionnaire>
  `;
}
