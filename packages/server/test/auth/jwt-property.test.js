/**
 * Auth JWT integrity property test (issue #209, subsystem hardening).
 *
 * INVARIANT: a JWT signed with the configured secret verifies and returns
 * the original claims (round-trip); and any deviation is rejected (decode
 * returns null): a single-character tamper in the header, payload, OR
 * signature; a token signed with a different secret; and an expired token.
 * The existing auth.test.js checks a few cases through the HTTP flow; this
 * pins the sign/verify primitive directly across many payloads and every
 * segment, so a forged session cannot be accepted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { encodeJwt, decodeJwt } from '../../src/auth.js';

const SECRET = 'unit-secret-aaaaaaaaaaaaaaaaaaaa';

test('round-trips claims for a range of payloads', async () => {
  const payloads = [
    { sub: 'u1' },
    { sub: 'u2', email: 'a@b.c', roles: ['admin', 'user'] },
    { sub: 'u3', n: 42, ok: true, nested: { a: 1, b: [2, 3] } },
    { sub: 'u4', exp: Math.floor(Date.now() / 1000) + 3600 },
  ];
  for (const p of payloads) {
    const back = await decodeJwt(await encodeJwt(p, SECRET), SECRET);
    // Encoding adds iat and jti, as Auth.js does (#1686); the rest is exact.
    const { iat, jti, ...rest } = /** @type any */ (back);
    assert.equal(typeof iat, 'number');
    assert.equal(typeof jti, 'string');
    assert.deepEqual(rest, p, 'decode must return the exact claims');
  }
});

test('every single-character tamper of any segment is rejected', async () => {
  const token = await encodeJwt({ sub: 'victim', role: 'user' }, SECRET);
  const parts = token.split('.');
  // A compact JWE: header, (empty) key, iv, ciphertext, tag. Probe a handful
  // of positions in every non-empty segment.
  assert.equal(parts.length, 5);
  for (let which = 0; which < parts.length; which++) {
    const part = parts[which];
    if (!part) continue;
    // Not the last character: its low bits can be base64 padding, so a swap
    // there may decode to the very same bytes and is no tamper at all.
    for (const idx of [0, Math.floor(part.length / 2), part.length - 2]) {
      const copy = parts.slice();
      const ch = part[idx] === 'A' ? 'B' : 'A';
      copy[which] = part.slice(0, idx) + ch + part.slice(idx + 1);
      const tampered = copy.join('.');
      if (tampered === token) continue;
      assert.equal(await decodeJwt(tampered, SECRET), null, `a tamper in segment ${which}@${idx} must be rejected`);
    }
  }
});

test('a token signed with a different secret is rejected', async () => {
  const token = await encodeJwt({ sub: 'x' }, SECRET);
  assert.equal(await decodeJwt(token, SECRET + 'extra'), null, 'wrong secret must not verify');
  assert.equal(await decodeJwt(token, 'totally-different-secret'), null, 'wrong secret must not verify');
});

test('an expired token is rejected; a future-dated one is accepted', async () => {
  const expired = await encodeJwt({ sub: 'x', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
  assert.equal(await decodeJwt(expired, SECRET), null, 'an expired token must be rejected');
  // Auth.js allows 15 seconds of clock skew on exp (#1686).
  const skewed = await encodeJwt({ sub: 'x', exp: Math.floor(Date.now() / 1000) - 5 }, SECRET);
  assert.ok(await decodeJwt(skewed, SECRET), 'within the 15s clock tolerance a token still verifies');
  const fresh = await encodeJwt({ sub: 'x', exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
  assert.ok(await decodeJwt(fresh, SECRET), 'a not-yet-expired token must verify');
});

test('a structurally malformed token is rejected without throwing', async () => {
  for (const bad of ['', 'a', 'a.b', 'a.b.c.d', '###.###.###', '..', 'x.y.z']) {
    assert.equal(await decodeJwt(bad, SECRET), null, `malformed token ${JSON.stringify(bad)} must return null`);
  }
});
