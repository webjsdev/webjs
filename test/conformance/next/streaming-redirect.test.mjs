/**
 * Next.js conformance: `redirect()` inside a streamed boundary (#1686). Quotes
 * `docs/01-app/03-api-reference/04-functions/redirect.mdx` from the local clone
 * at `frameworks/next.js`: "When used in a streaming context, this will insert
 * a meta tag to emit the redirect on the client side."
 *
 * A component inside `Suspense` that throws `redirect()` (an auth check in an
 * async section, a gone record) used to stream an empty boundary at 200 and
 * leave the visitor on the page.
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

async function render(dev) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-conf-stream-redirect-'));
  try {
    mkdirSync(join(dir, 'app'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'conf-stream-redirect', type: 'module' }));
    writeFileSync(join(dir, 'app/page.js'),
      `import { html, Suspense, redirect } from ${CORE};\n`
      + `export default function P() {\n`
      + `  const section = new Promise((r) => setTimeout(r, 5)).then(() => redirect('/login?next=%2F'));\n`
      + `  return html\`<main><h1>page</h1>\${Suspense({ fallback: html\`<p>loading</p>\`, children: section })}</main>\`;\n}\n`);
    const app = await createRequestHandler({ appDir: dir, dev, logger: { info() {}, warn() {}, error() {}, debug() {} } });
    const res = await app.handle(new Request('http://localhost/'));
    return { status: res.status, body: await res.text() };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const dev of [false, true]) {
  test(`"in a streaming context, this will insert a meta tag to emit the redirect on the client side" (${dev ? 'dev' : 'prod'})`, async () => {
    const { status, body } = await render(dev);
    assert.equal(status, 200, 'the shell was already sent');
    assert.match(body, /<meta http-equiv="refresh" content="0;url=\/login\?next=%2F">/, 'a refresh works with JavaScript off');
    assert.match(body, /location\.replace\("\/login\?next=%2F"\)/, 'and a script redirects at once with it on');
    assert.match(body, /<template data-webjs-resolve="[^"]+"><meta data-webjs-redirect="\/login\?next=%2F"><\/template>/,
      'the boundary carries the marker a soft navigation follows');
    assert.doesNotMatch(body, /<p>error:/, 'a redirect is control flow, not an error');
  });
}
