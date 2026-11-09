/**
 * Cross-runtime proof that a production error boundary sees a sanitized
 * error (generic message + digest, WebCrypto-hashed) through the real
 * listener on whichever runtime runs this file.
 *
 *   node test/bun/error-boundary-sanitize.mjs
 *   bun  test/bun/error-boundary-sanitize.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../packages/core/index.js')).toString();
const { startServer } = await import(pathToFileURL(resolve(__dirname, '../../packages/server/index.js')).toString());
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'wj-errsan-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };
let close;
let failure = null;
const origError = console.error;
try {
  console.error = () => {};
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'es', type: 'module' }));
  w('app/page.ts', `export default () => { throw new Error('secret-detail'); };\n`);
  w('app/error.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default ({ error }: { error: Error & { digest?: string } }) => html\`<p id="e">\${error.message}|\${error.digest}</p>\`;\n`);
  let server;
  ({ server, close } = await startServer({ appDir: dir, dev: false, port: 0, logger: quiet }));
  const port = typeof server.port === 'number' ? server.port : server.address().port;
  const r = await fetch(`http://localhost:${port}/`);
  const html = await r.text();
  assert.equal(r.status, 500);
  assert.match(html, /<p id="e">Internal server error\|[0-9a-f]{10}<\/p>/, `sanitized on ${runtime}`);
  assert.ok(!html.includes('secret-detail'), `no raw message on ${runtime}`);
} catch (e) {
  failure = e;
} finally {
  console.error = origError;
  if (close) await close();
  rmSync(dir, { recursive: true, force: true });
}
if (failure) {
  console.error(failure);
  process.exit(1);
}
console.log(`ok error boundary sanitize on ${runtime}`);
