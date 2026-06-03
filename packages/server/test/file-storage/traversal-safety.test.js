/**
 * Traversal safety (SECURITY, adversarial) for the file store (issue #247).
 *
 * The non-negotiable invariant: a key with `..`, an absolute path, a leading
 * slash, a NUL, or a backslash MUST be rejected (throw) BEFORE any fs op, and
 * MUST NOT create / read / delete any file outside `dir`. A safe nested key
 * stays allowed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import { diskStore, assertSafeKey } from '../../src/file-storage.js';

const ADVERSARIAL_KEYS = [
  '../escape.txt',
  '/etc/passwd',
  'a/../../b',
  '..\\win',
  'a\\b',
  'sub/../../../x',
  'evil\0.txt',
  '/',
  '',
  '..',
  'C:\\windows\\x',
];

test('assertSafeKey rejects every adversarial key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-fs-guard-'));
  try {
    for (const key of ADVERSARIAL_KEYS) {
      assert.throws(() => assertSafeKey(dir, key), /file-storage/, `should reject ${JSON.stringify(key)}`);
    }
    // A safe nested key resolves to a path under dir.
    const abs = assertSafeKey(dir, 'a/b/c.txt');
    assert.ok(abs.startsWith(dir), 'safe key stays under dir');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('put/get/delete reject traversal keys and touch no file outside dir', async () => {
  // A parent dir holding both the storage root AND a sibling secret file.
  const parent = mkdtempSync(join(tmpdir(), 'webjs-fs-parent-'));
  const dir = join(parent, 'store');
  const secretPath = join(parent, 'secret.txt');
  try {
    writeFileSync(secretPath, 'TOP SECRET');
    const store = diskStore({ dir });

    for (const key of ADVERSARIAL_KEYS) {
      await assert.rejects(() => store.put(key, new Blob([Buffer.from('x')])), /file-storage/);
      await assert.rejects(() => store.get(key), /file-storage/);
      await assert.rejects(() => store.delete(key), /file-storage/);
    }

    // The sibling secret is intact and unread/undeleted.
    assert.ok(existsSync(secretPath), 'secret survived');
    assert.equal(readFileSync(secretPath, 'utf8'), 'TOP SECRET');

    // Nothing leaked into the parent besides the secret (the store dir is only
    // created on a successful put, and every put above was rejected).
    const entries = readdirSync(parent).sort();
    assert.deepEqual(entries, ['secret.txt'], 'no stray files in parent');
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('a real `..` escape would have written outside dir (counterfactual)', async () => {
  // Prove the guard MATTERS: a raw join with `../escape.txt` resolves outside.
  const parent = mkdtempSync(join(tmpdir(), 'webjs-fs-cf-'));
  const dir = join(parent, 'store');
  try {
    const store = diskStore({ dir });
    // The store rejects it...
    await assert.rejects(() => store.put('../escape.txt', new Blob([Buffer.from('x')])), /file-storage/);
    // ...and confirm the escape target was never created.
    assert.equal(existsSync(join(parent, 'escape.txt')), false);
    // Sanity: the path it WOULD have hit is genuinely outside dir.
    const wouldHit = join(dir, '../escape.txt');
    assert.equal(dirname(wouldHit), parent, 'the unsafe target is outside the store dir');
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
