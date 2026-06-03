/**
 * generateKey + setFileStore/getFileStore singleton (issue #247).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  generateKey,
  diskStore,
  setFileStore,
  getFileStore,
  assertSafeKey,
  DEFAULT_UPLOAD_DIR,
} from '../../src/file-storage.js';

test('generateKey produces a unique, opaque, traversal-safe key', () => {
  const k1 = generateKey('photo.png');
  const k2 = generateKey('photo.png');
  assert.notEqual(k1, k2, 'keys are unique');
  assert.match(k1, /^[0-9a-f-]{36}\.png$/, 'uuid + whitelisted ext');
  // The generated key is always safe to store.
  const dir = mkdtempSync(join(tmpdir(), 'webjs-fs-key-'));
  try {
    assert.ok(assertSafeKey(dir, k1).startsWith(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateKey sanitizes a malicious filename to a safe opaque key', () => {
  for (const evil of ['../../x.sh', 'a/b.png', 'evil\0.png', '..\\win.exe', '/etc/passwd']) {
    const key = generateKey(evil);
    // No path component, no traversal: a uuid optionally + a whitelisted ext.
    assert.match(key, /^[0-9a-f-]{36}(\.[a-z0-9]+)?$/, `safe for ${JSON.stringify(evil)}`);
    assert.ok(!key.includes('/') && !key.includes('\\') && !key.includes('\0') && !key.includes('..'));
    const dir = mkdtempSync(join(tmpdir(), 'webjs-fs-evilkey-'));
    try {
      assert.ok(assertSafeKey(dir, key).startsWith(dir), 'resolves under dir');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('generateKey drops a non-whitelisted extension', () => {
  // `.sh` is not whitelisted, so the key is extensionless (opaque uuid).
  assert.match(generateKey('script.sh'), /^[0-9a-f-]{36}$/);
  // An extensionless filename yields a bare uuid.
  assert.match(generateKey('README'), /^[0-9a-f-]{36}$/);
  // No filename: bare uuid.
  assert.match(generateKey(), /^[0-9a-f-]{36}$/);
});

test('setFileStore / getFileStore swaps the active store; default is diskStore', () => {
  const original = getFileStore();
  assert.ok(original && typeof original.put === 'function', 'default is a usable store');
  // The default url() uses the conventional uploads path.
  assert.equal(original.url('a.txt'), '/uploads/a.txt');

  const dir = mkdtempSync(join(tmpdir(), 'webjs-fs-swap-'));
  try {
    const custom = diskStore({ dir, baseUrl: '/files' });
    setFileStore(custom);
    assert.equal(getFileStore(), custom, 'getFileStore returns the set store');
    assert.equal(getFileStore().url('a.txt'), '/files/a.txt');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    setFileStore(original); // restore so we do not leak state across files
  }
});

test('DEFAULT_UPLOAD_DIR is gitignore-friendly under .webjs', () => {
  assert.equal(DEFAULT_UPLOAD_DIR, '.webjs/uploads');
});
