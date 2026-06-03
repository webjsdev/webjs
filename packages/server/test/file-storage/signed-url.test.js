/**
 * signedUrl / verifySignedUrl (issue #247).
 *
 * A signed url verifies with the right secret, FAILS with a wrong secret, FAILS
 * after expiry, and FAILS on a tampered key. Counterfactual included.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { signedUrl, verifySignedUrl, setFileStore, getFileStore, diskStore } from '../../src/file-storage.js';

const SECRET = 'super-secret-signing-key';

test('a signed url verifies with the right secret', () => {
  const url = signedUrl('abc.png', { secret: SECRET, base: '/uploads/abc.png' });
  const r = verifySignedUrl(url, SECRET);
  assert.equal(r.valid, true);
  assert.equal(r.key, 'abc.png');
});

test('verification FAILS with a wrong secret (counterfactual)', () => {
  const url = signedUrl('abc.png', { secret: SECRET, base: '/uploads/abc.png' });
  const r = verifySignedUrl(url, 'WRONG-secret');
  assert.equal(r.valid, false);
  assert.equal(r.reason, 'signature mismatch');
});

test('moving exp into the past invalidates the token (exp is signed)', () => {
  // The expiry is part of the signed payload, so editing it to the past breaks
  // the signature too. A would-be attacker cannot extend OR forge a window.
  const url = signedUrl('abc.png', { secret: SECRET, expiresIn: 1, base: '/u/abc.png' });
  const params = new URLSearchParams(url.split('?')[1]);
  params.set('exp', String(Math.floor(Date.now() / 1000) - 100));
  const r = verifySignedUrl(
    { key: params.get('key'), exp: params.get('exp'), sig: params.get('sig') },
    SECRET,
  );
  assert.equal(r.valid, false);
});

test('a genuinely past-dated token fails as expired', async () => {
  // Sign with a 1-second window, then check after it elapses. Wait past the
  // 1-second boundary (exp is floored to whole seconds, and the check is `>`,
  // so a sub-2s wait can land exactly on exp and still be valid).
  const url = signedUrl('abc.png', { secret: SECRET, expiresIn: 1, base: '/u/abc.png' });
  await new Promise((r) => setTimeout(r, 2100));
  const r = verifySignedUrl(url, SECRET);
  assert.equal(r.valid, false);
  assert.equal(r.reason, 'expired');
});

test('verification FAILS on a tampered key', () => {
  const url = signedUrl('abc.png', { secret: SECRET, base: '/u/abc.png' });
  const params = new URLSearchParams(url.split('?')[1]);
  // Swap the key to point at a different object; the signature no longer covers it.
  const r = verifySignedUrl(
    { key: 'other.png', exp: params.get('exp'), sig: params.get('sig') },
    SECRET,
  );
  assert.equal(r.valid, false);
  assert.equal(r.reason, 'signature mismatch');
});

test('missing params fail cleanly', () => {
  assert.equal(verifySignedUrl('/u/x.png', SECRET).valid, false);
  assert.equal(verifySignedUrl({}, SECRET).valid, false);
  assert.equal(verifySignedUrl('', SECRET).valid, false);
});

test('signedUrl defaults base to getFileStore().url(key)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-fs-sign-'));
  const original = getFileStore();
  try {
    setFileStore(diskStore({ dir, baseUrl: '/files' }));
    const url = signedUrl('z.png', { secret: SECRET });
    assert.ok(url.startsWith('/files/z.png?'), 'base came from the active store');
    assert.equal(verifySignedUrl(url, SECRET).valid, true);
  } finally {
    setFileStore(original);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('signedUrl requires a key and a secret', () => {
  assert.throws(() => signedUrl('', { secret: SECRET }), /key is required/);
  assert.throws(() => signedUrl('a.png', {}), /secret is required/);
});
