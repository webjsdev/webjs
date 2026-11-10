/**
 * Next.js conformance: a 404 / 403 page's metadata resolves like a page's
 * (#1686). Quotes `docs/01-app/03-api-reference/03-file-conventions/not-found.mdx`
 * from the local clone at `frameworks/next.js`: "Both the root
 * `app/not-found.js` and `app/global-not-found.js` support exporting a
 * `metadata` object or a `generateMetadata` function to customize the
 * `<title>`, `<meta>`, and other head tags for your 404 page". A not-found
 * page renders inside its layouts, so their metadata (the title template, the
 * description) applies to it as it does to any segment below them. WebJs's
 * `forbidden.ts` and `unauthorized.ts` follow the same rule.
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
  const dir = mkdtempSync(join(tmpdir(), 'webjs-conf-bmeta-'));
  const w = (rel, body) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), body); };
  w('package.json', JSON.stringify({ name: 'conf-bmeta', type: 'module' }));
  w('app/layout.js', `import { html } from ${CORE};\nexport const metadata = { title: { template: '%s | Site', default: 'Site' }, description: 'About the site' };\nexport default ({ children }) => html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;\n`);
  for (const [rel, body] of Object.entries(files)) w(rel, body);
  const handler = await createRequestHandler({ appDir: dir, dev: true, logger: { info() {}, warn() {}, error() {}, debug() {} } });
  const get = async (path) => { const r = await handler.handle(new Request('http://localhost' + path)); return { status: r.status, body: await r.text() }; };
  return { get, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const title = (body) => /<title>([^<]*)<\/title>/.exec(body)?.[1];
const description = (body) => /<meta name="description" content="([^"]*)"/.exec(body)?.[1];

test('a not-found page\'s own title runs through the layout template, and the layout description carries', async () => {
  const a = await app({
    'app/gone/page.js': `import { notFound } from ${CORE};\nexport default () => { notFound(); };\n`,
    'app/not-found.js': `import { html } from ${CORE};\nexport const metadata = { title: 'Missing' };\nexport default () => html\`<h1>Not here</h1>\`;\n`,
  });
  try {
    const r = await a.get('/gone');
    assert.equal(r.status, 404);
    assert.equal(title(r.body), 'Missing | Site');
    assert.equal(description(r.body), 'About the site');
  } finally { a.done(); }
});

test('a forbidden page\'s own metadata is used, through the same template', async () => {
  const a = await app({
    'app/admin/page.js': `import { forbidden } from ${CORE};\nexport default () => { forbidden(); };\n`,
    'app/forbidden.js': `import { html } from ${CORE};\nexport async function generateMetadata() { return { title: 'No access' }; }\nexport default () => html\`<h1>403</h1>\`;\n`,
  });
  try {
    const r = await a.get('/admin');
    assert.equal(r.status, 403);
    assert.equal(title(r.body), 'No access | Site');
    assert.equal(description(r.body), 'About the site');
  } finally { a.done(); }
});

test('a boundary that names no title takes the layout default; the framework default page keeps its own', async () => {
  const a = await app({
    'app/gone/page.js': `import { notFound } from ${CORE};\nexport default () => { notFound(); };\n`,
    'app/not-found.js': `import { html } from ${CORE};\nexport default () => html\`<h1>Not here</h1>\`;\n`,
    'app/admin/page.js': `import { unauthorized } from ${CORE};\nexport default () => { unauthorized(); };\n`,
  });
  try {
    assert.equal(title((await a.get('/gone')).body), 'Site');
    const r = await a.get('/admin');
    assert.equal(r.status, 401);
    assert.equal(title(r.body), 'Unauthorized');
    assert.equal(description(r.body), 'About the site', 'the layouts still apply around the default page');
  } finally { a.done(); }
});
