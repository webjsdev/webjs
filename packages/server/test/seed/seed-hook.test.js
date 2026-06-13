/**
 * Integration test for the SSR action-seed LOAD HOOK (#472).
 *
 * `module.registerHooks` is process-global, so this lives in its own file (the
 * node test runner isolates files into separate processes). It proves the
 * facade actually intercepts a real `import` of a `'use server'` module:
 *   - a faceted action records into the ambient collector when called inside
 *     `collectSeeds`, and is a transparent passthrough outside it,
 *   - a `.server.js` WITHOUT `'use server'` is NOT faceted (no seeding),
 *   - a non-function export passes through.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { registerSeedHooks, seedingEnabled, collectSeeds } from '../../src/action-seed.js';
import { hashFile } from '../../src/actions.js';
import { stringify } from '@webjsdev/core';

let dir;
let actionUrl, utilUrl;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'webjs-seedhook-'));
  const action = join(dir, 'users.server.js');
  writeFileSync(
    action,
    `'use server';\n` +
      `export async function getUser(id) { return { id, name: 'user-' + id }; }\n` +
      `export const VERSION = '1.0';\n`,
  );
  // A `.server.js` WITHOUT the 'use server' directive: a server-only utility.
  const util = join(dir, 'helpers.server.js');
  writeFileSync(util, `export async function helper(x) { return x * 2; }\n`);
  actionUrl = pathToFileURL(action).toString();
  utilUrl = pathToFileURL(util).toString();

  // Install the global hook BEFORE importing the fixtures (ESM caches by URL).
  registerSeedHooks();
});

after(() => { rmSync(dir, { recursive: true, force: true }); });

test('registerSeedHooks marks seeding enabled', () => {
  assert.equal(seedingEnabled(), true);
});

test('a faceted action records inside a collector and passes through outside', async () => {
  const mod = await import(actionUrl);
  assert.equal(typeof mod.getUser, 'function');
  assert.equal(mod.VERSION, '1.0', 'non-function export passes through the facade');

  // Inside a collector: records.
  const { value, collector } = await collectSeeds(async () => mod.getUser(3));
  assert.deepEqual(value, { id: 3, name: 'user-3' });
  const hash = await hashFile((await import('node:url')).fileURLToPath(actionUrl));
  assert.ok(collector.has(`${hash}/getUser/${await stringify([3])}`));

  // Outside a collector: transparent passthrough, no throw, correct value.
  const out = await mod.getUser(9);
  assert.deepEqual(out, { id: 9, name: 'user-9' });
});

test('a .server.js WITHOUT use server is NOT faceted (no seeding)', async () => {
  const mod = await import(utilUrl);
  const { value, collector } = await collectSeeds(async () => mod.helper(21));
  assert.equal(value, 42, 'the util still runs');
  assert.equal(collector.size, 0, 'a non-action util records no seed');
});
