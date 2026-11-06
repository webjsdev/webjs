/**
 * The login-04 block's page: a wide login card with the form beside an
 * image, on a muted background.
 *
 * Installed by `npx @webjsdev/ui add login-04` at `app/login/page.ts`, with
 * the image at `public/placeholder.svg`. Ported from shadcn/ui's login-04.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { loginForm } from './components/login-form.ts';

export const metadata: Metadata = { title: 'Login' };

export default function LoginPage() {
  return html`
    <div class="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div class="w-full max-w-sm md:max-w-4xl">${loginForm()}</div>
    </div>
  `;
}
