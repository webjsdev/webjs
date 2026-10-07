import { html } from '@webjsdev/core';
import { cardClass } from '#components/ui/card.ts';
import { inputClass } from '#components/ui/input.ts';
import { buttonClass } from '#components/ui/button.ts';

export const metadata = { title: 'Log in' };

const inputCls = inputClass();

// A failed sign-in 302s back here with ?error=<code> (pages.error in
// modules/auth/auth.server.ts); map the code to a visible message.
function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === 'CredentialsSignin') return 'Invalid email or password.';
  return 'Could not sign you in. Please try again.';
}

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const error = errorMessage(searchParams.error);
  return html`
    <div class="max-w-[420px] mx-auto">
      <h1 class="text-h2 font-bold mb-2">Sign in</h1>
      <p class="text-muted-foreground mb-5">Welcome back: log in to continue.</p>
      ${error ? html`<p role="alert" class="mb-4 text-sm text-destructive">${error}</p>` : ''}
      <form method="POST" action="/api/auth/signin/credentials" class="${cardClass()} grid gap-4 p-5">
        <!-- createAuth 302s to redirectTo after a successful sign-in. -->
        <input type="hidden" name="redirectTo" value="/features/auth/dashboard">
        <div class="grid gap-1.5">
          <label for="email" class="text-[13px] font-medium text-muted-foreground">Email</label>
          <input id="email" name="email" type="email" required class=${inputCls} placeholder="ada@example.com" />
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
