'use server';
// Streaming is detected on the return value, no config export: a
// ReadableStream, async iterable or async generator is flushed yield by yield,
// back-pressured, cancelled when the client disconnects, and never cached,
// ETagged or seeded.
export async function* streamTokens(prompt: string): AsyncGenerator<string> {
  const words = `Streaming ${prompt} one token at a time, straight from the server.`.split(' ');
  for (const word of words) {
    // A delay so the streaming is visible; a real action yields as its upstream produces.
    await new Promise((r) => setTimeout(r, 140));
    yield word + ' ';
  }
}
