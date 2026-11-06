/**
 * The login-01 form: a card with an email and password form, a
 * forgot-password link, and a Google button. A fragment helper (a function
 * returning an `html` template), so it renders on the server and ships no
 * JavaScript. Ported from shadcn/ui's login-01.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${signIn}>`) before you ship it: the
 * framework then supplies `method="post"`, and the no-JS post, the 422
 * re-render with `fieldErrors` / `values`, and the 303 redirect all work.
 * Until it is bound, the form submits as a GET back to the page with the
 * typed values in the URL. The Google button is a placeholder for your
 * provider's sign-in link.
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

export function loginForm(opts: { class?: string } = {}) {
  return html`
    <div class=${cn('flex flex-col gap-6', opts.class)}>
      <div class=${cardClass()} data-slot="card" data-size="default">
        <div class=${cardHeaderClass()} data-slot="card-header">
          <h1 class=${cardTitleClass()} data-slot="card-title">Login to your account</h1>
          <p class=${cardDescriptionClass()} data-slot="card-description">
            Enter your email below to login to your account
          </p>
        </div>
        <div class=${cardContentClass()} data-slot="card-content">
          <form>
            <div class=${fieldGroupClass()} data-slot="field-group">
              <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                <label class=${fieldLabelClass()} data-slot="field-label" for="email">Email</label>
                <input class=${inputClass()} data-slot="input" id="email" name="email" type="email" autocomplete="email" placeholder="m@example.com" required>
              </div>
              <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                <div class="flex items-center">
                  <label class=${fieldLabelClass()} data-slot="field-label" for="password">Password</label>
                  <a href="#" class="ml-auto inline-block text-sm underline-offset-4 hover:underline">Forgot your password?</a>
                </div>
                <input class=${inputClass()} data-slot="input" id="password" name="password" type="password" autocomplete="current-password" required>
              </div>
              <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                <button class=${buttonClass()} data-slot="button" type="submit">Login</button>
                <button class=${buttonClass({ variant: 'outline' })} data-slot="button" type="button">Login with Google</button>
                <p class=${cn(fieldDescriptionClass(), 'text-center')} data-slot="field-description">
                  Don't have an account? <a href="/signup">Sign up</a>
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}
