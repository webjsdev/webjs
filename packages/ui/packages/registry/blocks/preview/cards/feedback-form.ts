/**
 * The preview block's feedback form card: a topic picker and a feedback field.
 * A fragment helper, rendered by the server. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/feedback-form.ts`.
 * Ported from shadcn/ui's preview block.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${sendFeedback}>`) before you ship it.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import { cardClass, cardContentClass, cardFooterClass } from '../../../components/card.ts';
import { fieldClass, fieldGroupClass, fieldLabelClass } from '../../../components/field.ts';
import { nativeSelectClass, nativeSelectIconClass, nativeSelectWrapperClass } from '../../../components/native-select.ts';
import { textareaClass } from '../../../components/textarea.ts';
import { ChevronDownIcon } from '../../../lib/icons.ts';

const TOPICS = [
  ['', 'Select a topic'],
  ['ai', 'AI'],
  ['accounts-and-access-controls', 'Accounts and Access Controls'],
  ['billing', 'Billing'],
  ['cdn', 'CDN (Firewall, Caching)'],
  ['ci-cd', 'CI/CD (Builds, Deployments, Environment Variables)'],
  ['dashboard-interface', 'Dashboard Interface (Navigation, UI Issues)'],
  ['domains', 'Domains'],
  ['frameworks', 'Frameworks'],
  ['marketplace-and-integrations', 'Marketplace and Integrations'],
  ['observability', 'Observability (Observability, Logs, Monitoring)'],
  ['storage', 'Storage'],
];

export function feedbackForm() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <form id="feedback-form">
          <div data-slot="field-group" class=${fieldGroupClass()}>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="field-label" for="feedback-form-topic" class=${fieldLabelClass()}>Topic</label>
              <div data-slot="native-select-wrapper" class=${nativeSelectWrapperClass()}>
                <select data-slot="native-select" id="feedback-form-topic" name="topic" class=${nativeSelectClass()}>
                  ${TOPICS.map(([value, label]) => html`<option value=${value}>${label}</option>`)}
                </select>
                ${ChevronDownIcon(nativeSelectIconClass())}
              </div>
            </div>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="field-label" for="feedback-form-feedback" class=${fieldLabelClass()}>Feedback</label>
              <textarea data-slot="textarea" id="feedback-form-feedback" name="feedback" placeholder="Your feedback helps us improve..." class=${textareaClass()}></textarea>
            </div>
          </div>
        </form>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="submit" form="feedback-form" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'style-sera:w-full')}>Submit</button>
      </div>
    </div>
  `;
}
