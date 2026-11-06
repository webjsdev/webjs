/**
 * The login-02 form: a heading, an email and password form, and a GitHub
 * button under an "Or continue with" separator, laid straight on the page
 * with no card. A fragment helper (a function returning an `html` template),
 * so it renders on the server and ships no JavaScript. Ported from
 * shadcn/ui's login-02.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${signIn}>`) before you ship it: the
 * framework then supplies `method="post"`, and the no-JS post, the 422
 * re-render with `fieldErrors` / `values`, and the 303 redirect all work.
 * Until it is bound, the form submits as a GET back to the page with the
 * typed values in the URL. The GitHub button is a placeholder for your
 * provider's sign-in link.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  fieldClass,
  fieldDescriptionClass,
  fieldGroupClass,
  fieldLabelClass,
  fieldSeparatorClass,
  fieldSeparatorContentClass,
} from '../../../components/field.ts';
import { inputClass } from '../../../components/input.ts';

const GITHUB = 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12';

export function loginForm(opts: { class?: string } = {}) {
  return html`
    <form class=${cn('flex flex-col gap-6', opts.class)}>
      <div class=${fieldGroupClass()} data-slot="field-group">
        <div class="flex flex-col items-center gap-1 text-center">
          <h1 class="text-2xl font-bold">Login to your account</h1>
          <p class="text-sm text-balance text-muted-foreground">Enter your email below to login to your account</p>
        </div>
        <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
          <label class=${fieldLabelClass()} data-slot="field-label" for="email">Email</label>
          <input class=${cn(inputClass(), 'bg-background')} data-slot="input" id="email" name="email" type="email" autocomplete="email" placeholder="m@example.com" required>
        </div>
        <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
          <div class="flex items-center">
            <label class=${fieldLabelClass()} data-slot="field-label" for="password">Password</label>
            <a href="#" class="ml-auto text-sm underline-offset-4 hover:underline">Forgot your password?</a>
          </div>
          <input class=${cn(inputClass(), 'bg-background')} data-slot="input" id="password" name="password" type="password" autocomplete="current-password" required>
        </div>
        <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
          <button class=${buttonClass()} data-slot="button" type="submit">Login</button>
        </div>
        <div class=${fieldSeparatorClass()} data-slot="field-separator" role="none">
          <span class=${fieldSeparatorContentClass()} data-slot="field-separator-content">Or continue with</span>
        </div>
        <div class=${fieldClass()} data-slot="field" data-orientation="vertical">
          <button class=${buttonClass({ variant: 'outline' })} data-slot="button" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d=${GITHUB} fill="currentColor"></path></svg>
            Login with GitHub
          </button>
          <p class=${cn(fieldDescriptionClass(), 'text-center')} data-slot="field-description">
            Don't have an account? <a href="/signup" class="underline underline-offset-4">Sign up</a>
          </p>
        </div>
      </div>
    </form>
  `;
}
