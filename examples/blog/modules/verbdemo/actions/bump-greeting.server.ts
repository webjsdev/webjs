'use server';
import { bumpGreeting as bump } from '../store.server.ts';

/**
 * `bumpGreeting` is a POST mutation (#488) that invalidates the `greeting` tag,
 * so the next `getGreeting` read refetches fresh instead of serving the
 * browser-cached value. One function per file.
 */
export const invalidates = () => ['greeting'];
export async function bumpGreeting(): Promise<{ ok: true }> {
  bump();
  return { ok: true };
}
