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
    assert.deepEqual(back, p, 'decode must return the exact signed claims');
  }
});

test('every single-character tamper of any segment is rejected', async () => {
  const token = await encodeJwt({ sub: 'victim', role: 'user' }, SECRET);
  const [h, p, s] = token.split('.');
  // Probe a handful of positions in each of the three segments.
  for (const [seg, idx] of [['h', h], ['p', p], ['s', s]].flatMap(([name, part]) =>
    [0, Math.floor(part.length / 2), part.length - 1].map((i) => [name, i]))) {
    const parts = [h, p, s];
    const which = seg === 'h' ? 0 : seg === 'p' ? 1 : 2;
    const part = parts[which];
    const ch = part[idx] === 'A' ? 'B' : 'A';
    parts[which] = part.slice(0, idx) + ch + part.slice(idx + 1);
    const tampered = parts.join('.');
    if (tampered === token) continue;
    assert.equal(await decodeJwt(tampered, SECRET), null, `a tamper in segment ${seg}@${idx} must be rejected`);
  }
});

test('a token signed with a different secret is rejected', async () => {
  const token = await encodeJwt({ sub: 'x' }, SECRET);
  assert.equal(await decodeJwt(token, SECRET + 'extra'), null, 'wrong secret must not verify');
  assert.equal(await decodeJwt(token, 'totally-different-secret'), null, 'wrong secret must not verify');
});

test('an expired token is rejected; a future-dated one is accepted', async () => {
  const expired = await encodeJwt({ sub: 'x', exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
  assert.equal(await decodeJwt(expired, SECRET), null, 'an expired token must be rejected');
  const fresh = await encodeJwt({ sub: 'x', exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
  assert.ok(await decodeJwt(fresh, SECRET), 'a not-yet-expired token must verify');
});

test('a structurally malformed token is rejected without throwing', async () => {
  for (const bad of ['', 'a', 'a.b', 'a.b.c.d', '###.###.###', '..', 'x.y.z']) {
    assert.equal(await decodeJwt(bad, SECRET), null, `malformed token ${JSON.stringify(bad)} must return null`);
  }
});
