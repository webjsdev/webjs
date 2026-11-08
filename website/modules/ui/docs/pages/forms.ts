import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';
import { renderDemo } from '#modules/ui/queries/render-demo.server.ts';
import BugReportForm, { type BugReportState } from '#modules/ui/examples/form-next-demo.ts';
import { submitBugReport } from '#modules/ui/examples/form-next-demo-action.server.ts';
import type { DocPageContext } from './index.ts';

/**
 * The Forms guide (#1666, D12): shadcn's forms index and its server-action
 * page (content/docs/forms/next.mdx) in one, since WebJs has one way to
 * write a form, `<form action=${importedAction}>`, and no form library to
 * pick. The sections follow next.mdx; React's `useActionState`, `pending`
 * and Zod are replaced by what WebJs does: `ctx.actionData` with
 * `fieldErrors` and `values`, the router's `aria-busy` on a submitting form,
 * and validation written in the action. The demo is live: this page binds
 * examples/form-next-demo-action.server.ts to the demo's form (renderDemo's
 * renderToString runs outside a request, where no action can be bound, so
 * the demo takes the action as an argument), so a submission posts to this
 * page, and the 422 re-render hands `actionData` to the body through the
 * docs route's `ctx`, which renders the form with the errors and the typed
 * values. That is also why the demo is rendered here rather than through
 * componentPreview, whose renderDemo takes no state. shadcn's
 * react-hook-form, TanStack Form and Formisch pages have no WebJs
 * counterpart.
 */
export const title = 'Forms';
export const description = 'Build forms with server actions and the field helpers.';

const ACTION = `'use server';

import type { ActionResult } from '@webjsdev/server';

export async function submitBugReport(formData: FormData): Promise<ActionResult> {
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  const fieldErrors: Record<string, string> = {};
  if (title.length < 5) fieldErrors.title = 'Bug title must be at least 5 characters.';
  else if (title.length > 32) fieldErrors.title = 'Bug title must be at most 32 characters.';
  if (description.length < 20) fieldErrors.description = 'Description must be at least 20 characters.';
  else if (description.length > 100) fieldErrors.description = 'Description must be at most 100 characters.';

  if (Object.keys(fieldErrors).length) {
    return { success: false, fieldErrors };
  }

  // Do something with the values.
  // Call your database or API here.

  return { success: true };
}`;

const PAGE = `import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#components/ui/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardContentClass, cardFooterClass,
} from '#components/ui/card.ts';
import {
  fieldGroupClass, fieldClass, fieldLabelClass, fieldDescriptionClass, fieldErrorClass,
} from '#components/ui/field.ts';
import { inputClass } from '#components/ui/input.ts';
import { textareaClass } from '#components/ui/textarea.ts';
import { spinner } from '#components/ui/spinner.ts';
import { submitBugReport } from '#modules/bugs/actions/submit-bug-report.server.ts';

type FormState = {
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

export default function NewBugReport({ actionData }: { actionData?: FormState }) {
  const errors = actionData?.fieldErrors ?? {};
  const values = actionData?.values ?? {};
  return html\`
    <form action=\${submitBugReport} novalidate class="group">
      <div data-slot="card" class=\${cn(cardClass(), 'w-full max-w-md')}>
        <div data-slot="card-header" class=\${cardHeaderClass()}>
          <div data-slot="card-title" class=\${cardTitleClass()}>Bug Report</div>
          <div data-slot="card-description" class=\${cardDescriptionClass()}>
            Help us improve by reporting bugs you encounter.
          </div>
        </div>
        <div data-slot="card-content" class=\${cardContentClass()}>
          <div data-slot="field-group" class=\${fieldGroupClass()}>
            <div data-slot="field" data-invalid=\${errors.title ? 'true' : null} class=\${fieldClass()}>
              <label data-slot="field-label" for="title" class=\${fieldLabelClass()}>Bug Title</label>
              <input
                data-slot="input"
                id="title"
                name="title"
                value=\${values.title ?? ''}
                placeholder="Login button not working on mobile"
                autocomplete="off"
                aria-invalid=\${errors.title ? 'true' : null}
                aria-describedby=\${errors.title ? 'title-error' : null}
                class=\${inputClass()}
              >
              \${errors.title ? html\`
                <div role="alert" data-slot="field-error" id="title-error" class=\${fieldErrorClass()}>\${errors.title}</div>
              \` : ''}
            </div>
            <div data-slot="field" data-invalid=\${errors.description ? 'true' : null} class=\${fieldClass()}>
              <label data-slot="field-label" for="description" class=\${fieldLabelClass()}>Description</label>
              <textarea
                data-slot="textarea"
                id="description"
                name="description"
                rows="6"
                aria-invalid=\${errors.description ? 'true' : null}
                aria-describedby=\${errors.description ? 'description-desc description-error' : 'description-desc'}
                class=\${cn(textareaClass(), 'min-h-24 resize-none')}
              >\${values.description ?? ''}</textarea>
              <p data-slot="field-description" id="description-desc" class=\${fieldDescriptionClass()}>
                Include steps to reproduce, expected behavior, and what actually happened.
              </p>
              \${errors.description ? html\`
                <div role="alert" data-slot="field-error" id="description-error" class=\${fieldErrorClass()}>\${errors.description}</div>
              \` : ''}
            </div>
          </div>
        </div>
        <div data-slot="card-footer" class=\${cardFooterClass()}>
          <button type="submit" data-slot="button" class=\${cn(buttonClass(), 'group-aria-busy:pointer-events-none group-aria-busy:opacity-50')}>
            \${spinner({ decorative: true, class: 'hidden group-aria-busy:inline-block' })}
            Submit
          </button>
        </div>
      </div>
    </form>
  \`;
}`;

const FIELDS = ['title', 'description'] as const;

/** The parts of a failed submission's actionData the form renders. */
function formState(actionData: unknown): BugReportState {
  if (!actionData || typeof actionData !== 'object') return {};
  const pick = (v: unknown) => {
    if (!v || typeof v !== 'object') return undefined;
    const rec = v as Record<string, unknown>;
    const out: BugReportState['values'] = {};
    for (const k of FIELDS) if (typeof rec[k] === 'string') out[k] = rec[k] as string;
    return out;
  };
  const data = actionData as Record<string, unknown>;
  return { fieldErrors: pick(data.fieldErrors), values: pick(data.values) };
}

/**
 * The live demo in componentPreview's frame (lib/ui/docs/preview.ts): the
 * form rendered with this request's state, over the demo file's source.
 */
async function liveDemo(state: BugReportState) {
  const demo = await renderDemo('form-next-demo');
  return html`
    <div id="demo-form" data-slot="component-preview" data-not-typeset class="group relative mt-4 mb-12 flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border">
      <div data-slot="preview" dir="ltr">
        <div data-align="center" class="preview style-nova relative flex h-auto w-full items-center justify-center p-10">
          ${BugReportForm(state, submitBugReport)}
        </div>
      </div>
      ${demo ? html`
        <div data-slot="code" class="relative overflow-hidden [&_[data-rehype-pretty-code-figure]]:m-0! [&_[data-rehype-pretty-code-figure]]:rounded-t-none [&_[data-rehype-pretty-code-figure]]:border-t [&_pre]:max-h-72 not-has-[details[open]]:[&_pre]:max-h-[6.75rem] not-has-[details[open]]:[&_pre]:overflow-hidden">
          ${codeFigure(demo.source, { lineNumbers: true })}
          <details class="absolute inset-0 flex items-center justify-center pb-4 open:hidden">
            <summary class="absolute inset-0 flex cursor-pointer list-none items-center justify-center [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" class="absolute inset-0" style="background: linear-gradient(to top, var(--color-code), color-mix(in oklab, var(--color-code) 60%, transparent), transparent)"></span>
              <span data-slot="button" class="relative z-10 inline-flex h-8 items-center rounded-lg border bg-background px-3 text-sm font-medium text-foreground shadow-none hover:bg-muted">View Code</span>
            </summary>
          </details>
        </div>` : ''}
    </div>`;
}

export default async function body(toc: TocEntry[], ctx: DocPageContext = {}) {
  return html`
    <p>In this guide, we will take a look at building forms with WebJs, using a server action bound to a <code>&lt;form&gt;</code>. We'll cover building forms, validation, pending states, accessibility, and more.</p>
    <p>A WebJs form is a <code>'use server'</code> action bound with <code>&lt;form action=\${importedAction}&gt;</code>, rendered with the <a href="/ui/docs/components/field">Field</a> helpers. The same form works with JavaScript off.</p>

    ${heading(toc, 2, 'Demo')}
    <p>We are going to build the following form with a simple text input and a textarea. On submit, a server action validates the form data, and the page re-renders with the errors when it is invalid.</p>
    ${await liveDemo(formState(ctx.actionData))}
    ${callout(html`<p><strong>Note:</strong> The examples on this page intentionally set <code>novalidate</code> on the form, to show how validation and form errors work in a server action. The demo is live: submit it with short values to see the errors, with or without JavaScript.</p>`)}

    ${heading(toc, 2, 'Approach')}
    <p>This form leverages WebJs's built-in form handling. We'll build our form with the Field helpers, which give you <strong>complete flexibility over the markup and styling</strong>.</p>
    <ul>
      <li>A native <code>&lt;form&gt;</code> bound to a server action with <code>action=\${submitBugReport}</code>, which submits with JavaScript off and through the client router with it on.</li>
      <li>The Field helpers (<code>fieldClass()</code>, <code>fieldLabelClass()</code>, <code>fieldErrorClass()</code>) for building accessible forms.</li>
      <li><code>actionData</code> on the page for the form state and errors.</li>
      <li>The <code>aria-busy</code> attribute the router sets on a submitting form for loading states.</li>
      <li>Server-side validation in the action, returning <code>fieldErrors</code>.</li>
    </ul>

    ${heading(toc, 2, 'Anatomy')}
    <p>Here's a basic example of a form using the Field helpers.</p>
    ${codeFigure(`<form action=\${submitBugReport}>
  <div data-slot="field-group" class=\${fieldGroupClass()}>
    <div data-slot="field" data-invalid=\${errors.title ? 'true' : null} class=\${fieldClass()}>
      <label data-slot="field-label" for="title" class=\${fieldLabelClass()}>Bug Title</label>
      <input
        data-slot="input"
        id="title"
        name="title"
        value=\${values.title ?? ''}
        aria-invalid=\${errors.title ? 'true' : null}
        placeholder="Login button not working on mobile"
        autocomplete="off"
        class=\${inputClass()}
      >
      <p data-slot="field-description" class=\${fieldDescriptionClass()}>
        Provide a concise title for your bug report.
      </p>
      \${errors.title ? html\`<div role="alert" data-slot="field-error" class=\${fieldErrorClass()}>\${errors.title}</div>\` : ''}
    </div>
  </div>
  <button type="submit" data-slot="button" class=\${buttonClass()}>Submit</button>
</form>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Usage')}

    ${heading(toc, 3, 'Validate the form data')}
    <p>We'll start with the rules the form data has to meet. Write the checks in the action, as below, or call the schema library of your choice there. Whatever you use, turn its result into a <code>fieldErrors</code> object keyed by field name.</p>

    ${heading(toc, 3, 'Define the form state type')}
    <p>Next, the shape the action returns and the page reads. An action returns the <code>ActionResult</code> envelope, and on a failure the page receives it as <code>actionData</code>.</p>
    ${codeFigure(`type FormState = {
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};`, { title: 'app/bugs/new/page.ts', lineNumbers: true })}
    <p><code>fieldErrors</code> is what the action returned. <code>values</code> is filled in for you: on a failure it carries every text field that was submitted.</p>

    ${heading(toc, 3, 'Create the Server Action')}
    <p>A server action is a function in a <code>.server.ts</code> file marked <code>'use server'</code>. It runs on the server, and a form bound to it posts its <code>FormData</code> to it. We'll use it to validate the form data and decide what the page shows next.</p>
    ${codeFigure(ACTION, { title: 'modules/bugs/actions/submit-bug-report.server.ts', lineNumbers: true })}
    <p><strong>Note:</strong> The action does not return the submitted values. On a failure, the page's <code>actionData.values</code> already carries every submitted text field, so the form can refill itself. Return <code>values</code> only to normalize or clear a field.</p>

    ${heading(toc, 3, 'Build the form')}
    <p>We can now build the form with the Field helpers. The page imports the action and binds it to the form, and reads <code>actionData</code> for the errors and the typed values.</p>
    ${codeFigure(PAGE, { title: 'app/bugs/new/page.ts', lineNumbers: true })}

    ${heading(toc, 3, 'Done')}
    <p>That's it. You now have a fully accessible form with server-side validation that works with or without JavaScript.</p>
    <p>When you submit the form, the browser posts it to the page's own URL, and WebJs runs the bound action on the server.</p>
    <p>If the form data is invalid, the action returns the errors, and the page re-renders with them at status <code>422</code>. If the form data is valid, the response is a <code>303</code> redirect back to the page, or to the <code>redirect</code> path the action returns. With JavaScript on, the client router does the same over <code>fetch</code> and swaps the result in without a reload.</p>

    ${heading(toc, 2, 'Pending States')}
    <p>While a form submits through the client router, the router sets <code>aria-busy="true"</code> on the <code>&lt;form&gt;</code> and back to <code>"false"</code> when the response is applied. Put <code>group</code> on the form and style its contents with the <code>group-aria-busy:</code> variant to show loading indicators.</p>
    ${codeFigure(`<form action=\${submitBugReport} class="group">
  <div data-slot="field" class=\${cn(fieldClass(), 'group-aria-busy:opacity-50')}>
    <label data-slot="field-label" for="name" class=\${fieldLabelClass()}>Name</label>
    <input data-slot="input" id="name" name="name" class=\${inputClass()}>
  </div>
  <button type="submit" data-slot="button" class=\${cn(buttonClass(), 'group-aria-busy:pointer-events-none group-aria-busy:opacity-50')}>
    \${spinner({ decorative: true, class: 'hidden group-aria-busy:inline-block' })}
    Submit
  </button>
</form>`, { lineNumbers: true })}
    <p>The router also dispatches <code>webjs:submit-start</code> and <code>webjs:submit-end</code> events on the form, for a component that needs to react in script. With JavaScript off, the browser's own page load is the pending state.</p>

    ${heading(toc, 2, 'Disabled States')}
    ${heading(toc, 3, 'Submit Button')}
    <p>To make the submit button inert while the form is submitting, use the <code>group-aria-busy:</code> variant on the button, since the busy state is an attribute on the form.</p>
    ${codeFigure(`<button type="submit" data-slot="button" class=\${cn(buttonClass(), 'group-aria-busy:pointer-events-none group-aria-busy:opacity-50')}>
  \${spinner({ decorative: true, class: 'hidden group-aria-busy:inline-block' })}
  Submit
</button>`, { lineNumbers: true })}
    ${heading(toc, 3, 'Field')}
    <p>To apply a disabled state and styling to a field, put <code>data-disabled="true"</code> on the field and <code>disabled</code> on the control.</p>
    ${codeFigure(`<div data-slot="field" data-disabled="true" class=\${fieldClass()}>
  <label data-slot="field-label" for="name" class=\${fieldLabelClass()}>Name</label>
  <input data-slot="input" id="name" name="name" disabled class=\${inputClass()}>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Validation')}
    ${heading(toc, 3, 'Server-side Validation')}
    <p>Validate the <code>FormData</code> in the action and return the failures as <code>fieldErrors</code>.</p>
    ${codeFigure(`export async function submitBugReport(formData: FormData): Promise<ActionResult> {
  const title = String(formData.get('title') ?? '').trim();

  if (title.length < 5) {
    return { success: false, fieldErrors: { title: 'Bug title must be at least 5 characters.' } };
  }

  return { success: true };
}`, { title: 'modules/bugs/actions/submit-bug-report.server.ts', lineNumbers: true })}
    <p>An action can also declare its validation as a <code>validate</code> export beside it. The framework calls it with the submitted <code>FormData</code> before the action runs, and a <code>{ success: false, fieldErrors }</code> result re-renders the page without running the action. See <a href="/docs/server-actions">Server Actions</a>.</p>

    ${heading(toc, 3, 'Business Logic Validation')}
    <p>You can add additional custom validation logic in your server action, such as a check against the database.</p>
    ${codeFigure(`export async function signUp(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim();

  if (!email.includes('@')) {
    return { success: false, fieldErrors: { email: 'Enter a valid email address.' } };
  }

  // Check if email already exists in database.
  const [existing] = await db.select().from(users).where(eq(users.email, email));

  if (existing) {
    return { success: false, fieldErrors: { email: 'This email is already registered.' } };
  }

  return { success: true, redirect: '/welcome' };
}`, { title: 'modules/auth/actions/sign-up.server.ts', lineNumbers: true })}

    ${heading(toc, 2, 'Displaying Errors')}
    <p>Display errors next to the field with <code>fieldErrorClass()</code>. Make sure to add <code>data-invalid="true"</code> to the field and <code>aria-invalid="true"</code> to the control, and point the control's <code>aria-describedby</code> at the error so a screen reader reads it.</p>
    ${codeFigure(`<div data-slot="field" data-invalid=\${errors.email ? 'true' : null} class=\${fieldClass()}>
  <label data-slot="field-label" for="email" class=\${fieldLabelClass()}>Email</label>
  <input
    data-slot="input"
    id="email"
    name="email"
    type="email"
    value=\${values.email ?? ''}
    aria-invalid=\${errors.email ? 'true' : null}
    aria-describedby=\${errors.email ? 'email-error' : null}
    class=\${inputClass()}
  >
  \${errors.email ? html\`<div role="alert" data-slot="field-error" id="email-error" class=\${fieldErrorClass()}>\${errors.email}</div>\` : ''}
</div>`, { lineNumbers: true })}
    <p>Render the error element only when there is an error, so <code>aria-describedby</code> never points at an id that is not on the page.</p>

    ${heading(toc, 2, 'Resetting the Form')}
    <p>A successful submission redirects, so the page renders fresh and the form is empty. A failed one re-renders the same page, so what was typed is kept.</p>
    ${heading(toc, 3, 'Reset on Success')}
    <p>To reset the form on success, return <code>{ success: true }</code>. The response is a <code>303</code> redirect, and the page it lands on has no <code>actionData</code>, so every field renders empty. Return a <code>redirect</code> path to land somewhere else.</p>
    ${codeFigure(`export async function submitBugReport(formData: FormData): Promise<ActionResult> {
  // Validation.
  if (Object.keys(fieldErrors).length) {
    return { success: false, fieldErrors };
  }

  // Business logic.
  await callYourDatabaseOrAPI(formData);

  // A success redirects, so the form renders empty.
  return { success: true };
}`, { title: 'modules/bugs/actions/submit-bug-report.server.ts', lineNumbers: true })}
    ${heading(toc, 3, 'Preserve on Validation Errors')}
    <p>On a failure, the page receives every submitted text field in <code>actionData.values</code>. Render each control's value from it, which is what keeps the input when JavaScript is off.</p>
    ${codeFigure(`<input data-slot="input" id="title" name="title" value=\${values.title ?? ''} class=\${inputClass()}>
<textarea data-slot="textarea" id="description" name="description" class=\${textareaClass()}>\${values.description ?? ''}</textarea>`, { lineNumbers: true })}
    <p>With JavaScript on, the client router also puts back what was typed into any control the re-render did not set, so a field you forget to refill is not emptied. Passwords and files are never restored. Opt a form out with <code>data-preserve-values="false"</code>. To clear a field after a failure, return a <code>values</code> entry for it, which wins over the submitted one.</p>
  `;
}
