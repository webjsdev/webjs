/**
 * Cross-runtime proof that the route table's boundary parsing (#848 Gap 3)
 * behaves identically on Node and Bun: root-only global-error / global-not-found
 * and the nested not-found nearest-wins chain projected onto each page. The
 * scan uses fs-walk (runtime-sensitive), so both runtimes must agree:
 *
 *   node test/bun/routing-boundaries.mjs
 *   bun  test/bun/routing-boundaries.mjs
 *
 * Run from the repo root.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { buildRouteTable } from '../../packages/server/src/router.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const dir = mkdtempSync(join(tmpdir(), 'webjs-boundaries-'));

function write(rel, body) {
  const abs = join(dir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}

try {
  write('package.json', JSON.stringify({ name: 'b' }));
  write('app/page.js', 'export default function H() {}');
  write('app/shop/[id]/page.js', 'export default function P() {}');
  write('app/not-found.js', 'export default function NF() {}');
  write('app/shop/not-found.js', 'export default function NF() {}');
  write('app/global-error.js', 'export default function GE() {}');
  write('app/global-not-found.js', 'export default function GN() {}');

  const rt = await buildRouteTable(dir);
  assert.ok(rt.globalError, 'globalError parsed');
  assert.ok(rt.globalNotFound, 'globalNotFound parsed');
  const shop = rt.pages.find((p) => p.routeDir === 'shop/[id]');
  // outermost -> innermost: [root, shop]
  assert.equal(shop.notFounds.length, 2);
  assert.match(shop.notFounds[shop.notFounds.length - 1], /shop[/\\]not-found/);

  console.log(`OK  route-table boundary parsing identical on ${runtime}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
