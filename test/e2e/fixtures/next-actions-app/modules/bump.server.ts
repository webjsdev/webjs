'use server';
import { revalidatePath } from '@webjsdev/server';
import { increment } from './store.server.ts';

/** Increment the counter and revalidate the page that renders it (Next idiom). */
export async function bump(): Promise<number> {
  const n = increment();
  await revalidatePath('/counter');
  return n;
}
