'use server';
import { redirect } from '@webjsdev/core';
import { recordRun } from './store.server.ts';

/** A create-then-redirect form action (the Next idiom): must run exactly once. */
export async function createItem(): Promise<void> {
  recordRun();
  redirect('/created');
}
