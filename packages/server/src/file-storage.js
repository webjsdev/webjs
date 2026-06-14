/**
 * File storage primitive: a pluggable `FileStore` with a streaming local-disk
 * default adapter (issue #247).
 *
 * webjs already round-trips a native `File` / `Blob` / `FormData` over the RPC
 * wire (the serializer), but nothing decided WHERE the bytes land. This module
 * is that answer. The model mirrors `cache.js` exactly: a documented interface,
 * a default adapter (`diskStore`), and a module singleton (`setFileStore` /
 * `getFileStore`) so an app swaps the backend in one call without touching any
 * call site.
 *
 * ```js
 * import { getFileStore, generateKey } from '@webjsdev/server';
 * const key = generateKey(file.name);          // opaque, traversal-safe
 * await getFileStore().put(key, file);          // streams to disk
 * const handle = await getFileStore().get(key); // { body, size, contentType }
 * ```
 *
 * Design notes:
 *
 *   - **Streaming write.** `put` never buffers the whole file. It pipes
 *     `file.stream()` -> a reader-loop async generator (`webStreamChunks`) ->
 *     `createWriteStream` via `node:stream/promises.pipeline`, so a large upload
 *     uses constant memory (the reader loop instead of `Readable.fromWeb` so a
 *     mid-stream source error propagates through `pipeline` on Bun too, #509).
 *     The upstream body-size cap (#237, `maxMultipartBytes`) bounds the size
 *     BEFORE the bytes ever reach the store, so the store does not re-implement
 *     a limit; it only stays streaming.
 *   - **Traversal-safe keys.** Every key is resolved to an absolute path under
 *     `dir` and rejected if it escapes, using the same `resolve` +
 *     `startsWith(dir + sep)` containment guard the `/public/*` serve path uses
 *     in dev.js. A key with `..`, an absolute path, a leading slash, a NUL, or a
 *     backslash is rejected BEFORE any fs operation.
 *   - **S3-pluggability.** The interface operates on web-standard objects only
 *     (`File` / `Blob` / `ReadableStream` / `Uint8Array` in, a `{ body, size,
 *     contentType }` handle out), so an S3 / R2 / GCS adapter is a drop-in: it
 *     implements the same `put` / `get` / `delete` / `url` and the call sites do
 *     not change. webjs ships no S3 SDK; see the JSDoc on `FileStore` below.
 *
 * @module file-storage
 */

import { createWriteStream, createReadStream } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { dirname, join, resolve, sep, extname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * @typedef {Object} StoredObjectHandle
 * @property {ReadableStream | import('node:stream').Readable} body
 *   The stored object's bytes as a STREAM (never the whole buffer), so a
 *   serving route can do `new Response(handle.body, { headers })` without
 *   reading the file into memory.
 * @property {number} size Byte length of the stored object.
 * @property {string} contentType The recorded MIME type (`application/octet-stream` when unknown).
 */

/**
 * @typedef {Object} PutResult
 * @property {string} key The (validated) key the object was stored under.
 * @property {number} size Byte length written.
 * @property {string} contentType The recorded MIME type.
 */

/**
 * The pluggable file-storage interface. The default `diskStore` implements it
 * for the local filesystem; an S3-compatible adapter (R2, GCS, MinIO) is a
 * drop-in replacement because every method operates on web-standard objects and
 * the call sites only ever touch this surface.
 *
 * An S3 adapter would implement the SAME four methods:
 *   - `put(key, file)`: `PutObject` (stream the body), returning `{ key, size, contentType }`.
 *   - `get(key)`: `GetObject`, returning `{ body, size, contentType }` (the SDK's response stream) or `null`.
 *   - `delete(key)`: `DeleteObject` (idempotent).
 *   - `url(key)`: the object / CDN URL (`https://cdn.example.com/<key>`).
 * Because the shape is identical, `setFileStore(s3Store({ ... }))` switches the
 * whole app with no call-site change.
 *
 * @typedef {Object} FileStore
 * @property {(key: string, file: Blob | File | ReadableStream | Uint8Array, opts?: { contentType?: string }) => Promise<PutResult>} put
 *   Stream the bytes to storage under `key`. Captures size + content-type.
 * @property {(key: string) => Promise<StoredObjectHandle | null>} get
 *   Return a streaming handle for the stored object, or `null` when absent.
 * @property {(key: string) => Promise<void>} delete
 *   Remove the stored object. Idempotent (a missing key is not an error).
 * @property {(key: string) => string} url
 *   The URL at which the stored object is served (`<baseUrl>/<key>` for `diskStore`).
 * @property {(key: string) => Promise<boolean>} [has]
 *   Whether the key exists (optional).
 */

/** Default storage root, relative to the app's cwd. gitignore-friendly. */
export const DEFAULT_UPLOAD_DIR = '.webjs/uploads';

/** Reserved suffix for the per-object content-type sidecar (`<key>.meta`). */
const META_SUFFIX = '.meta';

/**
 * The extension whitelist for `generateKey`. Only these (lowercased) extensions
 * are preserved on a generated key; anything else yields an extensionless key.
 * The point is that a generated key is opaque + safe, NOT that it round-trips an
 * arbitrary filename. This is a conservative set of common, inert media / doc
 * extensions; an app needing more can pass its own key.
 */
const SAFE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp',
  'pdf', 'txt', 'md', 'csv', 'json', 'xml',
  'mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'm4a',
  'zip', 'gz',
  'woff', 'woff2', 'ttf', 'otf',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
]);

/**
 * Validate a storage key and reject anything that could escape the root or is
 * otherwise unsafe. Throws on a bad key BEFORE any filesystem operation; this is
 * the security-critical seam. Mirrors the `/public/*` containment guard
 * (`resolve` + `startsWith(root + sep)`) in dev.js.
 *
 * Rejected: an empty / non-string key, a key with a NUL byte, an absolute path,
 * a leading slash or backslash, any `..` segment, any backslash (Windows
 * separator), and ANY key that does not resolve to a path strictly under `dir`.
 *
 * @param {string} dir The (already absolute) storage root.
 * @param {string} key The caller-supplied key.
 * @returns {string} The absolute path the key resolves to, guaranteed under `dir`.
 */
export function assertSafeKey(dir, key) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('file-storage: key must be a non-empty string');
  }
  // A NUL byte truncates a C string, so a key like `a\0.txt` can desync the
  // path the JS layer validated from the path the syscall opens. Reject it.
  if (key.includes('\0')) {
    throw new Error('file-storage: key must not contain a NUL byte');
  }
  // A backslash is a path separator on Windows and a traversal vector
  // (`..\\win`), so reject it outright rather than reason about platform.
  if (key.includes('\\')) {
    throw new Error('file-storage: key must not contain a backslash');
  }
  // An absolute key or a leading slash would escape `dir` under join/resolve.
  if (key.startsWith('/') || /^[A-Za-z]:/.test(key)) {
    throw new Error('file-storage: key must be relative (no leading slash or drive)');
  }
  // Reject any `..` traversal segment up front for a clear error, even though
  // the containment check below would also catch it.
  const segments = key.split('/');
  if (segments.some((s) => s === '..')) {
    throw new Error('file-storage: key must not contain a ".." segment');
  }
  // The `.meta` suffix is RESERVED for the content-type sidecar `put` writes
  // (`<key>.meta`). Rejecting it eliminates the only namespace collision: a user
  // storing both `foo` and `foo.meta` would otherwise have `foo`'s sidecar
  // clobber the `foo.meta` object. `generateKey` never produces a `.meta` key.
  if (key.endsWith(META_SUFFIX)) {
    throw new Error(`file-storage: key must not end in "${META_SUFFIX}" (reserved for metadata)`);
  }
  // Final containment guard: resolve to an absolute path and confirm it stays
  // strictly under `dir`. This is the authoritative check (the rules above are
  // fast clear-error rejections; this one cannot be fooled).
  const abs = resolve(dir, key);
  const root = dir.endsWith(sep) ? dir : dir + sep;
  if (abs !== dir && !abs.startsWith(root)) {
    throw new Error('file-storage: key resolves outside the storage root');
  }
  // `abs === dir` means the key resolved to the root directory itself (e.g. an
  // empty-ish key), which is not a file path.
  if (abs === dir || abs === dir.replace(/[\\/]+$/, '')) {
    throw new Error('file-storage: key must name a file, not the storage root');
  }
  return abs;
}

/**
 * Normalize an arbitrary input (a `Blob` / `File` / `ReadableStream` /
 * `Uint8Array`) into a Node `Readable` stream plus an optional content type,
 * WITHOUT buffering the whole thing. This keeps the write path streaming.
 *
 * @param {Blob | File | ReadableStream | Uint8Array} file
 * @returns {{ stream: import('node:stream').Readable, contentType: string | null }}
 */
function toNodeStream(file) {
  // A Blob / File exposes a web ReadableStream via `.stream()`; consuming it
  // through a reader-loop async generator (NOT `Readable.fromWeb`) keeps it
  // streaming AND propagates a mid-stream source error reliably on both Node and
  // Bun. `Readable.fromWeb` does NOT forward a web-stream error through
  // `stream/promises.pipeline` on Bun (the `pipeline` promise never settles, so
  // `put` would hang instead of rejecting + cleaning up the partial file, #509).
  if (file && typeof file.stream === 'function' && typeof file.size === 'number') {
    const contentType = typeof file.type === 'string' && file.type ? file.type : null;
    return { stream: Readable.from(webStreamChunks(file.stream())), contentType };
  }
  // A web ReadableStream directly.
  if (file && typeof file.getReader === 'function') {
    return { stream: Readable.from(webStreamChunks(/** @type {ReadableStream} */ (file))), contentType: null };
  }
  // A Uint8Array / Buffer: wrap as a single-chunk readable. This DOES hold the
  // bytes the caller already has in memory, but it does not COPY-buffer them
  // (the caller already chose an in-memory input), and the write still streams.
  if (file instanceof Uint8Array) {
    return { stream: Readable.from([Buffer.from(file.buffer, file.byteOffset, file.byteLength)]), contentType: null };
  }
  throw new Error('file-storage: put() expects a Blob, File, ReadableStream, or Uint8Array');
}

/**
 * Read a web `ReadableStream` chunk by chunk as an async iterable. A read error
 * (a source that errors mid-stream) throws OUT of the generator, which
 * `Readable.from` surfaces as a stream `error` that `pipeline` rejects on. This
 * is the cross-runtime-reliable alternative to `Readable.fromWeb`, whose error
 * does not propagate through `pipeline` on Bun (#509).
 * @param {ReadableStream} web
 */
async function* webStreamChunks(web) {
  const reader = web.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

/**
 * Local-disk file store (the default adapter). Streams writes, never buffering
 * the whole file. `dir` is created on demand.
 *
 * @param {{ dir?: string, baseUrl?: string }} [opts]
 *   `dir` is the storage root (default `<cwd>/.webjs/uploads`). `baseUrl` is the
 *   path prefix `url(key)` returns (default `/uploads`); the app serves that
 *   prefix from a `route.{js,ts}` handler that streams `get(key)`.
 * @returns {FileStore}
 */
export function diskStore(opts = {}) {
  const dir = resolve(opts.dir || join(process.cwd(), DEFAULT_UPLOAD_DIR));
  // Normalize baseUrl to `/prefix` with no trailing slash.
  let baseUrl = opts.baseUrl == null ? '/uploads' : String(opts.baseUrl);
  if (!baseUrl.startsWith('/')) baseUrl = '/' + baseUrl;
  baseUrl = baseUrl.replace(/\/+$/, '');

  return {
    async put(key, file, putOpts = {}) {
      const abs = assertSafeKey(dir, key);
      const { stream, contentType: detected } = toNodeStream(file);
      const contentType = putOpts.contentType || detected || 'application/octet-stream';
      // Ensure the parent directory exists (supports nested keys like `a/b/c.png`).
      await mkdir(dirname(abs), { recursive: true });
      // Streaming write: pipe the source through to disk. `pipeline` handles
      // backpressure + teardown, so memory stays bounded regardless of size.
      try {
        await pipeline(stream, createWriteStream(abs));
      } catch (err) {
        // A mid-stream failure (source error, disk full) leaves a truncated
        // file. Remove it so a later read never serves a partial object under a
        // key the caller never received, then re-throw.
        try { await unlink(abs); } catch {}
        throw err;
      }
      const { size } = await stat(abs);
      // Record the content type alongside the bytes so `get` can return it. A
      // sidecar `<file>.meta` JSON keeps the object itself byte-for-byte the
      // upload (so it serves cleanly) while still capturing the type.
      try {
        const metaAbs = abs + META_SUFFIX;
        await pipeline(
          Readable.from([JSON.stringify({ contentType })]),
          createWriteStream(metaAbs),
        );
      } catch {
        // A meta-write failure is non-fatal: `get` falls back to octet-stream.
      }
      return { key, size, contentType };
    },

    async get(key) {
      const abs = assertSafeKey(dir, key);
      let info;
      try {
        info = await stat(abs);
      } catch {
        return null;
      }
      if (!info.isFile()) return null;
      let contentType = 'application/octet-stream';
      try {
        const metaAbs = abs + META_SUFFIX;
        const metaInfo = await stat(metaAbs);
        if (metaInfo.isFile()) {
          // The meta sidecar is tiny (a JSON object with a content type), so a
          // small read here is fine and does not touch the object's bytes.
          const { readFile } = await import('node:fs/promises');
          const parsed = JSON.parse(await readFile(metaAbs, 'utf8'));
          if (parsed && typeof parsed.contentType === 'string') contentType = parsed.contentType;
        }
      } catch {
        // No / unreadable meta: keep the octet-stream default.
      }
      // The body is a STREAM, so a serving route streams it to the client
      // without reading the whole file into memory.
      return {
        body: Readable.toWeb(createReadStream(abs)),
        size: info.size,
        contentType,
      };
    },

    async delete(key) {
      const abs = assertSafeKey(dir, key);
      // Idempotent: a missing file is not an error.
      try { await unlink(abs); } catch {}
      try { await unlink(abs + META_SUFFIX); } catch {}
    },

    async has(key) {
      const abs = assertSafeKey(dir, key);
      try {
        const info = await stat(abs);
        return info.isFile();
      } catch {
        return false;
      }
    },

    url(key) {
      // Validate the key so `url()` cannot mint a traversal path either.
      assertSafeKey(dir, key);
      return `${baseUrl}/${key}`;
    },
  };
}

/** @type {FileStore | null} */
let _defaultFileStore = null;

/**
 * Get the default file store. A `diskStore` rooted at `<cwd>/.webjs/uploads`
 * unless explicitly set via `setFileStore()`. No auto-detection: the app
 * decides. (Add the uploads directory to `.gitignore`.)
 *
 * @returns {FileStore}
 */
export function getFileStore() {
  if (!_defaultFileStore) _defaultFileStore = diskStore();
  return _defaultFileStore;
}

/**
 * Set the default file store. Call at app startup to point uploads at a custom
 * directory or an S3-compatible backend:
 *
 * ```js
 * import { setFileStore, diskStore } from '@webjsdev/server';
 * setFileStore(diskStore({ dir: '/var/data/uploads', baseUrl: '/files' }));
 * ```
 *
 * @param {FileStore} store
 */
export function setFileStore(store) {
  _defaultFileStore = store;
}

/**
 * Generate a random, opaque, traversal-safe storage key, preserving a sanitized
 * (whitelisted) extension from `filename` when present. This is the RECOMMENDED
 * way to derive a key: never trust a user-supplied filename as a key directly.
 *
 * A malicious `filename` (`'../../x.sh'`, `'a/b.png'`, `'evil\0.png'`) yields a
 * fully opaque `<uuid>` or `<uuid>.<ext>` key with no path component and only a
 * whitelisted extension, so the result is always safe to pass to `put`.
 *
 * @param {string} [filename] The original filename (its extension may be preserved).
 * @returns {string} A `<crypto.randomUUID()>` key, with a `.<ext>` suffix when the
 *   original extension is whitelisted.
 */
export function generateKey(filename) {
  const id = randomUUID();
  if (typeof filename !== 'string' || !filename) return id;
  // Take only the basename's extension; `extname` ignores directory parts, so a
  // path-y filename cannot inject a separator. Strip the leading dot, lowercase,
  // and accept ONLY a whitelisted alnum extension.
  const ext = extname(filename).replace(/^\./, '').toLowerCase();
  if (ext && /^[a-z0-9]+$/.test(ext) && SAFE_EXTENSIONS.has(ext)) {
    return `${id}.${ext}`;
  }
  return id;
}

// ---------------------------------------------------------------------------
// Signed URLs (HMAC-SHA256 over key + expiry, base64url). A serving route can
// gate access without a session lookup: it verifies the signature, then streams
// `get(key)`. Minimal + standards-based; no library.
// ---------------------------------------------------------------------------

/** base64url-encode a Buffer (no padding, URL-safe alphabet). */
function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Compute the HMAC-SHA256 signature (base64url) over `key.exp`. */
function signKeyExp(key, exp, secret) {
  return b64url(createHmac('sha256', secret).update(`${key}.${exp}`).digest());
}

/**
 * Mint a signed, expiring URL for a stored object. The signature covers the
 * exact key AND the expiry, so neither can be tampered with. The returned string
 * is `<base>?key=<key>&exp=<unixSeconds>&sig=<base64url>` (base defaults to
 * `getFileStore().url(key)`, so it lands on the app's serving route).
 *
 * @param {string} key The storage key.
 * @param {{ secret: string, expiresIn?: number, base?: string }} opts
 *   `secret` signs the URL; `expiresIn` is seconds from now (default 3600);
 *   `base` is the URL path the query is appended to (default `getFileStore().url(key)`).
 * @returns {string} The signed URL.
 */
export function signedUrl(key, opts) {
  if (!opts || !opts.secret) throw new Error('signedUrl: a secret is required');
  if (typeof key !== 'string' || !key) throw new Error('signedUrl: a key is required');
  // Default to 1 hour ONLY when expiresIn is omitted. An explicit value is
  // honored literally, so `0` / a negative number fails CLOSED (the minted exp
  // is at or before now, so the URL is already expired) instead of silently
  // granting a 1-hour URL.
  const expiresIn = typeof opts.expiresIn === 'number' && Number.isFinite(opts.expiresIn)
    ? opts.expiresIn
    : 3600;
  const exp = Math.floor(Date.now() / 1000) + Math.floor(expiresIn);
  const sig = signKeyExp(key, exp, opts.secret);
  const base = opts.base != null ? opts.base : getFileStore().url(key);
  const sep2 = base.includes('?') ? '&' : '?';
  return `${base}${sep2}key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
}

/**
 * Verify a signed URL (or its parsed params). Returns `{ valid, key, reason }`.
 * Fails on a wrong secret (signature mismatch), an expired URL, a tampered key,
 * or missing params. The comparison is constant-time.
 *
 * @param {string | URL | URLSearchParams | { key?: string, exp?: string | number, sig?: string }} input
 *   A full URL string, a `URL`, a `URLSearchParams`, or a `{ key, exp, sig }` object.
 * @param {string} secret The same secret passed to `signedUrl`.
 * @returns {{ valid: boolean, key: string | null, reason?: string }}
 */
export function verifySignedUrl(input, secret) {
  if (!secret) return { valid: false, key: null, reason: 'no secret' };
  let key = null;
  let exp = null;
  let sig = null;
  try {
    if (typeof input === 'string') {
      // Parse against a dummy base so a bare path string works too.
      const u = new URL(input, 'http://x.invalid');
      key = u.searchParams.get('key');
      exp = u.searchParams.get('exp');
      sig = u.searchParams.get('sig');
    } else if (input instanceof URL) {
      key = input.searchParams.get('key');
      exp = input.searchParams.get('exp');
      sig = input.searchParams.get('sig');
    } else if (input instanceof URLSearchParams) {
      key = input.get('key');
      exp = input.get('exp');
      sig = input.get('sig');
    } else if (input && typeof input === 'object') {
      key = input.key != null ? String(input.key) : null;
      exp = input.exp != null ? String(input.exp) : null;
      sig = input.sig != null ? String(input.sig) : null;
    }
  } catch {
    return { valid: false, key: null, reason: 'unparseable' };
  }
  if (!key || !exp || !sig) return { valid: false, key: null, reason: 'missing params' };
  const expNum = Number(exp);
  if (!Number.isFinite(expNum)) return { valid: false, key: null, reason: 'bad expiry' };
  // `>=` so an exp at the current second is expired: a URL minted with
  // `expiresIn: 0` (exp === now) fails closed instead of being valid for the
  // remainder of the current second.
  if (Math.floor(Date.now() / 1000) >= expNum) return { valid: false, key, reason: 'expired' };
  // Recompute the expected signature over the SAME key + exp and compare in
  // constant time. A tampered key changes the expected signature, so it fails.
  const expected = signKeyExp(key, expNum, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, key, reason: 'signature mismatch' };
  }
  return { valid: true, key };
}
