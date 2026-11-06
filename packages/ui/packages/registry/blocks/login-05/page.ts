/**
 * The login-05 block's page: a simple email-only login, centred on the page.
 *
 * Installed by `npx @webjsdev/ui add login-05` at `app/login/page.ts`.
 * Ported from shadcn/ui's login-05.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { loginForm } from './components/login-form.ts';

export const metadata: Metadata = { title: 'Login' };

export default function LoginPage() {
  return html`
    <div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div class="w-full max-w-sm">${loginForm()}</div>
    </div>
  `;
}
