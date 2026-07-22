import { html } from '@webjsdev/core';

export const metadata = { title: 'Log in' };

const inputCls = 'w-full bg-background border border-border rounded-xl px-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground';

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
    <div class="max-w-[420px] mx-auto">
      <h1 class="text-h2 font-bold mb-2">Sign in</h1>
      <p class="text-muted-foreground mb-5">Welcome back: log in to continue.</p>
      ${error ? html`<p role="alert" class="mb-4 text-sm text-destructive">${error}</p>` : ''}
      <form method="POST" action="/api/auth/signin/credentials" class="grid gap-4 p-5 rounded-2xl bg-card border border-border">
        <!-- createAuth reads redirectTo from the posted form and 302s there after a successful signin. -->
        <input type="hidden" name="redirectTo" value="/features/auth/dashboard">
        <div class="grid gap-1.5">
          <label for="email" class="text-[13px] font-medium text-muted-foreground">Email</label>
          <input id="email" name="email" type="email" required class=${inputCls} placeholder="ada@example.com" />
        </div>
        <div class="grid gap-1.5">
          <label for="password" class="text-[13px] font-medium text-muted-foreground">Password</label>
          <input id="password" name="password" type="password" required class=${inputCls} />
        </div>
        <button type="submit" class="justify-self-start px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm border-0 cursor-pointer transition-all hover:bg-primary/90 active:scale-[0.97]">Sign in</button>
      </form>
      <p class="text-sm text-muted-foreground mt-4">Don't have an account? <a href="/features/auth/signup" class="text-primary">Sign up</a></p>
    </div>
  `;
}
