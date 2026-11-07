/**
 * The signup-05 block's page: a simple signup form with social providers,
 * centred on the page.
 *
 * Installed by `npx @webjsdev/ui add signup-05` at `app/signup/page.ts`.
 * Ported from shadcn/ui's signup-05.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { signupForm } from './components/signup-form.ts';

export const metadata: Metadata = { title: 'Sign up' };

export default function SignupPage() {
  return html`
    <div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div class="w-full max-w-sm">${signupForm()}</div>
    </div>
  `;
}
