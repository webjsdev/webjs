import { html } from '@webjsdev/core';

// <ui-questionnaire-progress> renders a "Question 1 of 4" line. Style it
// with classes on the element; it takes no custom render.
export default function QuestionnaireProgressExample() {
  return html`
    <ui-questionnaire class="mx-auto w-full max-w-md">
      <ui-questionnaire-progress class="w-full"></ui-questionnaire-progress>

      <ui-questionnaire-item name="scope" required>
        <ui-questionnaire-title>How large is the change?</ui-questionnaire-title>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="small">Small patch</ui-questionnaire-choice>
          <ui-questionnaire-choice value="medium">
            Feature-sized change
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="large">
            Cross-package change
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-item name="strategy" required>
        <ui-questionnaire-title>
          How should commits be organized?
        </ui-questionnaire-title>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="single">
            Single commit
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="logical">
            Logical commits
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="squash">
            Squash before review
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-item name="tests" required>
        <ui-questionnaire-title>Which tests should run?</ui-questionnaire-title>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="targeted">
            Targeted tests
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="package">
            Package suite
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="workspace">
            Full workspace
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-item name="delivery" required>
        <ui-questionnaire-title>
          How should the work be delivered?
        </ui-questionnaire-title>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="patch">Patch only</ui-questionnaire-choice>
          <ui-questionnaire-choice value="commit">
            Committed locally
          </ui-questionnaire-choice>
          <ui-questionnaire-choice value="branch">
            Push a review branch
          </ui-questionnaire-choice>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>

      <ui-questionnaire-actions>
        <ui-questionnaire-previous></ui-questionnaire-previous>
        <ui-questionnaire-next>Next</ui-questionnaire-next>
        <ui-questionnaire-submit>Finish plan</ui-questionnaire-submit>
      </ui-questionnaire-actions>
    </ui-questionnaire>
  `;
}
