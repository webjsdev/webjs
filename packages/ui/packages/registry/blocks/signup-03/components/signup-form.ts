/**
 * The signup-03 form: a centred card asking for a name, an email, and a
 * password beside its confirmation, and the terms line under the card. A
 * fragment helper (a function returning an `html` template), so it renders
 * on the server and ships no JavaScript. Ported from shadcn/ui's signup-03.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${signUp}>`) before you ship it: the
 * framework then supplies `method="post"`, and the no-JS post, the 422
 * re-render with `fieldErrors` / `values`, and the 303 redirect all work.
 * Until it is bound, the form submits as a GET back to the page with the
 * typed values in the URL.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import {
  fieldClass,
  fieldDescriptionClass,
  fieldGroupClass,
  fieldLabelClass,
} from '../../../components/field.ts';
import { inputClass } from '../../../components/input.ts';

export function signupForm(opts: { class?: string } = {}) {
  return html`
    <div class=${cn('flex flex-col gap-6', opts.class)}>
      <div class=${cardClass()} data-slot="card" data-size="default">
        <div class=${cn(cardHeaderClass(), 'text-center')} data-slot="card-header">
          <h1 class=${cn(cardTitleClass(), 'text-xl')} data-slot="card-title">Create your account</h1>
          <p class=${cardDescriptionClass()} data-slot="card-description">Enter your email below to create your account</p>
        </div>
        <div class=${cardContentClass()} data-slot="card-content">
          <form>
            <div class=${fieldGroupClass()} data-slot="field-group">
              <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                <label class=${fieldLabelClass()} data-slot="field-label" for="name">Full Name</label>
                <input class=${inputClass()} data-slot="input" id="name" name="name" type="text" autocomplete="name" placeholder="John Doe" required>
              </div>
              <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                <label class=${fieldLabelClass()} data-slot="field-label" for="email">Email</label>
                <input class=${inputClass()} data-slot="input" id="email" name="email" type="email" autocomplete="email" placeholder="m@example.com" required>
              </div>
              <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                <div class=${cn(fieldClass(), 'grid grid-cols-2 gap-4')} data-slot="field" data-orientation="vertical">
                  <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                    <label class=${fieldLabelClass()} data-slot="field-label" for="password">Password</label>
                    <input class=${inputClass()} data-slot="input" id="password" name="password" type="password" autocomplete="new-password" minlength="8" aria-describedby="password-description" required>
                  </div>
                  <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                    <label class=${fieldLabelClass()} data-slot="field-label" for="confirm-password">Confirm Password</label>
                    <input class=${inputClass()} data-slot="input" id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" required>
                  </div>
                </div>
                <p class=${fieldDescriptionClass()} data-slot="field-description" id="password-description">Must be at least 8 characters long.</p>
              </div>
              <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                <button class=${buttonClass()} data-slot="button" type="submit">Create Account</button>
                <p class=${cn(fieldDescriptionClass(), 'text-center')} data-slot="field-description">
                  Already have an account? <a href="/login">Sign in</a>
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
      <p class=${cn(fieldDescriptionClass(), 'px-6 text-center')} data-slot="field-description">
        By clicking continue, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
      </p>
    </div>
  `;
}
