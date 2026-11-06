/**
 * The signup-02 block's page: a two column signup page, the form on one side
 * and a cover image on the other (hidden below `lg`).
 *
 * Installed by `npx @webjsdev/ui add signup-02` at `app/signup/page.ts`,
 * with the cover at `public/placeholder.svg`. Swap in your own image and
 * brand. Ported from shadcn/ui's signup-02.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { signupForm } from './components/signup-form.ts';

export const metadata: Metadata = { title: 'Sign up' };

export default function SignupPage() {
  return html`
    <div class="grid min-h-svh lg:grid-cols-2">
      <div class="flex flex-col gap-4 p-6 md:p-10">
        <div class="flex justify-center gap-2 md:justify-start">
          <a href="/" class="flex items-center gap-2 font-medium">
            <div class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true"><path d="M7 2h10"></path><path d="M5 6h14"></path><rect width="18" height="12" x="3" y="10" rx="2"></rect></svg>
            </div>
            Acme Inc.
          </a>
        </div>
        <div class="flex flex-1 items-center justify-center">
          <div class="w-full max-w-xs">${signupForm()}</div>
        </div>
      </div>
      <div class="relative hidden bg-muted lg:block">
        <img src="/public/placeholder.svg" alt="" class="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale">
      </div>
    </div>
  `;
}
