'use server';
import { count } from './store.server.ts';

export async function readCount(): Promise<number> {
  return count();
}
