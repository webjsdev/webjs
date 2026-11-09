/**
 * Next.js conformance: a page's `searchParams` (#1686). Each case quotes the
 * Next.js documentation line it asserts, from the local clone at
 * `frameworks/next.js`, `docs/01-app/03-api-reference/03-file-conventions/page.mdx`.
 * An agent reads a query the way that table shows, so WebJs must hand a page
 * the same shape.
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
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

/** Render `/shop` with the given query and return the JSON the page printed. */
async function shop(query) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-conf-sp-'));
  const w = (rel, body) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), body); };
  try {
    w('package.json', JSON.stringify({ name: 'conf-sp', type: 'module' }));
    w('app/layout.js', `import { html } from ${CORE};\nexport default ({ children }) => html\`<!doctype html><html><body>\${children}</body></html>\`;\n`);
    // Both reads Next documents: the awaited form and a synchronous one.
    w('app/shop/page.js', `import { html } from ${CORE};\n`
      + `export default async function Shop({ searchParams }) {\n`
      + `  const sp = await searchParams;\n`
      + `  return html\`<pre id="sp">\${JSON.stringify(sp)}</pre>\`;\n}\n`);
    const app = await createRequestHandler({ appDir: dir, dev: true, logger: quiet });
    const res = await app.handle(new Request('http://localhost/shop' + query));
    const body = await res.text();
    const m = body.match(/<pre id="sp">([^<]*)<\/pre>/);
    assert.ok(m, `the page rendered: ${body.slice(0, 200)}`);
    return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&amp;/g, '&'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('"/shop?a=1" -> { a: \'1\' }', async () => {
  assert.deepEqual(await shop('?a=1'), { a: '1' });
});

test('"/shop?a=1&b=2" -> { a: \'1\', b: \'2\' }', async () => {
  assert.deepEqual(await shop('?a=1&b=2'), { a: '1', b: '2' });
});

test('"/shop?a=1&a=2" -> { a: [\'1\', \'2\'] } (a repeated key is every value, in order)', async () => {
  // WebJs kept only the last value here (Object.fromEntries), so a
  // multi-select filter written the Next.js way read one choice.
  assert.deepEqual(await shop('?a=1&a=2'), { a: ['1', '2'] });
  assert.deepEqual(await shop('?tag=x&q=y&tag=z&tag=w'), { tag: ['x', 'z', 'w'], q: 'y' });
});
