/**
 * Cross-runtime parity (#830 + #508): the service-worker root assets serve at
 * the SITE ROOT under WHICHEVER runtime executes this file. The static branch
 * lives in the shared handler and reads the file via `readFile`, whose behaviour
 * differs Node vs Bun, so the same assertions must hold on both shells:
 *
 *   node test/bun/sw-root-assets.mjs
 *   bun  test/bun/sw-root-assets.mjs
 *
 * A plain assert script (not `*.test.mjs`) so the SAME file runs identically on
 * both runtimes; it exits non-zero on failure. Run from the repo root so the
 * bare `@webjsdev/server` specifier resolves to the workspace package.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequestHandler } from '@webjsdev/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

const appDir = mkdtempSync(join(tmpdir(), 'webjs-sw-'));
mkdirSync(join(appDir, 'public'), { recursive: true });
writeFileSync(join(appDir, 'public', 'sw.js'), "self.addEventListener('install', () => {});\n");
writeFileSync(join(appDir, 'public', 'offline.html'), '<!doctype html><title>offline</title>\n');

try {
  const app = await createRequestHandler({ appDir, dev: false });

  const sw = await app.handle(new Request('http://x/sw.js'));
  assert.equal(sw.status, 200, `[${runtime}] /sw.js serves at the site root`);
  assert.equal(sw.headers.get('service-worker-allowed'), '/', `[${runtime}] /sw.js opts into root scope`);
  assert.match(await sw.text(), /addEventListener/, `[${runtime}] /sw.js body is the worker source`);

  const offline = await app.handle(new Request('http://x/offline.html'));
  assert.equal(offline.status, 200, `[${runtime}] /offline.html serves at the site root`);

  console.log(`ok  ${runtime}  service-worker root assets (#830)`);
} finally {
  rmSync(appDir, { recursive: true, force: true });
}
