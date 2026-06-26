/**
 * End-to-end proof of the Bun transparent auto-install (the real thing: a live
 * `bun install`). Bun's runtime auto-install is latest-only, so a NON-LATEST dep
 * cannot be served zero-install; webjs runs `bun install` for the user so the
 * dep resolves from `node_modules` (installed mode) at its locked version.
 *
 * This builds a temp app declaring `ms@2.0.0` (a real, non-latest version; latest
 * is 2.1.x), with NO `node_modules`, then runs the REAL `startTransparentInstall`
 * and asserts node_modules now carries EXACTLY 2.0.0. `ms` stands in for the
 * scaffold's drizzle prerelease: both are versions Bun auto-install will not fetch
 * on the fly, so installed mode is the only correct path.
 *
 * Bun-only (it spawns `bun install` via process.execPath, which is `bun` here)
 * and online (npm registry). Run from the repo root:
 *
 *   bun test/bun/transparent-install-e2e.mjs
 *
 * On Node it skips (process.execPath would be node, not bun).
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyBunDeps } from '../../packages/server/src/bun-pin-rewrite.js';
import { startTransparentInstall } from '../../packages/server/src/bun-bg-install.js';

if (typeof Bun === 'undefined') {
  console.log('[transparent-install-e2e] SKIP on node (needs bun to spawn `bun install`)');
} else {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-ti-e2e-'));
  try {
    // A non-latest exact dep, no node_modules. (ms@2.0.0; latest is 2.1.x.)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'ti-e2e', private: true, dependencies: { ms: '2.0.0' },
    }, null, 2));
    // A page that imports the dep, mirroring an SSR import path.
    mkdirSync(join(dir, 'app'), { recursive: true });
    writeFileSync(join(dir, 'app', 'page.js'), "import ms from 'ms';\nexport default () => ms(1000);\n");
    assert.ok(!existsSync(join(dir, 'node_modules')), 'precondition: no node_modules (zero-install state)');

    // classifyBunDeps: an exact dep with no lock is "inlineable" (we cannot know
    // it is non-latest without the network), so the FAST path would serve it and
    // the DETACHED install would self-heal. Here we drive the blocking install
    // directly (the proactive path) to prove the install itself.
    const cls = classifyBunDeps(readFileSync(join(dir, 'package.json'), 'utf8'), null);
    assert.equal(cls.hasLock, false, 'no committed lock yet');

    const ok = await startTransparentInstall(dir, { mode: 'blocking' });
    assert.equal(ok, true, 'transparent bun install completed and produced node_modules');
    assert.ok(existsSync(join(dir, 'node_modules', 'ms', 'package.json')), 'ms is installed');

    const installed = JSON.parse(readFileSync(join(dir, 'node_modules', 'ms', 'package.json'), 'utf8')).version;
    assert.equal(installed, '2.0.0', `installed mode resolves the LOCKED non-latest version, got ${installed}`);

    // The install also wrote a bun.lock, so a NEXT boot would classify hasLock
    // (proactive) and reuse node_modules reproducibly.
    assert.ok(existsSync(join(dir, 'bun.lock')) || existsSync(join(dir, 'bun.lockb')), 'a lockfile was written for reproducible reinstalls');

    console.log('[transparent-install-e2e] OK: non-latest ms@2.0.0 served via transparent install (no manual bun install)');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}
