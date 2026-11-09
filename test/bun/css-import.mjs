/**
 * Cross-runtime proof for `import './x.css'` (a bundler feature WebJs does not
 * have). The runtimes disagree on their own, which is why the refusal cannot
 * rely on the module loader:
 *   - Node rejects the import with ERR_UNKNOWN_FILE_EXTENSION, which the dev
 *     import path rewrites to name the <link> / static styles fix;
 *   - Bun (1.3) silently ACCEPTS it: a side-effect import is a no-op and a
 *     default import is the file path, so the page renders unstyled.
 * Both runtimes then refuse the app at analysis time (no-css-import), so the
 * outcome is the same loud error everywhere.
 *
 *   node test/bun/css-import.mjs
 *   bun  test/bun/css-import.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { devImport } = await import(pathToFileURL(resolve(__dirname, '../../packages/server/src/dev-import.js')).href);
const { createRequestHandler } = await import(pathToFileURL(resolve(__dirname, '../../packages/server/src/dev.js')).href);
const bun = !!process.versions.bun;
const runtime = bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'wj-css-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };
let failure = null;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'css', type: 'module' }));
  w('lib/styles.css', 'body { color: red }');
  w('lib/uses-css.js', `import './styles.css';\nexport const x = 1;\n`);
  if (bun) {
    const m = await devImport(join(dir, 'lib/uses-css.js'), true);
    assert.equal(m.x, 1, 'Bun accepts a CSS side-effect import silently');
  } else {
    await assert.rejects(() => devImport(join(dir, 'lib/uses-css.js'), true), (e) => {
      assert.match(e.message, /imports a stylesheet/, e.message);
      assert.match(e.message, /<link rel="stylesheet"/);
      return true;
    });
  }

  w('app/page.js', `import '../lib/styles.css';\nexport default () => 'x';\n`);
  const h = await createRequestHandler({ appDir: dir, dev: true, logger: quiet });
  const r = await h.handle(new Request('http://x/'));
  assert.equal(r.status, 500, `analysis refuses on ${runtime}`);
  assert.match(await r.text(), /no-css-import/);
  console.log(`ok css imports refused on ${runtime}`);
} catch (e) {
  failure = e;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (failure) {
  console.error(failure);
  process.exit(1);
}
