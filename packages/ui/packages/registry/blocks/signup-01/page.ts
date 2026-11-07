/**
 * The signup-01 block's page: a simple signup form, centred on the page.
 *
 * Installed by `npx @webjsdev/ui add signup-01` at `app/signup/page.ts`. It
 * is app code you own, so edit it freely. Ported from shadcn/ui's signup-01.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { signupForm } from './components/signup-form.ts';

export const metadata: Metadata = { title: 'Sign up' };

export default function SignupPage() {
  return html`
    <div class="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div class="w-full max-w-sm">${signupForm()}</div>
    </div>
  `;
}
