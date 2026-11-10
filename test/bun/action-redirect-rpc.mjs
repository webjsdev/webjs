/**
 * Cross-runtime proof that redirect() in a server action answers as in
 * Next.js through the real listener: over RPC a 200 carrying
 * `x-webjs-redirect`, from a bound form a 303 (never a body-replaying 307).
 *
 *   node test/bun/action-redirect-rpc.mjs
 *   bun  test/bun/action-redirect-rpc.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../packages/core/index.js')).toString();
const { startServer } = await import(pathToFileURL(resolve(__dirname, '../../packages/server/index.js')).toString());
const { stringify } = await import(pathToFileURL(resolve(__dirname, '../../packages/core/src/serialize.js')).toString());
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'wj-act-redirect-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };
let close;
let failure = null;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'ar', type: 'module' }));
  w('modules/go.server.ts', `'use server';\nimport { redirect } from ${JSON.stringify(CORE)};\nexport async function go() { redirect('/done'); }\n`);
  w('components/go-btn.ts', `import { WebComponent, html } from ${JSON.stringify(CORE)};\nimport { go } from '../modules/go.server.ts';\nclass G extends WebComponent({}) { render() { return html\`<button @click=\${() => go()}>g</button>\`; } }\nG.register('go-btn');\n`);
  w('app/page.ts', `import { html } from ${JSON.stringify(CORE)};\nimport '../components/go-btn.ts';\nimport { go } from '../modules/go.server.ts';\nexport default () => html\`<go-btn></go-btn><form action=\${go}></form>\`;\n`);

  let server;
  ({ server, close } = await startServer({ appDir: dir, dev: true, port: 0, logger: quiet }));
  const port = typeof server.port === 'number' ? server.port : server.address().port;
  const base = `http://localhost:${port}`;
  const html = await (await fetch(`${base}/`)).text();
  const id = /name="__webjs_action" value="([^"]+)"/.exec(html)?.[1];
  assert.ok(id, `the form renders an identity on ${runtime}`);

  const rpc = await fetch(`${base}/__webjs/action/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/vnd.webjs+json', 'sec-fetch-site': 'same-origin' },
    body: await stringify([]),
  });
  await rpc.text();
  assert.equal(rpc.status, 200, `RPC redirect is a 200 on ${runtime}`);
  assert.equal(rpc.headers.get('x-webjs-redirect'), '/done;push');

  const form = await fetch(`${base}/`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin' },
    body: new URLSearchParams({ __webjs_action: id }).toString(),
  });
  await form.text();
  assert.equal(form.status, 303, `form redirect is a 303 on ${runtime}`);
  assert.equal(form.headers.get('location'), '/done');
  console.log(`ok action redirect on ${runtime}`);
} catch (e) {
  failure = e;
} finally {
  if (close) await close();
  rmSync(dir, { recursive: true, force: true });
}
if (failure) {
  console.error(failure);
  process.exit(1);
}
