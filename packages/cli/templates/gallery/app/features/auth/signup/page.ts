import { html } from '@webjsdev/core';
import { signup } from '#modules/auth/actions/signup.server.ts';

export const metadata = { title: 'Sign up' };

const inputCls = 'w-full bg-background border border-border rounded-xl px-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground';

// Page server action: handles the POST from the form below. With JS disabled this
// is a plain <form> round-trip; with JS the client router swaps the 422 re-render
// (errors) or follows the 302 (success) in place. A validation failure returns
// fieldErrors + values so the page re-renders with messages and the user's typed
// input preserved.
export async function action({ formData }: { formData: FormData }) {
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const values = { name, email };
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'Name is required';
  if (!email.includes('@')) fieldErrors.email = 'Enter a valid email';
  if (password.length < 8) fieldErrors.password = 'At least 8 characters';
  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors, values, status: 422 };
  const result = await signup({ name, email, password });
  // On success signup returns signIn's 302 Response (auto-login -> dashboard); a
  // page action may return a Response, so pass it straight through.
  if (result instanceof Response) return result;
  return { success: false, fieldErrors: { email: result.error }, values, status: result.status };
}

export default function SignupPage({ actionData }: { actionData?: { fieldErrors?: Record<string, string>; values?: Record<string, string> } }) {
  const errors = actionData?.fieldErrors || {};
  const values = actionData?.values || {};
  return html`
    <div class="max-w-[420px] mx-auto">
      <h1 class="text-h2 font-bold mb-2">Create an account</h1>
      <p class="text-muted-foreground mb-5">Get started with your new workspace.</p>
      <form method="POST" class="grid gap-4 p-5 rounded-2xl bg-card border border-border">
        <div class="grid gap-1.5">
          <label for="name" class="text-[13px] font-medium text-muted-foreground">Name</label>
          <input id="name" name="name" type="text" value=${values.name || ''} required class=${inputCls} placeholder="Ada Lovelace" />
          ${errors.name ? html`<p class="m-0 text-[12.5px] text-destructive">${errors.name}</p>` : ''}
        </div>
        <div class="grid gap-1.5">
          <label for="email" class="text-[13px] font-medium text-muted-foreground">Email</label>
          <input id="email" name="email" type="email" value=${values.email || ''} required class=${inputCls} placeholder="ada@example.com" />
          ${errors.email ? html`<p class="m-0 text-[12.5px] text-destructive">${errors.email}</p>` : ''}
        </div>
        <div class="grid gap-1.5">
          <label for="password" class="text-[13px] font-medium text-muted-foreground">Password</label>
          <input id="password" name="password" type="password" minlength="8" required class=${inputCls} />
          ${errors.password ? html`<p class="m-0 text-[12.5px] text-destructive">${errors.password}</p>` : ''}
        </div>
        <button type="submit" class="justify-self-start px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm border-0 cursor-pointer transition-all hover:bg-primary/90 active:scale-[0.97]">Create account</button>
      </form>
      <p class="text-sm text-muted-foreground mt-4">Already have an account? <a href="/features/auth/login" class="text-primary">Log in</a></p>
    </div>
  `;
}
