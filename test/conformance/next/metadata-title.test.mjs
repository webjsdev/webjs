/**
 * Next.js conformance: `metadata.title` templates (#1686). Each case quotes
 * `docs/01-app/03-api-reference/04-functions/generate-metadata.mdx` from the
 * local clone at `frameworks/next.js`. Layouts set
 * `{ template: '%s | Acme', default: 'Acme' }` and pages set a plain string:
 * that is how agents title every page of an app.
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

const page = (meta) => `import { html } from ${CORE};\n${meta ? `export const metadata = ${meta};\n` : ''}export default () => html\`<p>x</p>\`;\n`;
const layout = (meta) => `import { html } from ${CORE};\n${meta ? `export const metadata = ${meta};\n` : ''}export default ({ children }) => html\`\${children}\`;\n`;

let dir;
let app;
async function title(path) {
  const body = await (await app.handle(new Request('http://localhost' + path))).text();
  return body.match(/<title>([^<]*)<\/title>/)?.[1] ?? null;
}

test.before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'webjs-conf-title-'));
  const w = (rel, body) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), body); };
  w('package.json', JSON.stringify({ name: 'conf-title', type: 'module' }));
  w('app/layout.js', `import { html } from ${CORE};\nexport const metadata = { title: { template: '%s | Acme', default: 'Acme' } };\nexport default ({ children }) => html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;\n`);
  w('app/page.js', page(null));
  w('app/about/page.js', page("{ title: 'About' }"));
  w('app/plain/page.js', page(null));
  w('app/abs/page.js', page("{ title: { absolute: 'Absolute' } }"));
  // A nested layout with its own template and default.
  w('app/blog/layout.js', layout("{ title: { template: '%s | Blog', default: 'Blog' } }"));
  w('app/blog/page.js', page(null));
  w('app/blog/post/page.js', page("{ title: 'Post' }"));
  // A nested layout with a plain string title: the default for its children.
  w('app/docs/layout.js', layout("{ title: 'Docs' }"));
  w('app/docs/intro/page.js', page(null));
  w('app/docs/start/page.js', page("{ title: 'Start' }"));
  app = await createRequestHandler({ appDir: dir, dev: true, logger: { info() {}, warn() {}, error() {}, debug() {} } });
});
test.after(() => rmSync(dir, { recursive: true, force: true }));

test('"title.template can be used to add a prefix or a suffix to titles defined in child route segments"', async () => {
  assert.equal(await title('/about'), 'About | Acme');
});

test('"title.default ... a fallback title to child route segments that don\'t define a title"', async () => {
  assert.equal(await title('/plain'), 'Acme');
  assert.equal(await title('/'), 'Acme', '"title.template defined in layout.js will not apply to a title defined in a page.js of the same route segment"');
});

test('"title.absolute ... ignores title.template set in parent segments"', async () => {
  assert.equal(await title('/abs'), 'Absolute');
});

test('a nested layout\'s default "will augment title.template from the closest parent segment"', async () => {
  assert.equal(await title('/blog'), 'Blog | Acme', 'the nested default goes through the parent template');
  assert.equal(await title('/blog/post'), 'Post | Blog', 'the closest template wins');
});

test('a nested layout\'s string title is the default for its children and goes through the parent template', async () => {
  assert.equal(await title('/docs/intro'), 'Docs | Acme');
  assert.equal(await title('/docs/start'), 'Start | Acme', 'a string title is no template, so the parent template still applies');
});
