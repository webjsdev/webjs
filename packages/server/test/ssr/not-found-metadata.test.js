/**
 * A `not-found.ts` boundary's own `metadata` / `generateMetadata` titles the
 * 404 page, as a `not-found.tsx` does in Next. It used to be ignored, so every
 * custom not-found page was titled "Not found" (an agent building an app on
 * the scaffold found it).
 *
 * Counterfactual: drop `...boundaryMeta` from `ssrNotFoundHtml`'s document
 * metadata (src/ssr/render.js) and the first two cases fail.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = JSON.stringify(pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString());

async function makeApp() {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-nf-meta-'));
  for (const d of ['app/p/[slug]', 'app/q/[slug]']) await mkdir(join(dir, d), { recursive: true });
  await writeFile(join(dir, 'app/layout.ts'), `import { html } from ${CORE};
export default ({ children }) => html\`<html><head></head><body>\${children}</body></html>\`;
`);
  await writeFile(join(dir, 'app/not-found.ts'), `import { html } from ${CORE};
export const metadata = { title: 'Nothing here' };
export default () => html\`<h1>Nothing here</h1>\`;
`);
  await writeFile(join(dir, 'app/p/[slug]/page.ts'), `import { html, notFound } from ${CORE};
export default ({ params }) => { if (params.slug !== 'real') notFound(); return html\`<p>poll</p>\`; };
`);
  await writeFile(join(dir, 'app/p/[slug]/not-found.ts'), `import { html } from ${CORE};
export const metadata = { title: 'Poll not found', description: 'No poll at this address.' };
export default () => html\`<h1>No such poll</h1>\`;
`);
  await writeFile(join(dir, 'app/q/[slug]/page.ts'), `import { notFound } from ${CORE};
export default () => notFound();
`);
  await writeFile(join(dir, 'app/q/[slug]/not-found.ts'), `import { html } from ${CORE};
export async function generateMetadata() { return { title: 'Question gone' }; }
export default () => html\`<h1>gone</h1>\`;
`);
  return dir;
}

let app;
async function get(path) {
  if (!app) app = await createRequestHandler({ appDir: await makeApp(), dev: true });
  const res = await app.handle(new Request('http://localhost' + path));
  return { status: res.status, html: await res.text() };
}

test('a segment not-found boundary titles the 404 with its metadata', async () => {
  const { status, html } = await get('/p/missing');
  assert.equal(status, 404);
  assert.match(html, /<title>Poll not found<\/title>/);
  assert.match(html, /No poll at this address\./);
  assert.match(html, /No such poll/);
});

test('generateMetadata on a not-found boundary is honoured too', async () => {
  const { status, html } = await get('/q/anything');
  assert.equal(status, 404);
  assert.match(html, /<title>Question gone<\/title>/);
});

test('the root not-found boundary titles an unmatched url', async () => {
  const { status, html } = await get('/no/such/route');
  assert.equal(status, 404);
  assert.match(html, /<title>Nothing here<\/title>/);
});
