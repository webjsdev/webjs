import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  dialogHeaderClass, dialogTitleClass, dialogDescriptionClass, dialogFooterClass,
} from '#modules/ui/components/dialog.ts';

// Cancel and dismissal belong to the dialog. Close it from a submit listener
// on the questionnaire once the answers are sent.
export default function QuestionnaireDialog() {
  return html`
    <ui-dialog>
      <ui-dialog-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Open clarification</button>
      </ui-dialog-trigger>
      <ui-dialog-content>
        <ui-questionnaire>
          <ui-questionnaire-item name="scope" required>
            <div data-slot="dialog-header" class=${dialogHeaderClass()}>
              <ui-questionnaire-progress></ui-questionnaire-progress>
              <ui-questionnaire-title class=${dialogTitleClass()}>
                Which files are in scope?
              </ui-questionnaire-title>
              <ui-questionnaire-description class=${dialogDescriptionClass()}>
                Choose how broadly the agent can update the workspace.
              </ui-questionnaire-description>
            </div>
            <ui-questionnaire-choices>
              <ui-questionnaire-choice value="component">
                Component only
              </ui-questionnaire-choice>
              <ui-questionnaire-choice value="feature">
                Complete feature directory
              </ui-questionnaire-choice>
              <ui-questionnaire-choice value="workspace">
                Any related workspace file
              </ui-questionnaire-choice>
            </ui-questionnaire-choices>
            <ui-questionnaire-error></ui-questionnaire-error>
          </ui-questionnaire-item>

          <ui-questionnaire-item name="tests" required>
            <div data-slot="dialog-header" class=${dialogHeaderClass()}>
              <ui-questionnaire-progress></ui-questionnaire-progress>
              <ui-questionnaire-title class=${dialogTitleClass()}>
                How much verification is needed?
              </ui-questionnaire-title>
              <ui-questionnaire-description class=${dialogDescriptionClass()}>
                Choose the checks the agent should run before handoff.
              </ui-questionnaire-description>
            </div>
            <ui-questionnaire-choices>
              <ui-questionnaire-choice value="targeted">
                Targeted tests
              </ui-questionnaire-choice>
              <ui-questionnaire-choice value="package">
                Package tests
              </ui-questionnaire-choice>
              <ui-questionnaire-choice value="full">
                Full workspace verification
              </ui-questionnaire-choice>
            </ui-questionnaire-choices>
            <ui-questionnaire-error></ui-questionnaire-error>
          </ui-questionnaire-item>

          <div data-slot="dialog-footer" class=${dialogFooterClass()}>
            <ui-dialog-close>
              <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
                Cancel
              </button>
            </ui-dialog-close>
            <ui-questionnaire-actions class="w-full">
              <ui-questionnaire-previous></ui-questionnaire-previous>
              <ui-questionnaire-next>Next</ui-questionnaire-next>
              <ui-questionnaire-submit>Send answer</ui-questionnaire-submit>
            </ui-questionnaire-actions>
          </div>
        </ui-questionnaire>
      </ui-dialog-content>
    </ui-dialog>
  `;
}
