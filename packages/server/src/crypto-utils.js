/**
 * Web-Crypto-based hash helpers. Shared by the SSR / vendor / actions
 * paths that previously used `node:crypto.createHash`. The Web Crypto
 * API replaces the synchronous Node-only API with a Promise-returning
 * one; the trade-off is portability across Node, Deno, Bun, and edge
 * runtimes.
 *
 * @module crypto-utils
 */

const enc = new TextEncoder();

/**
 * @param {ArrayBuffer | Uint8Array} buf
 * @returns {string}
 */
function bufToHex(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/**
 * @param {ArrayBuffer | Uint8Array} buf
 * @returns {string}
 */
function bufToBase64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/**
 * @param {string | ArrayBufferView | ArrayBuffer} data
 * @returns {Uint8Array}
 */
function toBytes(data) {
  if (typeof data === 'string') return enc.encode(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * Compute a hex-encoded digest of `data` under `algo`.
 *
 * @param {'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'} algo
 * @param {string | ArrayBufferView | ArrayBuffer} data
 * @returns {Promise<string>}  full hex string (no truncation)
 */
export async function digestHex(algo, data) {
  return bufToHex(await crypto.subtle.digest(algo, toBytes(data)));
}

/**
 * Compute a base64-encoded digest of `data` under `algo`.
 *
 * @param {'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'} algo
 * @param {string | ArrayBufferView | ArrayBuffer} data
 * @returns {Promise<string>}
 */
export async function digestBase64(algo, data) {
  return bufToBase64(await crypto.subtle.digest(algo, toBytes(data)));
}
