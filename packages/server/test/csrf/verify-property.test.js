/**
 * CSRF property test (issue #187, subsystem hardening).
 *
 * INVARIANT: `verify(req)` returns true iff the `x-webjs-csrf` header equals
 * the `webjs_csrf` cookie token, and false for every mismatch (a single-byte
 * tamper, a length change, a missing cookie or header). The existing
 * csrf.test.js checks a few cases; this asserts the property across many
 * tokens and every single-position bit-flip, pinning the constant-time
 * compare against an off-by-one that would accept a near-miss.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newToken, verify, CSRF_COOKIE, CSRF_HEADER } from '../../src/csrf.js';

const reqWith = (cookieTok, headerTok) => {
  const headers = {};
  if (cookieTok != null) headers.cookie = `${CSRF_COOKIE}=${cookieTok}`;
  if (headerTok != null) headers[CSRF_HEADER] = headerTok;
  return new Request('http://x/', { method: 'POST', headers });
};

test('matching cookie and header always verify', () => {
  for (let i = 0; i < 50; i++) {
    const t = newToken();
    assert.equal(verify(reqWith(t, t)), true, 'a matching token must verify');
  }
});

test('every single-character tamper of the header is rejected', () => {
  const t = newToken();
  for (let i = 0; i < t.length; i++) {
    const flipped = t.slice(0, i) + (t[i] === '0' ? '1' : '0') + t.slice(i + 1);
    if (flipped === t) continue; // the flip changed nothing (non-hex edge)
    assert.equal(verify(reqWith(t, flipped)), false, `a tamper at position ${i} must be rejected`);
  }
});

test('length-mismatched tokens are rejected', () => {
  const t = newToken();
  assert.equal(verify(reqWith(t, t + 'a')), false, 'longer header rejected');
  assert.equal(verify(reqWith(t, t.slice(0, -1))), false, 'shorter header rejected');
  assert.equal(verify(reqWith(t, '')), false, 'empty header rejected');
});

test('a missing cookie or header is rejected', () => {
  const t = newToken();
  assert.equal(verify(reqWith(null, t)), false, 'missing cookie rejected');
  assert.equal(verify(reqWith(t, null)), false, 'missing header rejected');
  assert.equal(verify(reqWith(null, null)), false, 'both missing rejected');
});

test('a different valid token does not verify against the cookie', () => {
  for (let i = 0; i < 50; i++) {
    const a = newToken();
    let b = newToken();
    while (b === a) b = newToken();
    assert.equal(verify(reqWith(a, b)), false, 'two independently-issued tokens must not match');
  }
});
