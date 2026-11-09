/**
 * Cross-runtime proof that a thrown redirect() to a non-Latin target is
 * answered (percent-encoded) at every site, page render, route handler and
 * form action, rather than throwing while building the header, and that a
 * form action that redirects still evicts its `invalidates` tags. Run from
 * the repo root:
 *
 *   node test/bun/redirect-location.mjs
 *   bun  test/bun/redirect-location.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../packages/server/src/dev.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORE = JSON.stringify(pathToFileURL(join(ROOT, 'packages/core/index.js')).toString());
const ENCODED = '/%E6%97%A5%E6%9C%AC';

const dir = mkdtempSync(join(tmpdir(), 'webjs-bun-redirect-location-'));
try {
  const files = {
    'package.json': '{"name":"r","type":"module"}',
    'app/page/page.js': `import { redirect } from ${CORE};\nexport default () => { redirect('/日本'); };\n`,
    'app/api/go/route.js': `import { redirect } from ${CORE};\nexport async function GET() { redirect('/日本'); }\n`,
    'modules/save.server.js': `'use server';\nimport { redirect } from ${CORE};\nexport const invalidates = () => ['posts'];\nexport async function save() { redirect('/日本'); }\n`,
    'app/form/page.js': `import { html } from ${CORE};\nimport { save } from '../../modules/save.server.js';\nexport default () => html\`<form action=\${save}><button>go</button></form>\`;\n`,
  };
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, dirname(rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  const h = await createRequestHandler({ appDir: dir, dev: false, logger: { info() {}, warn() {}, error() {} } });
  await h.warmup?.();
  const go = (path, init = {}) => h.handle(new Request('http://x' + path, { redirect: 'manual', ...init }));

  const page = await go('/page');
  assert.equal(page.status, 302, `${runtime}: page redirect status`);
  assert.equal(page.headers.get('location'), ENCODED, `${runtime}: page redirect location`);
  const route = await go('/api/go');
  assert.equal(route.status, 307, `${runtime}: route redirect status`);
  assert.equal(route.headers.get('location'), ENCODED, `${runtime}: route redirect location`);

  const ident = /name="__webjs_action" value="([^"]+)"/.exec(await (await go('/form')).text());
  assert.ok(ident, `${runtime}: the bound form carries its identity`);
  const res = await go('/form', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://x', 'sec-fetch-site': 'same-origin' },
    body: new URLSearchParams({ __webjs_action: ident[1] }),
  });
  assert.equal(res.status, 303, `${runtime}: form redirect status`);
  assert.equal(res.headers.get('location'), ENCODED, `${runtime}: form redirect location`);
  assert.equal(res.headers.get('x-webjs-invalidate'), 'posts', `${runtime}: a redirecting form action evicts its tags`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`redirect-location: ok on ${runtime}`);
