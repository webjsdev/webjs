/**
 * The login-03 block's page: the brand above a login card, on a muted
 * background.
 *
 * Installed by `npx @webjsdev/ui add login-03` at `app/login/page.ts`.
 * Ported from shadcn/ui's login-03.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { loginForm } from './components/login-form.ts';

export const metadata: Metadata = { title: 'Login' };

export default function LoginPage() {
  return html`
    <div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div class="flex w-full max-w-sm flex-col gap-6">
        <a href="/" class="flex items-center gap-2 self-center font-medium">
          <div class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true"><path d="M7 2h10"></path><path d="M5 6h14"></path><rect width="18" height="12" x="3" y="10" rx="2"></rect></svg>
          </div>
          Acme Inc.
        </a>
        ${loginForm()}
      </div>
    </div>
  `;
}
