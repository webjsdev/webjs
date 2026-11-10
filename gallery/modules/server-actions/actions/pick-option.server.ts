'use server';
// The action each option's form is bound to with `.bind(null, option)`, the way
// a Next.js app passes an extra argument to a form action. The bound argument
// arrives first and the submitted fields after it, with JavaScript on or off.
// A visitor can rewrite a bound argument like any field (the action is a public
// endpoint), so it is checked here like any other input.
const OPTIONS = ['tea', 'coffee', 'water'];

export async function pickOption(option: string, input: { note?: string }) {
  if (!OPTIONS.includes(option)) return { success: false as const, error: 'Unknown option.' };
  const note = String(input.note ?? '').trim();
  return { success: true as const, data: { picked: option, note } };
}
