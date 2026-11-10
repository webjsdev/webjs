/**
 * Cross-runtime check (#1689): a dev rebuild whose route scan throws still
 * leaves the lazy analysis invalidated, on Node and on Bun. `doRebuild` used to
 * reset the analysis flags only AFTER rebuilding the route table, so a throwing
 * scan left every later request on the pre-edit analysis. Run under both:
 *
 *   node test/bun/dev-rebuild-order.mjs
 *   bun  test/bun/dev-rebuild-order.mjs
 *
 * The failure is injected into the route scan's walker through a stubbed
 * `node:fs/promises` `readdir` (`syncBuiltinESMExports` carries the stub into
 * the ESM binding the walker imported). Bun 1.3 does not carry it into the
 * binding, so there the scan succeeds and the script proves only that the
 * rebuild re-runs the analysis; it says which case it ran, so a Bun pass is
 * never mistaken for the throwing case. The unit test
 * `packages/server/test/dev/rebuild-order.test.js` is the Node counterfactual,
 * and the ordering itself is runtime-neutral code.
 *
 * A plain assert script (not node:test) so the SAME file runs on both runtimes.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../../packages/server/src/dev.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const require = createRequire(import.meta.url);
const fsp = require('node:fs/promises');
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const root = mkdtempSync(join(tmpdir(), 'webjs-rebuild-order-'));
try {
  mkdirSync(join(root, 'app'), { recursive: true });
  mkdirSync(join(root, 'lib'), { recursive: true });
  mkdirSync(join(root, 'components'), { recursive: true });
  writeFileSync(join(root, 'lib/x.js'), 'export const x = 1;\n');
  // A component, because a page never ships (#1686), so nothing a page
  // imports is ever servable.
  const component = (body) => "import { WebComponent, html } from '@webjsdev/core';\n" + body +
    "class XC extends WebComponent { render() { return html`<p>c</p>`; } }\nXC.register('x-c');\n";
  writeFileSync(join(root, 'components/x-c.js'), component(''));
  writeFileSync(join(root, 'app/page.js'), 'export default () => "A";\n');
  const app = await createRequestHandler({ appDir: root, dev: true, logger: quiet });

  assert.equal((await app.handle(new Request('http://x/'))).status, 200, `the page renders on ${runtime}`);
  assert.equal((await app.handle(new Request('http://x/lib/x.js'))).status, 404, `nothing imports lib/x.js yet on ${runtime}`);

  writeFileSync(join(root, 'components/x-c.js'), component('import "../lib/x.js";\n'));
  writeFileSync(join(root, 'app/page.js'), 'export default () => "B";\n');
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

  const res = await app.handle(new Request('http://x/lib/x.js'));
  assert.equal(res.status, 200, `the next request re-ran the analysis on ${runtime}, so the newly imported module is servable`);
  console.log(`OK  a dev rebuild leaves the analysis invalidated even when its route scan ${threw ? 'throws' : 'succeeds (the stub did not reach the ESM binding)'} on ${runtime} (#1689)`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
