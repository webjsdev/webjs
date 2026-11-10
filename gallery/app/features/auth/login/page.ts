import { html } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { cardClass } from '#modules/gallery/ui/card.ts';
import { inputClass } from '#modules/gallery/ui/input.ts';
import { buttonClass } from '#modules/gallery/ui/button.ts';
import { logIn } from '#modules/auth/actions/log-in.server.ts';

export const metadata = { title: 'Log in' };

const inputCls = inputClass();

type LogInResult = { success: false; error: string; values: { email: string } };

// The form is bound to the logIn action (modules/auth/actions/log-in.server.ts),
// the Auth.js v5 shape: a wrong password comes back as actionData with a
// message and the typed email, so the page re-renders with both. The
// /api/auth/signin/credentials route createAuth mounts still works for a plain
// form post too; it lands back here with ?error=CredentialsSignin.
export default function LoginPage({ actionData, searchParams }: PageProps<'/features/auth/login', LogInResult>) {
  const error = actionData?.error ?? (searchParams.error ? 'Invalid email or password.' : null);
  return html`
    <div class="max-w-[420px] mx-auto">
      <h1 class="text-h2 font-bold mb-2">Sign in</h1>
      <p class="text-muted-foreground mb-5">Welcome back: log in to continue.</p>
      ${error ? html`<p role="alert" class="mb-4 text-sm text-destructive">${error}</p>` : ''}
      <form action=${logIn} class="${cardClass()} grid gap-4 p-5">
        <div class="grid gap-1.5">
          <label for="email" class="text-[13px] font-medium text-muted-foreground">Email</label>
          <input id="email" name="email" type="email" required class=${inputCls} placeholder="ada@example.com" value=${actionData?.values.email ?? ''} />
        </div>
        <div class="grid gap-1.5">
          <label for="password" class="text-[13px] font-medium text-muted-foreground">Password</label>
          <input id="password" name="password" type="password" required class=${inputCls} />
        </div>
        <button type="submit" class="${buttonClass()} justify-self-start">Sign in</button>
      </form>
      <p class="text-sm text-muted-foreground mt-4">Don't have an account? <a href="/features/auth/signup" class="text-primary underline underline-offset-2">Sign up</a></p>
    </div>
  `;
}
