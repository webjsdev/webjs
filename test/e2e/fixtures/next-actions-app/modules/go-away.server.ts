'use server';
import { redirect } from '@webjsdev/core';

/** redirect() from an action called over RPC: the client router navigates. */
export async function goAway(): Promise<void> {
  redirect('/counter');
}
