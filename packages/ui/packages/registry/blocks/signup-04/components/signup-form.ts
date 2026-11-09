/**
 * The signup-04 form: a two column card, the email and password form with
 * icon-only Apple, Google and Meta buttons on one side and an image on the
 * other (hidden below `md`), and the terms line under the card. A fragment
 * helper (a function returning an `html` template), so it renders on the
 * server and ships no JavaScript. Ported from shadcn/ui's signup-04.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${signUp}>`) before you ship it: the
 * framework then supplies `method="post"`, and the no-JS post, the 422
 * re-render with `fieldErrors` / `values`, and the 303 redirect all work.
 * Until it is bound, the form submits as a GET back to the page with the
 * typed values in the URL. The provider buttons are placeholders for your
 * providers' sign-up links.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import { cardClass, cardContentClass } from '../../../components/card.ts';
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
const META = 'M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z';

export function signupForm(opts: { class?: string } = {}) {
  return html`
    <div class=${cn('flex flex-col gap-6', opts.class)}>
      <div class=${cn(cardClass(), 'overflow-hidden p-0')} data-slot="card" data-size="default">
        <div class=${cn(cardContentClass(), 'grid p-0 md:grid-cols-2')} data-slot="card-content">
          <form class="p-6 md:p-8">
            <div class=${fieldGroupClass()} data-slot="field-group">
              <div class="flex flex-col items-center gap-2 text-center">
                <h1 class="text-2xl font-bold">Create your account</h1>
                <p class="text-sm text-balance text-muted-foreground">Enter your email below to create your account</p>
              </div>
              <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
                <label class=${fieldLabelClass()} data-slot="field-label" for="email">Email</label>
                <input class=${inputClass()} data-slot="input" id="email" name="email" type="email" autocomplete="email" placeholder="m@example.com" aria-describedby="email-description" required>
                <p class=${fieldDescriptionClass()} data-slot="field-description" id="email-description">
                  We'll use this to contact you. We will not share your email with anyone else.
                </p>
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
              </div>
              <div class=${cn(fieldSeparatorClass(), '*:data-[slot=field-separator-content]:bg-card')} data-slot="field-separator" role="none">
                <span class=${fieldSeparatorContentClass()} data-slot="field-separator-content">Or continue with</span>
              </div>
              <div class=${cn(fieldClass(), 'grid grid-cols-3 gap-4')} data-slot="field" data-orientation="vertical">
                <button class=${buttonClass({ variant: 'outline' })} data-slot="button" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d=${APPLE} fill="currentColor"></path></svg>
                  <span class="sr-only">Sign up with Apple</span>
                </button>
                <button class=${buttonClass({ variant: 'outline' })} data-slot="button" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d=${GOOGLE} fill="currentColor"></path></svg>
                  <span class="sr-only">Sign up with Google</span>
                </button>
                <button class=${buttonClass({ variant: 'outline' })} data-slot="button" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d=${META} fill="currentColor"></path></svg>
                  <span class="sr-only">Sign up with Meta</span>
                </button>
              </div>
              <p class=${cn(fieldDescriptionClass(), 'text-center')} data-slot="field-description">
                Already have an account? <a href="/login">Sign in</a>
              </p>
            </div>
          </form>
          <div class="relative hidden bg-muted md:block">
            <img src="/placeholder.svg" alt="" class="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale">
          </div>
        </div>
      </div>
      <p class=${cn(fieldDescriptionClass(), 'px-6 text-center')} data-slot="field-description">
        By clicking continue, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
      </p>
    </div>
  `;
}
