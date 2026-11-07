/**
 * The preview block's typography specimen card: the heading and body font
 * names over a heading and two paragraphs, and a "Share Feedback" button
 * that opens a feedback form in a dialog. A fragment helper, rendered by the
 * server, with the kit's `<ui-dialog>` and `<ui-select>`. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/typography-specimen.ts`.
 * Ported from shadcn/ui's preview block.
 *
 * shadcn reads the font names from the configurator's search params. Pass
 * them in (`typographySpecimen({ heading, body })`) from the page that knows
 * them; `heading` is "Inherit" when the heading font is the body font. Each
 * name sits in a `data-design-system-text` span, so a host that restyles the
 * card live (the /ui/create configurator) rewrites the names in place. The dialog's `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${sendFeedback}>`) before you ship it.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import { cardClass, cardContentClass, cardFooterClass } from '../../../components/card.ts';
import {
  dialogDescriptionClass,
  dialogFooterClass,
  dialogHeaderClass,
  dialogTitleClass,
} from '../../../components/dialog.ts';
import { fieldClass, fieldGroupClass, fieldLabelClass } from '../../../components/field.ts';
import { inputClass } from '../../../components/input.ts';
import { selectTriggerClass } from '../../../components/select.ts';
import { textareaClass } from '../../../components/textarea.ts';

export function typographySpecimen(opts: { heading?: string; body?: string } = {}) {
  const heading = opts.heading ?? 'Inherit';
  const body = opts.body ?? 'Geist';
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-2')}>
        <div class="text-xs font-medium text-muted-foreground uppercase"><span data-design-system-text="font-heading-label">${heading}</span> - <span data-design-system-text="font">${body}</span></div>
        <p class="font-heading text-2xl font-medium style-sera:text-lg style-sera:font-semibold style-sera:tracking-wider style-sera:uppercase">
          Designing with rhythm and hierarchy.
        </p>
        <p class="text-sm leading-relaxed text-muted-foreground">
          A strong body style keeps long-form content readable and balances the
          visual weight of headings.
        </p>
        <p class="text-sm leading-relaxed text-muted-foreground">
          Thoughtful spacing and cadence help paragraphs scan quickly without
          feeling dense.
        </p>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <ui-dialog class="w-full">
          <ui-dialog-trigger>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'w-full')}>
              Share Feedback
            </button>
          </ui-dialog-trigger>
          <ui-dialog-content>
            <div data-slot="dialog-header" class=${dialogHeaderClass()}>
              <h2 data-slot="dialog-title" class=${dialogTitleClass()}>Share Feedback</h2>
              <p data-slot="dialog-description" class=${dialogDescriptionClass()}>
                Let us know how we can improve your experience.
              </p>
            </div>
            <form id="typography-feedback-form">
              <div data-slot="field-group" class=${fieldGroupClass()}>
                <div class="grid grid-cols-2 gap-3">
                  <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                    <label data-slot="field-label" for="typography-feedback-name" class=${fieldLabelClass()}>Name</label>
                    <input data-slot="input" id="typography-feedback-name" name="name" placeholder="Your name" class=${inputClass()}>
                  </div>
                  <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                    <label data-slot="field-label" for="typography-feedback-email" class=${fieldLabelClass()}>Email</label>
                    <input data-slot="input" id="typography-feedback-email" name="email" type="email" placeholder="you@example.com" class=${inputClass()}>
                  </div>
                </div>
                <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                  <label data-slot="field-label" for="typography-feedback-category" class=${fieldLabelClass()}>Category</label>
                  <ui-select>
                    <select id="typography-feedback-category" name="category" class=${cn(selectTriggerClass(), 'w-full')}>
                      <option value="general" selected>General</option>
                      <option value="bug">Bug Report</option>
                      <option value="feature">Feature Request</option>
                      <option value="improvement">Improvement</option>
                    </select>
                  </ui-select>
                </div>
                <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                  <label data-slot="field-label" for="typography-feedback-message" class=${fieldLabelClass()}>Message</label>
                  <textarea data-slot="textarea" id="typography-feedback-message" name="message" placeholder="Tell us what's on your mind..." class=${cn(textareaClass(), 'min-h-24 resize-none')}></textarea>
                </div>
              </div>
            </form>
            <div data-slot="dialog-footer" class=${dialogFooterClass()}>
              <ui-dialog-close>
                <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Cancel</button>
              </ui-dialog-close>
              <button type="submit" form="typography-feedback-form" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Submit</button>
            </div>
          </ui-dialog-content>
        </ui-dialog>
      </div>
    </div>
  `;
}
