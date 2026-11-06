/**
 * The login-01 block's page: a simple login form, centred on the page.
 *
 * Installed by `npx @webjsdev/ui add login-01` at `app/login/page.ts`. It is
 * app code you own, so edit it freely. Ported from shadcn/ui's login-01.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { loginForm } from './components/login-form.ts';

export const metadata: Metadata = { title: 'Login' };

export default function LoginPage() {
  return html`
    <div class="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div class="w-full max-w-sm">${loginForm()}</div>
    </div>
  `;
}
