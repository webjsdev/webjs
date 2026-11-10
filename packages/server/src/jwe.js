/**
 * The session token, encrypted as Auth.js v5 encrypts it (#1686): a compact
 * JWE with `alg: "dir"` and `enc: "A256CBC-HS512"`, keyed by HKDF-SHA256 over
 * the secret with the cookie name as salt and
 * `Auth.js Generated Encryption Key (<salt>)` as info (64 bytes), and a `kid`
 * that is the key's JWK thumbprint, so several secrets can rotate. Its
 * contents are unreadable to the browser, where a signed JWT is only base64.
 *
 * Built on Web Crypto alone (A256CBC-HS512 is AES-256-CBC plus a truncated
 * HMAC-SHA-512 over the AAD, IV, ciphertext and AAD length, RFC 7518 5.2), so
 * it runs the same on Node and Bun with no dependency. Reference:
 * `packages/core/src/jwt.ts` in the Auth.js repository.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
const ALG = 'dir';
const ENC = 'A256CBC-HS512';
/** Seconds of clock skew allowed on `exp`, as Auth.js's decode. */
const CLOCK_TOLERANCE = 15;

/** @param {ArrayBuffer | Uint8Array} buf */
function b64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} s */
function unb64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** @param {...Uint8Array} parts */
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Derived keys by secret and salt: the secret and cookie name never change, so HKDF runs once. */
const derived = new Map();

/** 64 bytes for A256CBC-HS512, as Auth.js derives them (memoized per secret and salt). */
function deriveKey(secret, salt) {
  const id = `${salt}\u0000${secret}`;
  let key = derived.get(id);
  if (!key) {
    key = deriveKeyUncached(secret, salt);
    key.catch(() => derived.delete(id));
    derived.set(id, key);
  }
  return key;
}

async function deriveKeyUncached(secret, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: enc.encode(`Auth.js Generated Encryption Key (${salt})`) },
    base,
    512,
  );
  return new Uint8Array(bits);
}

/** Thumbprints by derived key, so a token's `kid` check costs no hash after the first. */
const thumbprints = new WeakMap();

/** RFC 7638 thumbprint of the key as an `oct` JWK, SHA-512 as jose picks for a 64-byte key (memoized per key). */
async function thumbprint(key) {
  let t = thumbprints.get(key);
  if (!t) { t = thumbprintUncached(key); thumbprints.set(key, t); }
  return t;
}

async function thumbprintUncached(key) {
  const json = `{"k":"${b64url(key)}","kty":"oct"}`;
  return b64url(await crypto.subtle.digest('SHA-512', enc.encode(json)));
}

/** The A256CBC-HS512 authentication tag (RFC 7518 5.2.2.1). */
async function tagFor(macKey, aad, iv, ct) {
  const al = new Uint8Array(8);
  new DataView(al.buffer).setBigUint64(0, BigInt(aad.length * 8));
  const hk = await crypto.subtle.importKey('raw', macKey, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', hk, concat(aad, iv, ct, al))).slice(0, 32);
}

/** @param {Uint8Array} a @param {Uint8Array} b */
function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/**
 * Encrypt a session payload. `iat` and `jti` are added when absent, as
 * Auth.js's encode sets them; `exp` is the caller's.
 * @param {Record<string, unknown>} payload
 * @param {string | string[]} secret the first is the one that encrypts
 * @param {string} salt the session cookie's name
 * @returns {Promise<string>}
 */
export async function encryptSession(payload, secret, salt) {
  const key = await deriveKey(Array.isArray(secret) ? secret[0] : secret, salt);
  const kid = await thumbprint(key);
  const header = b64url(enc.encode(JSON.stringify({ alg: ALG, enc: ENC, kid })));
  const claims = { iat: Math.floor(Date.now() / 1000), jti: crypto.randomUUID(), ...payload };
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const aes = await crypto.subtle.importKey('raw', key.slice(32), 'AES-CBC', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, aes, enc.encode(JSON.stringify(claims))));
  const tag = await tagFor(key.slice(0, 32), enc.encode(header), iv, ct);
  return `${header}..${b64url(iv)}.${b64url(ct)}.${b64url(tag)}`;
}

/**
 * Decrypt a session token, or null when it is not one this app made, was
 * tampered with, or has expired. Each secret is tried, the one whose
 * thumbprint matches the token's `kid` first, as Auth.js's decode does.
 * @param {string} token
 * @param {string | string[]} secret
 * @param {string} salt the session cookie's name
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function decryptSession(token, secret, salt) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 5 || parts[1] !== '') return null;
    const [h, , ivB, ctB, tagB] = parts;
    const header = JSON.parse(dec.decode(unb64url(h)));
    if (header.alg !== ALG || header.enc !== ENC) return null;
    const iv = unb64url(ivB);
    const ct = unb64url(ctB);
    const tag = unb64url(tagB);
    const secrets = Array.isArray(secret) ? secret : [secret];
    for (const s of secrets) {
      const key = await deriveKey(s, salt);
      if (header.kid && header.kid !== (await thumbprint(key))) continue;
      if (!equalBytes(tag, await tagFor(key.slice(0, 32), enc.encode(h), iv, ct))) continue;
      const aes = await crypto.subtle.importKey('raw', key.slice(32), 'AES-CBC', false, ['decrypt']);
      const claims = JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, aes, ct)));
      if (typeof claims.exp === 'number' && Date.now() / 1000 > claims.exp + CLOCK_TOLERANCE) return null;
      return claims;
    }
    return null;
  } catch {
    return null;
  }
}
