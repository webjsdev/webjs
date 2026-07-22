import { html } from '@webjsdev/core';
import { signup } from '#modules/auth/actions/signup.server.ts';
import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass, cardFooterClass } from '#components/ui/card.ts';
import { buttonClass } from '#components/ui/button.ts';
import { inputClass } from '#components/ui/input.ts';
import { labelClass } from '#components/ui/label.ts';

export const metadata = { title: 'Sign up' };

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
    <div class="max-w-sm mx-auto mt-12">
      <div class=${cardClass()}>
        <div class=${cardHeaderClass()}>
          <h1 class=${cardTitleClass()}>Create an account</h1>
          <p class=${cardDescriptionClass()}>Get started with your new workspace.</p>
        </div>
        <div class=${cardContentClass()}>
          <form method="POST" class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label class=${labelClass()} for="name">Name</label>
              <input class=${inputClass()} id="name" name="name" type="text" value=${values.name || ''} required>
              ${errors.name ? html`<p class="text-sm text-destructive">${errors.name}</p>` : ''}
            </div>
            <div class="flex flex-col gap-1.5">
              <label class=${labelClass()} for="email">Email</label>
              <input class=${inputClass()} id="email" name="email" type="email" value=${values.email || ''} required>
              ${errors.email ? html`<p class="text-sm text-destructive">${errors.email}</p>` : ''}
            </div>
            <div class="flex flex-col gap-1.5">
              <label class=${labelClass()} for="password">Password</label>
              <input class=${inputClass()} id="password" name="password" type="password" minlength="8" required>
              ${errors.password ? html`<p class="text-sm text-destructive">${errors.password}</p>` : ''}
            </div>
            <button class=${buttonClass()} type="submit">Create account</button>
          </form>
        </div>
        <div class=${cardFooterClass()}>
          <p class="text-sm text-muted-foreground">Already have an account? <a href="/features/auth/login" class="underline">Log in</a></p>
        </div>
      </div>
    </div>
  `;
}
