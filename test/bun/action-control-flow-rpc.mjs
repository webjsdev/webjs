/**
 * Cross-runtime proof that notFound() / forbidden() / unauthorized() in a
 * server action called over RPC answer 404 / 403 / 401 through the real
 * listener, with the kind in x-webjs-control, the same status the no-JS form
 * path renders (#1697). They used to answer a logged 500.
 *
 *   node test/bun/action-control-flow-rpc.mjs
 *   bun  test/bun/action-control-flow-rpc.mjs
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
const errors = [];
const quiet = { info() {}, warn() {}, error(...a) { errors.push(a.join(' ')); }, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'wj-act-control-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };
let close;
let failure = null;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'ac', type: 'module' }));
  w('modules/guard.server.ts', `'use server';\nimport { notFound, forbidden, unauthorized } from ${JSON.stringify(CORE)};\nexport async function denied() { forbidden(); }\nexport async function missing() { notFound(); }\nexport async function anon() { unauthorized(); }\n`);
  w('app/page.ts', `import { html } from ${JSON.stringify(CORE)};\nimport { denied } from '../modules/guard.server.ts';\nexport default () => html\`<form action=\${denied}></form>\`;\n`);

  let server;
  ({ server, close } = await startServer({ appDir: dir, dev: false, port: 0, logger: quiet }));
  const port = typeof server.port === 'number' ? server.port : server.address().port;
  const base = `http://localhost:${port}`;
  const html = await (await fetch(`${base}/`)).text();
  const id = /name="__webjs_action" value="([^"]+)"/.exec(html)?.[1];
  assert.ok(id, `the form renders an identity on ${runtime}`);
  const hash = id.split('/')[0];

  for (const [fn, status, kind] of [['denied', 403, 'forbidden'], ['missing', 404, 'not-found'], ['anon', 401, 'unauthorized']]) {
    const rpc = await fetch(`${base}/__webjs/action/${hash}/${fn}`, {
      method: 'POST',
      headers: { 'content-type': 'application/vnd.webjs+json', 'sec-fetch-site': 'same-origin' },
      body: await stringify([]),
    });
    await rpc.text();
    assert.equal(rpc.status, status, `${fn}() over RPC is a ${status} on ${runtime}`);
    assert.equal(rpc.headers.get('x-webjs-control'), kind);
  }
  assert.deepEqual(errors.filter((e) => /action threw/.test(e)), [], `no sentinel is logged as an action error on ${runtime}`);
  console.log(`ok action control flow over RPC on ${runtime}`);
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
