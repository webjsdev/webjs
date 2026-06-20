/**
 * Cross-origin (CSRF) protection unit tests (#659).
 *
 * The action endpoint defends against CSRF with a `Sec-Fetch-Site` check
 * (browser-set fetch metadata) and an `Origin`-vs-host fallback for older
 * browsers, matching Remix 3's cop-middleware and Go 1.25's
 * http.CrossOriginProtection. No token cookie is involved.
 *
 * The cross-origin-reject cases are the counterfactual: if `verifyOrigin`
 * always returned ok, every `assert.equal(..., false)` here fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCookies, requestHost, verifyOrigin, readAllowedOrigins } from '../../src/csrf.js';

const reqWith = (headers, url = 'http://app.example/__webjs/action/abc/fn') =>
  new Request(url, { method: 'POST', headers });

test('parseCookies handles multiple cookies and trimming', () => {
  const req = new Request('http://x/', { headers: { cookie: 'a=1; b=two%20words; c=3' } });
  assert.deepEqual(parseCookies(req), { a: '1', b: 'two words', c: '3' });
});

test('requestHost prefers x-forwarded-host, then Host, then URL', () => {
  assert.equal(requestHost(reqWith({ 'x-forwarded-host': 'fwd.example', host: 'app.example' })), 'fwd.example');
  assert.equal(requestHost(reqWith({ host: 'app.example' })), 'app.example');
  assert.equal(requestHost(reqWith({})), 'app.example');
});

test('Sec-Fetch-Site same-origin / none pass', () => {
  assert.equal(verifyOrigin(reqWith({ 'sec-fetch-site': 'same-origin' })).ok, true);
  assert.equal(verifyOrigin(reqWith({ 'sec-fetch-site': 'none' })).ok, true);
});

test('Sec-Fetch-Site cross-site / same-site are rejected', () => {
  assert.equal(verifyOrigin(reqWith({ 'sec-fetch-site': 'cross-site' })).ok, false);
  assert.equal(verifyOrigin(reqWith({ 'sec-fetch-site': 'same-site' })).ok, false);
});

test('a cross-site request from an allowlisted origin passes', () => {
  const req = reqWith({ 'sec-fetch-site': 'cross-site', origin: 'https://trusted.example' });
  assert.equal(verifyOrigin(req, ['trusted.example']).ok, true);
  assert.equal(verifyOrigin(req, ['https://trusted.example']).ok, true, 'full-origin form also accepted');
  assert.equal(verifyOrigin(req, ['trusted.example/']).ok, true, 'a stray trailing slash is tolerated');
  assert.equal(verifyOrigin(req, ['other.example']).ok, false, 'a different allowlist does not help');
});

test('fallback: no Sec-Fetch-Site, Origin host matches host -> ok', () => {
  const req = reqWith({ origin: 'http://app.example', host: 'app.example' });
  assert.equal(verifyOrigin(req).ok, true);
});

test('fallback: no Sec-Fetch-Site, Origin host differs -> reject', () => {
  const req = reqWith({ origin: 'https://evil.example', host: 'app.example' });
  assert.equal(verifyOrigin(req).ok, false);
});

test('fallback honors x-forwarded-host (proxy / CDN)', () => {
  const req = reqWith({ origin: 'https://app.example', 'x-forwarded-host': 'app.example', host: 'internal:8080' });
  assert.equal(verifyOrigin(req).ok, true);
});

test('no Sec-Fetch-Site and no Origin is allowed (non-browser client)', () => {
  assert.equal(verifyOrigin(reqWith({ host: 'app.example' })).ok, true);
});

test("Origin 'null' (sandboxed iframe) is treated as cross-origin", () => {
  const req = reqWith({ origin: 'null', host: 'app.example' });
  assert.equal(verifyOrigin(req).ok, false);
});

test('readAllowedOrigins reads + filters webjs.allowedOrigins', () => {
  assert.deepEqual(
    readAllowedOrigins({ webjs: { allowedOrigins: ['a.example', 'https://b.example', 1, ''] } }),
    ['a.example', 'https://b.example'],
  );
  assert.deepEqual(readAllowedOrigins({}), []);
  assert.deepEqual(readAllowedOrigins(null), []);
  assert.deepEqual(readAllowedOrigins({ webjs: {} }), []);
});
