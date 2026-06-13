'use server';

/**
 * `streamTokens` is the streaming-RPC demo (#489): an async generator action.
 * Returning an async iterable makes the framework stream each yielded value over
 * the single RPC response (framed), and the generated client stub hands the
 * caller an async iterable to `for await`. A small delay between tokens makes the
 * incremental arrival observable (the e2e asserts the count climbs over time).
 */
export async function* streamTokens(n: number): AsyncGenerator<string> {
  const count = Math.max(1, Math.min(Number(n) || 0, 20));
  for (let i = 0; i < count; i++) {
    await new Promise((r) => setTimeout(r, 60));
    yield `token-${i}`;
  }
}
