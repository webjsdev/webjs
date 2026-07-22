import { html } from '@webjsdev/core';
import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass, cardFooterClass } from '#components/ui/card.ts';
import { buttonClass } from '#components/ui/button.ts';
import { inputClass } from '#components/ui/input.ts';
import { labelClass } from '#components/ui/label.ts';

export const metadata = { title: 'Log in' };

// A failed sign-in 302s back here with ?error=... (createAuth is configured with
// pages.error: '/features/auth/login' in modules/auth/auth.server.ts). Map the
// code to a plain message so a bad password gets visible feedback instead of a
// silent bounce.
function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === 'CredentialsSignin') return 'Invalid email or password.';
  return 'Could not sign you in. Please try again.';
}

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const error = errorMessage(searchParams.error);
  return html`
    <div class="max-w-sm mx-auto mt-12">
      <div class=${cardClass()}>
        <div class=${cardHeaderClass()}>
          <h1 class=${cardTitleClass()}>Sign in</h1>
          <p class=${cardDescriptionClass()}>Welcome back: log in to continue.</p>
        </div>
        <div class=${cardContentClass()}>
          ${error ? html`<p role="alert" class="mb-4 text-sm text-destructive">${error}</p>` : ''}
          <form method="POST" action="/api/auth/signin/credentials" class="flex flex-col gap-4">
            <!-- createAuth reads redirectTo from the posted form and 302s there after a successful signin. -->
            <input type="hidden" name="redirectTo" value="/features/auth/dashboard">
            <div class="flex flex-col gap-1.5">
              <label class=${labelClass()} for="email">Email</label>
              <input class=${inputClass()} id="email" name="email" type="email" required>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class=${labelClass()} for="password">Password</label>
              <input class=${inputClass()} id="password" name="password" type="password" required>
            </div>
            <button class=${buttonClass()} type="submit">Sign in</button>
          </form>
        </div>
        <div class=${cardFooterClass()}>
          <p class="text-sm text-muted-foreground">Don't have an account? <a href="/features/auth/signup" class="underline">Sign up</a></p>
        </div>
      </div>
    </div>
  `;
}
