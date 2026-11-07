'use server';

import type { ActionResult } from '@webjsdev/server';

/**
 * The live bug-report form on /ui/docs/forms (#1666, D12), shadcn's
 * form-next-demo-action.ts. It validates and stores nothing: a failure
 * returns `fieldErrors`, and the page re-renders the form with them and with
 * the submitted values, which the framework puts on `actionData.values`. A
 * success redirects back, so the form renders empty.
 */
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
}
