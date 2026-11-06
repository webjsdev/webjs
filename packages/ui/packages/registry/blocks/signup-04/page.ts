/**
 * The signup-04 block's page: a wide signup card with the form beside an
 * image, on a muted background.
 *
 * Installed by `npx @webjsdev/ui add signup-04` at `app/signup/page.ts`, with
 * the image at `public/placeholder.svg`. Ported from shadcn/ui's signup-04.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { signupForm } from './components/signup-form.ts';

export const metadata: Metadata = { title: 'Sign up' };

export default function SignupPage() {
  return html`
    <div class="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div class="w-full max-w-sm md:max-w-4xl">${signupForm()}</div>
    </div>
  `;
}
