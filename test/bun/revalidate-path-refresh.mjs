/**
 * Cross-runtime proof that revalidatePath() inside an RPC server action rides
 * back as `x-webjs-refresh` (the per-request AsyncLocalStorage record and the
 * response header both go through the runtime's listener).
 *
 *   node test/bun/revalidate-path-refresh.mjs
 *   bun  test/bun/revalidate-path-refresh.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../packages/core/index.js')).toString();
const SERVER = pathToFileURL(resolve(__dirname, '../../packages/server/index.js')).toString();
const { startServer } = await import(SERVER);
const { stringify } = await import(pathToFileURL(resolve(__dirname, '../../packages/core/src/serialize.js')).toString());
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'wj-refresh-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };

let close;
let failure = null;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'rf', type: 'module' }));
  w('modules/save.server.ts', `'use server';\nimport { revalidatePath } from ${JSON.stringify(SERVER)};\nexport async function save() { await revalidatePath('/posts'); await revalidatePath('/blog', 'layout'); return 1; }\n`);
  w('components/save-button.ts', `import { WebComponent, html } from ${JSON.stringify(CORE)};\nimport { save } from '../modules/save.server.ts';\nclass S extends WebComponent({}) { render() { return html\`<button @click=\${() => save()}>s</button>\`; } }\nS.register('save-button');\n`);
  w('app/page.ts', `import { html } from ${JSON.stringify(CORE)};\nimport '../components/save-button.ts';\nexport default () => html\`<save-button></save-button>\`;\n`);

  let server;
  ({ server, close } = await startServer({ appDir: dir, dev: true, port: 0, logger: quiet }));
  const port = typeof server.port === 'number' ? server.port : server.address().port;
  const base = `http://localhost:${port}`;
  await (await fetch(`${base}/`)).text();
  const stub = await (await fetch(`${base}/modules/save.server.ts`)).text();
  const actionUrl = /const __URL = "([^"]+)"/.exec(stub)?.[1];
  assert.ok(actionUrl, `stub carries the action url on ${runtime}`);
  assert.match(stub, /x-webjs-refresh/, `the stub reads the refresh header on ${runtime}`);
  const res = await fetch(`${base}${actionUrl}save`, {
    method: 'POST',
    headers: { 'content-type': 'application/vnd.webjs+json', 'sec-fetch-site': 'same-origin' },
    body: await stringify([]),
  });
  await res.text();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-webjs-refresh'), '%2Fposts,%2Fblog;layout', `refresh header on ${runtime}`);
  console.log(`ok revalidatePath refresh header on ${runtime}`);
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
