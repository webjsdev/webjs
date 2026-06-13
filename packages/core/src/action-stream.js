/**
 * Streaming RPC wire protocol (#489), shared by the server (which frames an
 * action's streamed result) and the client RPC stub (which decodes it). It lives
 * in core because both sides need the EXACT same byte format; the server imports
 * `encodeFrame` and the stub imports `createFrameDecoder` from `@webjsdev/core`.
 *
 * An action that returns a `ReadableStream` / async iterable / async generator
 * streams its chunks over a single RPC response (one fetch, not multiplexed, so
 * no stream-id is needed). The response carries `STREAM_CONTENT_TYPE`, and its
 * body is a sequence of length-prefixed frames:
 *
 *   ┌────────┬──────────────┬──────────────────────┐
 *   │ type:1 │  length:4 BE │  payload: length bytes│
 *   └────────┴──────────────┴──────────────────────┘
 *
 *   - CHUNK (1): payload is one serialized chunk value (the same wire format the
 *     RPC envelope uses, so a rich value round-trips). The client deserializes it
 *     and yields it from the async iterable the stub returns.
 *   - END   (2): length 0, no payload. Clean completion; the iterable returns.
 *   - ERROR (3): payload is the (author-controlled) error message string. The
 *     stream errored after the first byte, so it cannot change the HTTP status;
 *     the client throws this message from the iterable instead.
 *
 * Pure byte manipulation, no DOM and no `node:*` deps, so it is safe in the
 * browser bundle and on the server alike.
 */

/** The RPC content type for a framed streamed result. */
export const STREAM_CONTENT_TYPE = 'application/vnd.webjs+stream';

/** Frame type: one serialized chunk value. */
export const FRAME_CHUNK = 1;
/** Frame type: clean end of stream (empty payload). */
export const FRAME_END = 2;
/** Frame type: the stream errored mid-flight (payload is the message). */
export const FRAME_ERROR = 3;

const EMPTY = new Uint8Array(0);

/**
 * Frame a payload as `[type:1][length:4 BE][payload]`. `payload` may be omitted
 * for a zero-length frame (END).
 * @param {number} type one of FRAME_CHUNK / FRAME_END / FRAME_ERROR
 * @param {Uint8Array} [payload]
 * @returns {Uint8Array}
 */
export function encodeFrame(type, payload) {
  const body = payload || EMPTY;
  const len = body.length;
  const out = new Uint8Array(5 + len);
  out[0] = type & 0xff;
  out[1] = (len >>> 24) & 0xff;
  out[2] = (len >>> 16) & 0xff;
  out[3] = (len >>> 8) & 0xff;
  out[4] = len & 0xff;
  if (len) out.set(body, 5);
  return out;
}

/**
 * A stateful decoder that turns a stream of arbitrary byte chunks back into
 * whole frames, buffering across chunk boundaries (a frame may be split over two
 * network reads, or two frames may arrive in one read). `push(chunk)` returns the
 * array of complete frames it could parse from the accumulated buffer so far;
 * partial trailing bytes stay buffered for the next `push`.
 * @returns {{ push(chunk: Uint8Array): Array<{ type: number, payload: Uint8Array }> }}
 */
export function createFrameDecoder() {
  let buf = EMPTY;
  return {
    push(chunk) {
      if (chunk && chunk.length) {
        const next = new Uint8Array(buf.length + chunk.length);
        next.set(buf, 0);
        next.set(chunk, buf.length);
        buf = next;
      }
      const frames = [];
      // A frame needs at least the 5-byte header before its length is known.
      while (buf.length >= 5) {
        const type = buf[0];
        const len = ((buf[1] << 24) | (buf[2] << 16) | (buf[3] << 8) | buf[4]) >>> 0;
        if (buf.length < 5 + len) break; // payload not fully arrived yet
        // Copy the payload out so it does not alias the (soon-reassigned) buffer.
        const payload = buf.slice(5, 5 + len);
        frames.push({ type, payload });
        buf = buf.slice(5 + len);
      }
      return frames;
    },
  };
}
