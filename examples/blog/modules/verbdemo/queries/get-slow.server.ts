'use server';

/**
 * `getSlow` is a deliberately slow GET action (#492 demo): it lets the e2e
 * supersede an in-flight `async render()` fetch and assert it is ABORTED.
 */
export const method = 'GET';
export async function getSlow(n: number): Promise<{ n: number }> {
  await new Promise((r) => setTimeout(r, 800));
  return { n };
}
