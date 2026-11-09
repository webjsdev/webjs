/**
 * Production error boundaries see a sanitized error (Next.js parity): error.ts
 * and global-error.ts receive `Internal server error` plus a `digest`; the
 * onError sink receives the ORIGINAL error carrying the same digest, so a
 * digest a user reports maps to the report. Dev is unchanged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../packages/server/src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../packages/core/index.js')).toString();
const quiet = { info() {}, warn() {}, error() {} };

function app(files) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-err-sanitize-'));
  writeFileSync(join(dir, 'package.json'), '{"name":"e","type":"module"}');
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}

const SECRET = 'postgres://user:hunter2@db.internal/app';

test('global-error.ts receives the sanitized error in production; onError the original + same digest', async () => {
  const dir = app({
    'app/page.js': `export default () => { throw new Error(${JSON.stringify(SECRET)}); };\n`,
    'app/global-error.js': `import { html } from ${JSON.stringify(CORE)};\nexport default ({ error }) => html\`<!doctype html><html><body><p id="e">\${error.message}|\${error.digest}</p></body></html>\`;\n`,
  });
  const seen = [];
  const origError = console.error;
  console.error = () => {};
  try {
    const h = await createRequestHandler({ appDir: dir, dev: false, logger: quiet, onError: (e) => seen.push(e) });
    const r = await h.handle(new Request('http://x/'));
    assert.equal(r.status, 500);
    const html = await r.text();
    const m = /<p id="e">Internal server error\|([0-9a-f]{10})<\/p>/.exec(html);
    assert.ok(m, html);
    assert.ok(!html.includes('hunter2'), 'the secret never reaches the page');
    assert.equal(seen[0].message, SECRET, 'the sink gets the original');
    assert.equal(seen[0].digest, m[1], 'with the digest the page shows');
  } finally {
    console.error = origError;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dev: global-error.ts receives the real error', async () => {
  const dir = app({
    'app/page.js': `export default () => { throw new Error('dev-visible'); };\n`,
    'app/global-error.js': `import { html } from ${JSON.stringify(CORE)};\nexport default ({ error }) => html\`<!doctype html><html><body><p id="e">\${error.message}</p></body></html>\`;\n`,
  });
  try {
    const h = await createRequestHandler({ appDir: dir, dev: true, logger: quiet, onDevError() {} });
    assert.match(await (await h.handle(new Request('http://x/'))).text(), /<p id="e">dev-visible<\/p>/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
