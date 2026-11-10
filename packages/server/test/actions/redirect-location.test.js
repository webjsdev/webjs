/**
 * A thrown redirect() answers with a header that has to be a ByteString, so a
 * non-Latin target (`/日本`) used to throw inside the very catch block that was
 * answering the redirect, turning it into a 500. Every site that answers one
 * (page render, route handler, form action, RPC) now percent-encodes it.
 *
 * Also: a form action that writes and then throws redirect() evicts and
 * reports its `invalidates` tags, exactly as one that returns a result does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { headerSafeLocation } from '../../src/redirect-location.js';
import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = JSON.stringify(pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString());
const ENCODED = '/%E6%97%A5%E6%9C%AC';

test('headerSafeLocation encodes only what a header value cannot carry', () => {
  assert.equal(headerSafeLocation('/plain/path?a=1#x'), '/plain/path?a=1#x');
  assert.equal(headerSafeLocation('/日本'), ENCODED);
  assert.equal(headerSafeLocation('/a b'), '/a%20b');
  assert.equal(headerSafeLocation('/already%20encoded'), '/already%20encoded', 'an existing escape is left alone');
  assert.equal(headerSafeLocation('/😀'), '/%F0%9F%98%80', 'a full code point, not two surrogate halves');
  assert.doesNotThrow(() => new Headers({ location: headerSafeLocation('/日本 é😀') }));
});

async function app() {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-redirect-location-'));
  const files = {
    'package.json': '{"name":"r","type":"module"}',
    'app/page/page.js': `import { redirect } from ${CORE};\nexport default () => { redirect('/日本'); };\n`,
    'app/api/go/route.js': `import { redirect } from ${CORE};\nexport async function GET() { redirect('/日本'); }\n`,
    'modules/save.server.js': `'use server';\nimport { redirect } from ${CORE};\nexport const invalidates = () => ['posts'];\nexport async function save() { redirect('/日本'); }\n`,
    'app/form/page.js': `import { html } from ${CORE};\nimport { save } from '../../modules/save.server.js';\nexport default () => html\`<form action=\${save}><button>go</button></form>\`;\n`,
  };
  for (const [rel, body] of Object.entries(files)) {
    await mkdir(join(dir, dirname(rel)), { recursive: true });
    await writeFile(join(dir, rel), body);
  }
  const h = await createRequestHandler({ appDir: dir, dev: false, logger: { info() {}, warn() {}, error() {} } });
  await h.warmup?.();
  return h;
}

test('every redirect site answers a non-Latin target instead of a 500', async () => {
  const h = await app();
  const go = (path, init = {}) => h.handle(new Request('http://x' + path, { redirect: 'manual', ...init }));

  const page = await go('/page');
  assert.equal(page.status, 302, 'a page render redirect');
  assert.equal(page.headers.get('location'), ENCODED);

  const route = await go('/api/go');
  assert.equal(route.status, 307, 'a route handler redirect');
  assert.equal(route.headers.get('location'), ENCODED);

  const form = await (await go('/form')).text();
  const ident = /name="__webjs_action" value="([^"]+)"/.exec(form);
  assert.ok(ident, 'the bound form carries its identity');
  const res = await go('/form', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://x', 'sec-fetch-site': 'same-origin' },
    body: new URLSearchParams({ __webjs_action: ident[1] }),
  });
  assert.equal(res.status, 303, 'a form action redirect');
  assert.equal(res.headers.get('location'), ENCODED);
  assert.equal(res.headers.get('x-webjs-invalidate'), 'posts', 'a completed action that redirects still evicts and reports its tags');
});
