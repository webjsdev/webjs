/**
 * #1689: a dev rebuild whose route scan throws must still leave the lazy
 * analysis invalidated. `doRebuild` used to rebuild the route table FIRST and
 * reset the analysis flags after it, so a throwing scan skipped the reset and
 * every later request served the pre-edit analysis (its import graph, its
 * browser gate, its elision verdicts) until some later edit rebuilt cleanly.
 *
 * The real route scan is robust (an unreadable directory is skipped), so the
 * throw is injected at the one call it cannot catch: `node:fs/promises`
 * `readdir` returns an entry whose `name` throws, armed for exactly the rebuild
 * (`syncBuiltinESMExports` carries the stub into the ESM binding the walker
 * imported). The observable is the browser gate, which only the analysis
 * computes: a module the edited page newly imports is servable only once the
 * analysis has run again.
 *
 * COUNTERFACTUAL: move the invalidation back below `buildRouteTable` and the
 * newly imported module still 404s after the failed rebuild.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';

const require = createRequire(import.meta.url);
const fsp = require('node:fs/promises');
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const root = mkdtempSync(join(tmpdir(), 'webjs-rebuild-order-'));
after(() => rmSync(root, { recursive: true, force: true }));

test('a rebuild whose route scan throws still invalidates the analysis', async () => {
  mkdirSync(join(root, 'app'), { recursive: true });
  mkdirSync(join(root, 'lib'), { recursive: true });
  writeFileSync(join(root, 'lib/x.js'), 'export const x = 1;\n');
  writeFileSync(join(root, 'app/page.js'), 'export default () => "A";\n');
  const app = await createRequestHandler({ appDir: root, dev: true, logger: quiet });

  assert.equal((await app.handle(new Request('http://x/'))).status, 200);
  assert.equal((await app.handle(new Request('http://x/lib/x.js'))).status, 404, 'nothing imports lib/x.js yet');

  writeFileSync(join(root, 'app/page.js'), 'import "../lib/x.js";\nexport default () => "B";\n');
  const real = fsp.readdir;
  let threw = 0;
  fsp.readdir = async (dir, opts) => {
    if (String(dir) === join(root, 'app')) {
      threw++;
      return [{ get name() { throw new Error('route scan failed'); }, isDirectory: () => false, isFile: () => true }];
    }
    return real(dir, opts);
  };
  syncBuiltinESMExports();
  try {
    await app.rebuild();
  } finally {
    fsp.readdir = real;
    syncBuiltinESMExports();
  }
  assert.ok(threw > 0, 'the route scan hit the injected failure');

  const res = await app.handle(new Request('http://x/lib/x.js'));
  assert.equal(res.status, 200, 'the next request re-ran the analysis, so the newly imported module is servable');
  assert.match(await (await app.handle(new Request('http://x/'))).text(), /B/);
});
