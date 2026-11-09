'use server';
// Next idiom: a form action written for `useActionState`, taking
// `(prevState, formData)`, returning `{ errors }` on failure and throwing
// `redirect()` after the write succeeds.
import { redirect } from '@webjsdev/core';

export type SignState = { errors?: { name?: string } } | undefined;

export async function sign(prevState: SignState, formData: FormData): Promise<SignState> {
  void prevState;
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { errors: { name: 'Name is required' } };
  redirect('/guestbook?thanks=1');
}
