import { html } from '@webjsdev/core';

/**
 * Page server action e2e fixture (#244): the no-JS form write-path.
 *
 * A `<form method="POST">` posts to this page's own `action`. Invalid input
 * re-renders the SAME page (422) with a field error and the user's typed value
 * preserved; valid input redirects (303 PRG) to `/feedback/thanks`. Works with
 * JavaScript disabled, and the client router upgrades it to an in-place swap
 * when JS is on. No fetch handler, no form library.
 *
 * Kept intentionally minimal and self-contained so the e2e probe can assert the
 * headline behavior in a real browser with JS both off and on.
 */

type ActionCtx = { formData: FormData };

export async function action({ formData }: ActionCtx) {
  const email = String(formData.get('email') || '').trim();
  // Server-side validation the browser cannot do: this address is "already on
  // the list". The input is a valid email format (so the native Constraint
  // Validation API lets it submit), but the server rejects it and re-renders
  // with the field error, the canonical server-validation case.
  if (email.toLowerCase() === 'taken@example.com') {
    return {
      success: false as const,
      fieldErrors: { email: 'That email is already subscribed' },
      values: { email },
      status: 422,
    };
  }
  return { success: true as const, redirect: '/feedback/thanks' };
}

type PageCtx = {
  actionData?: { fieldErrors?: Record<string, string>; values?: Record<string, string> };
};

export const metadata = { title: 'Feedback - WebJs Blog' };

export default function FeedbackPage({ actionData }: PageCtx) {
  const err = actionData?.fieldErrors?.email;
  const val = actionData?.values?.email || '';
  return html`
    <div class="max-w-[460px] mt-6 mx-auto">
      <h1 class="font-serif text-2xl font-bold mb-4">Send feedback</h1>
      <form method="POST" class="flex flex-col gap-3">
        <label class="flex flex-col gap-1">
          <span>Email</span>
          <input id="email" name="email" type="email" value=${val} class="border rounded px-2 py-1">
        </label>
        ${err ? html`<p id="email-error" class="text-sm text-red-600">${err}</p>` : ''}
        <button type="submit" class="border rounded px-3 py-1">Submit</button>
      </form>
    </div>
  `;
}
