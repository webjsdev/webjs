'use server';

// A form-bound action receives the FormData, on the JS and no-JS paths alike.
// A failure re-renders the page at 422 with fieldErrors and values; a success
// RETURNS `{ success: true, redirect }` for a 303. Never THROW `redirect()`
// from a form action: that is a 307, which re-POSTs the body and runs the
// mutation twice.
export interface Result {
  success: boolean;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  redirect?: string;
}

export async function sendMessage(formData: FormData): Promise<Result> {
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
