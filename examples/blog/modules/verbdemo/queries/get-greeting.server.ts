'use server';
import { greetingCount } from '../store.server.ts';

/**
 * `getGreeting` is a GET action (#488): a cacheable read, tagged `greeting`,
 * awaited in `<verb-greeting>`'s async render(). On first load its result is
 * SSR-seeded (#472, no hydration RPC); a later read is browser-cached until the
 * `greeting` tag is invalidated by the bump mutation. One function per file.
 */
export const method = 'GET';
export const cache = 30;
export const tags = () => ['greeting'];
export async function getGreeting(): Promise<{ text: string }> {
  return { text: `Hello #${greetingCount()}` };
}
