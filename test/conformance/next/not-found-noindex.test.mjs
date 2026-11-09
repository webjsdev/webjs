/**
 * Next.js conformance: not-found pages are not indexed (#1686). Quotes
 * `docs/01-app/03-api-reference/03-file-conventions/not-found.mdx` from the
 * local clone at `frameworks/next.js`: "Next.js automatically injects
 * `<meta name="robots" content="noindex" />` for pages that return a 404
 * status code, including `global-not-found.js` pages." WebJs extends the same
 * to its 403 and 401 boundaries, which are error pages just the same.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../../packages/server/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const CORE = JSON.stringify(pathToFileURL(resolve(here, '../../../packages/core/index.js')).toString());

async function app(files) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-conf-noindex-'));
  const w = (rel, body) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), body); };
  w('package.json', JSON.stringify({ name: 'conf-noindex', type: 'module' }));
  w('app/layout.js', `import { html } from ${CORE};\nexport default ({ children }) => html\`<!doctype html><html><head><title>t</title></head><body>\${children}</body></html>\`;\n`);
  w('app/page.js', `import { html } from ${CORE};\nexport default () => html\`<p>home</p>\`;\n`);
  for (const [rel, body] of Object.entries(files)) w(rel, body);
  const handler = await createRequestHandler({ appDir: dir, dev: true, logger: { info() {}, warn() {}, error() {}, debug() {} } });
  const get = async (path) => { const r = await handler.handle(new Request('http://localhost' + path)); return { status: r.status, body: await r.text() }; };
  return { get, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const NOINDEX = /<meta name="robots" content="noindex">/g;

test('"injects <meta name=robots content=noindex> for pages that return a 404": an unknown url and notFound()', async () => {
  const a = await app({
    'app/gone/page.js': `import { html, notFound } from ${CORE};\nexport default () => { notFound(); return html\`\`; };\n`,
    'app/not-found.js': `import { html } from ${CORE};\nexport default () => html\`<h1>Not here</h1>\`;\n`,
  });
  try {
    for (const path of ['/no-such-page', '/gone']) {
      const { status, body } = await a.get(path);
      assert.equal(status, 404, path);
      assert.equal((body.match(NOINDEX) || []).length, 1, `${path} carries noindex once`);
      assert.match(body, /Not here/);
    }
    assert.equal(((await a.get('/')).body.match(NOINDEX) || []).length, 0, 'a normal page is left alone');
  } finally { a.done(); }
});

test('a 403 boundary is not indexed either, and robots metadata the app set is kept as is', async () => {
  const a = await app({
    'app/admin/page.js': `import { html, forbidden } from ${CORE};\nexport default () => { forbidden(); return html\`\`; };\n`,
    'app/not-found.js': `import { html } from ${CORE};\nexport const metadata = { robots: 'noindex, nofollow' };\nexport default () => html\`<h1>Not here</h1>\`;\n`,
  });
  try {
    const forbidden = await a.get('/admin');
    assert.equal(forbidden.status, 403);
    assert.equal((forbidden.body.match(NOINDEX) || []).length, 1);
    const missing = await a.get('/nope');
    assert.equal((missing.body.match(/name="robots"/g) || []).length, 1, 'no second robots meta');
  } finally { a.done(); }
});
