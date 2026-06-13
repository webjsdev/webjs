/**
 * Streaming RPC results (#489), server side.
 *
 * When a `'use server'` action returns a `ReadableStream`, an async iterable, an
 * async generator, or a Node `Readable` (all carry `Symbol.asyncIterator`, and a
 * web `ReadableStream` is normalized to one), the framework streams the chunks
 * over the single RPC response instead of buffering the whole thing. Each chunk
 * is rich-serialized and length-prefixed via the shared wire protocol in
 * `@webjsdev/core` (`encodeFrame`), so a `Date` / `Map` / `BigInt` inside a chunk
 * round-trips exactly like a normal RPC value. The generated client stub
 * (`actions.js`) decodes the frames and yields the chunks from an async iterable.
 *
 * Composes with the rest of the RPC stack:
 *   - #492 abort: the response is driven from the request's `AbortSignal`; a
 *     client disconnect (or a superseded async render) aborts the fetch, which
 *     cancels the source iterator, so a server generator stops producing.
 *   - #472 seeding: a streamed result is NOT seeded (a stream is not a
 *     serializer-safe value); `action-seed.js` skips a streamable result.
 *   - #488 verbs: streaming is orthogonal to the verb; detection is purely on the
 *     RETURN value, so a GET or a POST action can both stream.
 */
import { encodeFrame, FRAME_CHUNK, FRAME_END, FRAME_ERROR, STREAM_CONTENT_TYPE } from '@webjsdev/core';
import { getSerializer } from './serializer.js';

/**
 * Whether an action's return value should stream over the RPC wire rather than
 * buffer. True for a web `ReadableStream`, any async iterable (an async
 * generator, a Node `Readable`), but NOT for a plain object / array / string /
 * Promise / ActionResult envelope (none of which carry `Symbol.asyncIterator`).
 * @param {unknown} v
 * @returns {boolean}
 */
export function isStreamable(v) {
  if (!v || typeof v !== 'object') return false;
  if (typeof ReadableStream !== 'undefined' && v instanceof ReadableStream) return true;
  return typeof (/** @type any */ (v)[Symbol.asyncIterator]) === 'function';
}

/**
 * Normalize a streamable source to an async iterator with `next()` / `return()`.
 * A source with `Symbol.asyncIterator` (async generator, Node Readable, and a
 * web ReadableStream in modern Node) uses it directly; a ReadableStream lacking
 * async iteration falls back to a reader.
 * @param {any} source
 * @returns {{ next(): Promise<{ value: any, done?: boolean }>, return?(v?: any): Promise<any> }}
 */
function toAsyncIterator(source) {
  if (source && typeof source[Symbol.asyncIterator] === 'function') {
    return source[Symbol.asyncIterator]();
  }
  // A ReadableStream without async-iterator support: drive it from a reader.
  const reader = source.getReader();
  return {
    next: () => reader.read(),
    return: (v) => {
      try { reader.cancel(v); } catch {}
      try { reader.releaseLock(); } catch {}
      return Promise.resolve({ value: undefined, done: true });
    },
  };
}

/**
 * Build the streaming RPC `Response` for a streamable action result. The body is
 * a back-pressured `ReadableStream` of frames: one CHUNK frame per serialized
 * source value, a terminal END frame on clean completion, or an ERROR frame
 * carrying the (author-controlled) message if the source throws mid-flight (the
 * HTTP status is already 200 by then, so the error rides the frame channel).
 *
 * Back-pressure: chunks are pulled (and serialized) one at a time as the consumer
 * reads, so a slow client throttles a fast producer. Cancellation: an aborted
 * request signal (client disconnect / superseded render, #492) returns the source
 * iterator, stopping a server generator.
 *
 * @param {any} source the streamable action return value
 * @param {{ signal?: AbortSignal, onError?: (e: unknown) => void, headers?: Record<string,string> }} [opts]
 * @returns {Response}
 */
export function streamActionResponse(source, opts = {}) {
  const { signal, onError, headers } = opts;
  const s = getSerializer();
  const enc = new TextEncoder();
  const iter = toAsyncIterator(source);
  let closed = false;

  const releaseSource = (reason) => {
    if (typeof iter.return === 'function') {
      try { return Promise.resolve(iter.return(reason)).catch(() => {}); } catch {}
    }
    return Promise.resolve();
  };

  const body = new ReadableStream({
    async pull(controller) {
      if (closed) return;
      try {
        if (signal && signal.aborted) {
          closed = true;
          await releaseSource();
          controller.close();
          return;
        }
        const { value, done } = await iter.next();
        if (done) {
          closed = true;
          controller.enqueue(encodeFrame(FRAME_END));
          controller.close();
          return;
        }
        const bytes = enc.encode(await s.serialize(value));
        controller.enqueue(encodeFrame(FRAME_CHUNK, bytes));
      } catch (e) {
        closed = true;
        // Surface the original error to an APM sink + the server log, exactly
        // like the buffered error path, then ship the author-controlled message
        // on the frame channel (the status is already 200, mid-stream).
        if (typeof onError === 'function') { try { onError(e); } catch {} }
        console.error('[webjs] streaming action threw:', e);
        const msg = e instanceof Error && e.message ? e.message : 'Internal server error';
        try { controller.enqueue(encodeFrame(FRAME_ERROR, enc.encode(msg))); } catch {}
        await releaseSource(e);
        try { controller.close(); } catch {}
      }
    },
    async cancel(reason) {
      closed = true;
      await releaseSource(reason);
    },
  });

  // A client disconnect / superseded render aborts the request signal: cancel the
  // source promptly even if the consumer is not actively pulling.
  if (signal) {
    signal.addEventListener('abort', () => { releaseSource(); }, { once: true });
  }

  // A streamed result is never cacheable; mark it streamed so the conditional-GET
  // funnel never tries to buffer it into memory for an ETag.
  const h = new Headers(headers || {});
  h.set('content-type', STREAM_CONTENT_TYPE);
  h.set('cache-control', 'no-store');
  h.set('x-webjs-stream-rpc', '1');
  return new Response(body, { status: 200, headers: h });
}
