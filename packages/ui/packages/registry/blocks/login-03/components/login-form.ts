/**
 * The login-03 form: a centred "Welcome back" card with Apple and Google
 * buttons above an email and password form, and the terms line under the
 * card. A fragment helper (a function returning an `html` template), so it
 * renders on the server and ships no JavaScript. Ported from shadcn/ui's
 * login-03.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${signIn}>`) before you ship it: the
 * framework then supplies `method="post"`, and the no-JS post, the 422
 * re-render with `fieldErrors` / `values`, and the 303 redirect all work.
 * Until it is bound, the form submits as a GET back to the page with the
 * typed values in the URL. The provider buttons are placeholders for your
 * providers' sign-in links.
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
  fieldSeparatorClass,
  fieldSeparatorContentClass,
} from '../../../components/field.ts';
import { inputClass } from '../../../components/input.ts';

const APPLE = 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';
const GOOGLE = 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z';

export function loginForm(opts: { class?: string } = {}) {
  return html`
    <div class=${cn('flex flex-col gap-6', opts.class)}>
      <div class=${cardClass()} data-slot="card" data-size="default">
        <div class=${cn(cardHeaderClass(), 'text-center')} data-slot="card-header">
          <h1 class=${cn(cardTitleClass(), 'text-xl')} data-slot="card-title">Welcome back</h1>
          <p class=${cardDescriptionClass()} data-slot="card-description">Login with your Apple or Google account</p>
        </div>
        <div class=${cardContentClass()} data-slot="card-content">
          <form>
            <div class=${fieldGroupClass()} data-slot="field-group">
              <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                <button class=${buttonClass({ variant: 'outline' })} data-slot="button" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d=${APPLE} fill="currentColor"></path></svg>
                  Login with Apple
                </button>
                <button class=${buttonClass({ variant: 'outline' })} data-slot="button" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d=${GOOGLE} fill="currentColor"></path></svg>
                  Login with Google
                </button>
              </div>
              <div class=${cn(fieldSeparatorClass(), '*:data-[slot=field-separator-content]:bg-card')} data-slot="field-separator" role="none">
                <span class=${fieldSeparatorContentClass()} data-slot="field-separator-content">Or continue with</span>
              </div>
              <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                <label class=${fieldLabelClass()} data-slot="field-label" for="email">Email</label>
                <input class=${inputClass()} data-slot="input" id="email" name="email" type="email" autocomplete="email" placeholder="m@example.com" required>
              </div>
              <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                <div class="flex items-center">
                  <label class=${fieldLabelClass()} data-slot="field-label" for="password">Password</label>
                  <a href="#" class="ml-auto text-sm underline-offset-4 hover:underline">Forgot your password?</a>
                </div>
                <input class=${inputClass()} data-slot="input" id="password" name="password" type="password" autocomplete="current-password" required>
              </div>
              <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                <button class=${buttonClass()} data-slot="button" type="submit">Login</button>
                <p class=${cn(fieldDescriptionClass(), 'text-center')} data-slot="field-description">
                  Don't have an account? <a href="/signup">Sign up</a>
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
