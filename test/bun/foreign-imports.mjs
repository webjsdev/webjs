/**
 * Cross-runtime proof that a foreign-framework import (next/*, react, lit) is
 * refused with the WebJs fix on both runtimes: the module-load error is
 * rewritten (Node's ERR_MODULE_NOT_FOUND and Bun's "Cannot find package" read
 * differently), and the analysis refuses the app before anything renders.
 *
 *   node test/bun/foreign-imports.mjs
 *   bun  test/bun/foreign-imports.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { devImport } = await import(pathToFileURL(resolve(__dirname, '../../packages/server/src/dev-import.js')).href);
const { createRequestHandler } = await import(pathToFileURL(resolve(__dirname, '../../packages/server/src/dev.js')).href);
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'wj-foreign-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };
let failure = null;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fi', type: 'module' }));
  w('lib/uses-next.js', `import { cookies } from 'next/headers';\nexport default cookies;\n`);
  await assert.rejects(() => devImport(join(dir, 'lib/uses-next.js'), true), (e) => {
    assert.match(e.message, /'next\/headers', a Next\.js package/, `rewritten on ${runtime}: ${e.message}`);
    assert.match(e.message, /@webjsdev\/server/);
    return true;
  });

  w('app/page.js', `import { html } from 'lit';\nexport default () => html\`<p>x</p>\`;\n`);
  const h = await createRequestHandler({ appDir: dir, dev: true, logger: quiet });
  const r = await h.handle(new Request('http://x/'));
  assert.equal(r.status, 500, `analysis refuses on ${runtime}`);
  assert.match(await r.text(), /no-foreign-framework-import/);
  console.log(`ok foreign-framework imports refused on ${runtime}`);
} catch (e) {
  failure = e;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (failure) {
  console.error(failure);
  process.exit(1);
}
