/**
 * handleApi() dev cache-bust: in dev, a route module is re-imported per request
 * with a `?t=<timestamp>` query so an edit is picked up without a restart.
 *
 * Split out of api.test.js (#509) when this held on Node only: Bun drops the
 * query of a `file://` specifier, so the bust was a no-op there. Since #1550
 * the bust rides a plain absolute path on Bun (`devImportSpecifier`), which
 * Bun loads fresh, so this runs on both runtimes (no longer denylisted in
 * scripts/run-bun-tests.js).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { handleApi } from '../../src/api.js';

let dir;

before(async () => { dir = await mkdtemp(join(tmpdir(), 'webjs-api-cachebust-')); });
after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

test('handleApi: dev=true cache-busts the import (re-reads the module from disk)', async () => {
  const file = join(dir, 'live.js');
  await writeFile(file, `export async function GET() { return new Response('v1'); }`);

  const route = { file };
  const r1 = await handleApi(route, {}, new Request('http://x/api/live'), true);
  assert.equal(await r1.text(), 'v1');

  // Overwrite module and call again with dev=true; cache-busting query should
  // force re-import.
  await writeFile(file, `export async function GET() { return new Response('v2'); }`);
  const r2 = await handleApi(route, {}, new Request('http://x/api/live'), true);
  assert.equal(await r2.text(), 'v2');
});
