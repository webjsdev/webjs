'use server';

// The action a <form action=${sendMessage}> submits to. It receives the
// submitted fields as one object, read as properties (`input.email`), the same
// shape this action would get over RPC. The FormData readers work on it too
// (`input.get('email')`), on the JS path and the no-JS path alike.
//
// Return a FAILURE to re-render the SAME page at 422 with the result on
// `actionData` (so the fields repopulate), or a SUCCESS with a same-site
// `redirect` for a 303 Post-Redirect-Get.
//
// To redirect on success, either RETURN `{ success: true, redirect: '/path' }` or
// THROW `redirect('/path')` as you would in Next.js. A form submission answers
// both with a 303 See Other, so the browser follows with a GET and never
// re-POSTs the mutation.
export interface Result {
  success: boolean;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  redirect?: string;
}

export interface MessageInput {
  name?: string;
  email?: string;
  message?: string;
}

export async function sendMessage(input: MessageInput): Promise<Result> {
  const name = String(input.name ?? '').trim();
  const email = String(input.email ?? '').trim();
  const message = String(input.message ?? '').trim();
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'Your name is required.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErrors.email = 'A valid email is required.';
  if (message.length < 5) fieldErrors.message = 'Message must be at least 5 characters.';
  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors, values: { name, email, message } };
  // A real app would persist / email here. We just confirm.
  return { success: true, redirect: '/features/forms?sent=1' };
}
