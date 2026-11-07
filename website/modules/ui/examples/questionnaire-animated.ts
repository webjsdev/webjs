import { html } from '@webjsdev/core';

// The element renders a fieldset that carries data-active while its question
// is on screen, so the animation targets that child.
const itemClass =
  '*:data-active:animate-in *:data-active:fade-in-0 *:data-active:slide-in-from-bottom-2 *:data-active:duration-300 motion-reduce:*:animate-none';

export default function QuestionnaireAnimated() {
  return html`
    <ui-questionnaire class="mx-auto w-full max-w-md">
      <ui-questionnaire-progress></ui-questionnaire-progress>

      <ui-questionnaire-item class=${itemClass} name="task" required>
        <ui-questionnaire-title>What should the agent do?</ui-questionnaire-title>
        <ui-questionnaire-description>
          Choose the task for this run.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="implement">
            Implement the requested change
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="debug">
            Debug the current behavior
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="review">
            Review the implementation
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-item class=${itemClass} name="review" required>
        <ui-questionnaire-title>
          How should the work be reviewed?
        </ui-questionnaire-title>
        <ui-questionnaire-description>
          Select the verification depth.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="targeted">
            Targeted checks
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="complete">
            Complete test suite
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="manual">
            Tests and manual QA
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-item class=${itemClass} name="delivery" required>
        <ui-questionnaire-title>
          How should the result be delivered?
        </ui-questionnaire-title>
        <ui-questionnaire-description>
          Choose the final handoff format.
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="summary">
            Concise summary
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="diff">
            Summary and changed files
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="handoff">
            Detailed review handoff
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
  `;
}
