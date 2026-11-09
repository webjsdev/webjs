/**
 * Next.js conformance: `notFound()` inside a streamed boundary (#1686). Quotes
 * `docs/01-app/03-api-reference/04-functions/not-found.mdx` from the local
 * clone at `frameworks/next.js`: the exception "propagates to the nearest
 * `not-found` boundary, which renders in place of the streamed-in content,
 * even though the page shell has already been sent", and "The response starts
 * streaming from the `<Suspense>` boundary before `notFound()` runs, so it
 * keeps its `200` status. Next.js adds a `noindex` tag." `forbidden()` and
 * `unauthorized()` stream the same way (loading.mdx, "Status codes").
 *
 * It used to stream an empty boundary at 200, indexable, with no not-found UI.
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

async function render(throwCall, files, dev) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-conf-stream-nf-'));
  try {
    const w = (rel, body) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), body); };
    w('package.json', JSON.stringify({ name: 'conf-stream-nf', type: 'module' }));
    w('app/page.js',
      `import { html, Suspense, notFound, forbidden } from ${CORE};\n`
      + `export default function P() {\n`
      + `  const section = new Promise((r) => setTimeout(r, 5)).then(() => ${throwCall});\n`
      + `  return html\`<main><h1>page</h1>\${Suspense({ fallback: html\`<p>loading</p>\`, children: section })}</main>\`;\n}\n`);
    for (const [rel, body] of Object.entries(files)) w(rel, body);
    const app = await createRequestHandler({ appDir: dir, dev, logger: { info() {}, warn() {}, error() {}, debug() {} } });
    const res = await app.handle(new Request('http://localhost/'));
    return { status: res.status, body: await res.text() };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const notFoundFile = { 'app/not-found.js': `import { html } from ${CORE};\nexport default () => html\`<h2>No such post</h2>\`;\n` };

for (const dev of [false, true]) {
  test(`notFound() streamed: "keeps its 200 status", the nearest not-found boundary "renders in place", "Next.js adds a noindex tag" (${dev ? 'dev' : 'prod'})`, async () => {
    const { status, body } = await render('notFound()', notFoundFile, dev);
    assert.equal(status, 200, 'the shell was already sent');
    assert.match(body, /<template data-webjs-resolve="[^"]+"><h2>No such post<\/h2><\/template>/, 'the boundary renders in place of the streamed content');
    assert.match(body, /<meta name="robots" content="noindex">/, 'a noindex tag');
    assert.match(body, /document\.head\.insertAdjacentHTML\('beforeend','<meta name="robots" content="noindex">'\)/, 'moved into the head for a crawler that runs scripts');
    assert.doesNotMatch(body, /<p>error:/, 'notFound is control flow, not an error');
  });
}

test('with no not-found file the default heading streams in its place', async () => {
  const { body } = await render('notFound()', {}, false);
  assert.match(body, /<template data-webjs-resolve="[^"]+"><h1>404: Not found<\/h1><\/template>/);
});

test('forbidden() streams the nearest forbidden boundary the same way', async () => {
  const { status, body } = await render('forbidden()', {
    'app/forbidden.js': `import { html } from ${CORE};\nexport default () => html\`<h2>Members only</h2>\`;\n`,
  }, false);
  assert.equal(status, 200);
  assert.match(body, /<template data-webjs-resolve="[^"]+"><h2>Members only<\/h2><\/template>/);
  assert.match(body, /<meta name="robots" content="noindex">/);
});

test('an ordinary streamed error is unchanged: silent in prod, no noindex', async () => {
  const { body } = await render(`Promise.reject(new Error('db down'))`, notFoundFile, false);
  assert.doesNotMatch(body, /No such post/);
  assert.doesNotMatch(body, /name="robots"/);
});
