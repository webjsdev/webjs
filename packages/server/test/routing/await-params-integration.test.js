/**
 * Integration test for awaitable `params` / `searchParams` (#848), through the
 * REAL SSR pipeline (createRequestHandler().handle), not the helper in
 * isolation. Proves the Next 15/16 muscle-memory pattern works end to end: a
 * page can `const { id } = await params` AND still read `params.id` sync, and
 * the same for `searchParams`. Web-standard Request/Response, no HTTP server.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_URL = pathToFileURL(resolve(__dirname, '../../../core/src/html.js')).toString();

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-awaitparams-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

test('a page can `await params` and `await searchParams` (and still read them sync)', async () => {
  const appDir = makeApp({
    'package.json': JSON.stringify({ name: 'await-params-app' }),
    // The page awaits BOTH, then also reads sync, and prints all four values.
    'app/users/[id]/page.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `export default async function User({ params, searchParams }) {\n` +
      `  const { id } = await params;\n` +
      `  const sp = await searchParams;\n` +
      `  return html\`<main>await-id:\${id} sync-id:\${params.id} await-tab:\${sp.tab} sync-tab:\${searchParams.tab}</main>\`;\n` +
      `}\n`,
  });

  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/users/42?tab=posts'));
  assert.equal(resp.status, 200);
  const body = await resp.text();

  assert.match(body, /await-id:42/, 'await params yields the path param');
  assert.match(body, /sync-id:42/, 'sync params.id still works');
  assert.match(body, /await-tab:posts/, 'await searchParams yields the query');
  assert.match(body, /sync-tab:posts/, 'sync searchParams.tab still works');
});
