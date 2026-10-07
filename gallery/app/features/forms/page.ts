// The no-JS write path. `action=${sendMessage}` is the whole wiring: the form
// posts to this page's own url, a failure re-renders it at 422 with the result
// on `actionData`, a success is a 303 Post-Redirect-Get (here to ?sent=1). It
// works with JS off; with JS the client router applies the response in place.
import { html } from '@webjsdev/core';
import { sendMessage, type Result } from '#modules/forms/actions/send-message.server.ts';
import { cardClass } from '#components/ui/card.ts';
import { inputClass } from '#components/ui/input.ts';
import { buttonClass } from '#components/ui/button.ts';
import { pageHeading } from '#lib/utils/ui.ts';
import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = { title: 'Forms (no-JS PE) | features' };

const field = (label: string, name: string, input: unknown, error?: string) => html`
  <div class="grid gap-1.5">
    <label for=${name} class="text-[13px] font-medium text-muted-foreground">${label}</label>
    ${input}
    ${error ? html`<p class="m-0 text-[12.5px] text-destructive">${error}</p>` : ''}
  </div>
`;

const inputCls = inputClass();

export default function FormsFeature({ searchParams, actionData }: { searchParams: Record<string, string | undefined>; actionData?: Result }) {
  if (searchParams.sent) {
    return html`
      ${pageHeading('Forms')}
      <div class="${cardClass()} max-w-[460px] grid gap-3 p-6 text-center">
        <span class="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-primary/15 text-primary">
          <svg viewBox="0 0 24 24" class="w-6 h-6 stroke-current fill-none" style="stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"><path d="m5 13 4 4L19 7"/></svg>
        </span>
        <p class="m-0 text-lg font-semibold text-foreground">Message sent</p>
        <p class="m-0 text-sm text-muted-foreground">Thanks, we got it. <a class="text-primary underline underline-offset-2" href="/features/forms">Send another</a>.</p>
      </div>
    `;
  }
  const errs = actionData?.fieldErrors ?? {};
  const v = actionData?.values ?? {};
  return html`
    <h1 class="text-h2 font-bold mb-2">Forms</h1>
    <p class="text-muted-foreground mb-5 max-w-[460px]">A real <code>&lt;form&gt;</code> bound to a server action. It works with JS off; validation errors come back on <code>actionData</code>.</p>
    <form action=${sendMessage} class="${cardClass()} max-w-[460px] grid gap-4 p-5">
      ${field('Name', 'name', html`<input id="name" name="name" value=${v.name ?? ''} class=${inputCls} placeholder="Ada Lovelace" />`, errs.name)}
      ${field('Email', 'email', html`<input id="email" name="email" type="email" value=${v.email ?? ''} class=${inputCls} placeholder="ada@example.com" />`, errs.email)}
      ${field('Message', 'message', html`<textarea id="message" name="message" rows="3" class=${inputCls} placeholder="Say hello...">${v.message ?? ''}</textarea>`, errs.message)}
      <button type="submit" class="${buttonClass()} justify-self-start">Send message</button>
    </form>
  `;
}
