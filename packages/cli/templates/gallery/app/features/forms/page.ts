// forms: the no-JS write path. A real <form method="post"> posts to this page's
// `action` export, and the framework re-renders the SAME page with the result on
// `actionData`. WHY it matters: the form works with JS OFF (server round-trip),
// and with JS the client router applies the response in place (no full reload).
// Never reach for fetch() + a click handler where a <form> + page action does.
// On failure the framework re-renders at 422 with the result; on success it
// does a 303 Post-Redirect-Get, so we redirect to ?sent=1 to show a confirmation.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = { title: 'Forms (no-JS PE) | features' };

interface Result {
  success: boolean;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  redirect?: string;
}

const field = (label: string, name: string, input: unknown, error?: string) => html`
  <div class="grid gap-1.5">
    <label for=${name} class="text-[13px] font-medium text-muted-foreground">${label}</label>
    ${input}
    ${error ? html`<p class="m-0 text-[12.5px] text-destructive">${error}</p>` : ''}
  </div>
`;

const inputCls = 'w-full bg-background border border-border rounded-xl px-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground';

export default function FormsFeature({ searchParams, actionData }: { searchParams: Record<string, string | undefined>; actionData?: Result }) {
  if (searchParams.sent) {
    return html`
      <h1 class="text-h2 font-bold mb-4">Forms</h1>
      <div class="max-w-[460px] grid gap-3 p-6 rounded-2xl bg-card border border-border text-center">
        <span class="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-primary/15 text-primary">
          <svg viewBox="0 0 24 24" class="w-6 h-6 stroke-current fill-none" style="stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"><path d="m5 13 4 4L19 7"/></svg>
        </span>
        <p class="m-0 text-lg font-semibold text-foreground">Message sent</p>
        <p class="m-0 text-sm text-muted-foreground">Thanks, we got it. <a class="text-primary" href="/features/forms">Send another</a>.</p>
      </div>
    `;
  }
  const errs = actionData?.fieldErrors ?? {};
  const v = actionData?.values ?? {};
  return html`
    <h1 class="text-h2 font-bold mb-2">Forms</h1>
    <p class="text-muted-foreground mb-5 max-w-[460px]">A real <code>&lt;form&gt;</code> posting to this page's <code>action</code>. It works with JS off; validation errors come back on <code>actionData</code>.</p>
    <form method="post" action="" class="max-w-[460px] grid gap-4 p-5 rounded-2xl bg-card border border-border">
      ${field('Name', 'name', html`<input id="name" name="name" value=${v.name ?? ''} class=${inputCls} placeholder="Ada Lovelace" />`, errs.name)}
      ${field('Email', 'email', html`<input id="email" name="email" type="email" value=${v.email ?? ''} class=${inputCls} placeholder="ada@example.com" />`, errs.email)}
      ${field('Message', 'message', html`<textarea id="message" name="message" rows="3" class=${inputCls} placeholder="Say hello...">${v.message ?? ''}</textarea>`, errs.message)}
      <button type="submit" class="justify-self-start px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm border-0 cursor-pointer transition-all hover:bg-primary/90 active:scale-[0.97]">Send message</button>
    </form>
  `;
}

// The page action runs on a non-GET submission to this URL (the no-JS write
// path). Validate, then return a failure (re-renders at 422 with fieldErrors +
// values) or a success with a same-site `redirect` (a 303 PRG to the confirmation).
//
// FOOTGUN: to redirect on success, RETURN `{ success: true, redirect: '/path' }`
// (a 303 See Other, so the browser follows with a GET). Do NOT THROW `redirect()`
// from a page action, that is a 307 which PRESERVES the POST method and body, so
// the browser re-POSTs to the target and re-runs the mutation (a duplicate write).
// Throw `redirect()` only from a page render / GET context, never a page action.
export async function action({ formData }: { formData: FormData }): Promise<Result> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'Your name is required.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErrors.email = 'A valid email is required.';
  if (message.length < 5) fieldErrors.message = 'Message must be at least 5 characters.';
  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors, values: { name, email, message } };
  // A real app would persist / email here. We just confirm.
  return { success: true, redirect: '/features/forms?sent=1' };
}
