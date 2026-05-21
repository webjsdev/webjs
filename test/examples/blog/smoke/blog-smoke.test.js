/**
 * Blog runtime smoke test: boots `webjs dev` against examples/blog/ and
 * asserts every migrated surface still renders correctly.
 *
 * Unlike the puppeteer-based `test/e2e.test.mjs` (gated behind
 * WEBJS_E2E=1, requires Chromium), this is a fetch-only test that always
 * runs as part of `npm test`. The trade-off: no JS execution, no
 * hydration check: just SSR HTML + HTTP status assertions. Catches the
 * specific regression classes the recent Tier-1/Tier-2 migration would
 * introduce:
 *   - stale `<ui-button>`/`<ui-card>`/etc. tags in any migrated page
 *   - missing class-helper output (e.g. cardClass returns its tailwind
 *     string and that string appears in /login HTML)
 *   - Tier-2 `<ui-dialog>` rendering on /ui-demo
 *   - server boot failures from broken imports in the migrated files
 *
 * Skipped automatically when the blog DB hasn't been migrated yet
 * (predev/prestart hooks usually handle this, but in a fresh CI clone
 * with no migrations, just skip rather than fail).
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..', '..', '..');
const BLOG_DIR = resolve(ROOT, 'examples', 'blog');

/** Bind to port 0, capture the assigned port, release. Race-free enough for a serial test. */
function freePort() {
  return new Promise((resolveP, rejectP) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', rejectP);
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolveP(port));
    });
  });
}

const skip =
  !existsSync(resolve(BLOG_DIR, 'package.json')) ||
  !existsSync(resolve(BLOG_DIR, 'prisma', 'dev.db'));

describe('Blog smoke (Tier-1/Tier-2 migration)', { skip: skip && 'blog or its DB not present' }, () => {
  let proc, baseUrl;

  before(async () => {
    const port = await freePort();
    baseUrl = `http://localhost:${port}`;

    proc = spawn('node', [resolve(ROOT, 'packages/cli/bin/webjs.js'), 'dev', '--port', String(port)], {
      cwd: BLOG_DIR,
      env: { ...process.env, WEBJS_TS_VERBOSE: '0' },
      // ignore stdio so the OS doesn't fill an unread pipe buffer and
      // block webjs dev's output. The Prisma deprecation warnings + request
      // logs would otherwise saturate ~64KB and freeze the child.
      stdio: 'ignore',
      // Detach so SIGTERM in `after()` cleans up the whole process group
      // (webjs dev spawns its own node --watch child).
      detached: true,
    });
    // Avoid keeping the parent process alive on proc's behalf.
    proc.unref();

    // Wait for the server to print "ready" or for / to return 200.
    const start = Date.now();
    while (Date.now() - start < 15000) {
      try {
        const r = await fetch(baseUrl + '/');
        if (r.ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('blog dev server did not become ready within 15s');
  });

  after(async () => {
    if (!proc) return;
    // Signal the whole detached process group so the node --watch child
    // and the dev server child both get the signal.
    try { process.kill(-proc.pid, 'SIGTERM'); } catch {}
    await new Promise((r) => setTimeout(r, 300));
    try { process.kill(-proc.pid, 'SIGKILL'); } catch {}
  });

  test('routes return expected status codes', async () => {
    const cases = [
      ['/',                       200],
      ['/login',                  200],
      ['/about',                  200],
      ['/ui-demo',                200],
      ['/api/hello',              200],
      ['/api/posts',              200],
      ['/dashboard',              302], // auth gate
      ['/blog/does-not-exist',    404],
    ];
    for (const [path, expected] of cases) {
      const r = await fetch(baseUrl + path, { redirect: 'manual' });
      assert.equal(r.status, expected, `${path} returned ${r.status}, expected ${expected}`);
    }
  });

  test('/login renders class-helper output, not stale <ui-X> tags', async () => {
    const html = await fetch(baseUrl + '/login').then((r) => r.text());

    // Characteristic buttonClass() output.
    assert.match(html, /bg-primary text-primary-foreground hover:bg-primary/);
    // Characteristic inputClass() output.
    assert.match(html, /border-input/);
    // Characteristic labelClass() output. The full string is
    // "flex items-center gap-2 text-sm leading-none font-medium …".
    // Pin on a unique stretch.
    assert.match(html, /text-sm leading-none font-medium/);
    // Characteristic cardClass() output.
    assert.match(html, /rounded-xl border bg-card/);

    // No stale Tier-1 tags.
    for (const tag of ['ui-button', 'ui-card', 'ui-card-header', 'ui-card-content', 'ui-input', 'ui-label', 'ui-alert', 'ui-badge']) {
      assert.doesNotMatch(html, new RegExp(`<${tag}\\b`), `/login should not render <${tag}>`);
    }
  });

  test('/ui-demo renders BOTH class-helper output AND Tier-2 ui-dialog', async () => {
    const html = await fetch(baseUrl + '/ui-demo').then((r) => r.text());

    // Tier 1: cardClass + buttonClass output present.
    assert.match(html, /rounded-xl border bg-card/, 'cardClass output present');
    assert.match(html, /bg-primary text-primary-foreground hover:bg-primary/, 'buttonClass output present');

    // Tier 2: <ui-dialog> + subparts rendered as custom elements.
    for (const tag of ['ui-dialog', 'ui-dialog-trigger', 'ui-dialog-content']) {
      assert.match(html, new RegExp(`<${tag}\\b`), `expected <${tag}> on /ui-demo`);
    }

    // No stale Tier-1 tags.
    for (const tag of ['ui-button', 'ui-card', 'ui-card-header', 'ui-input', 'ui-label', 'ui-alert', 'ui-badge']) {
      assert.doesNotMatch(html, new RegExp(`<${tag}\\b`), `/ui-demo should not render <${tag}>`);
    }
  });

  test('/api/hello returns valid JSON', async () => {
    const r = await fetch(baseUrl + '/api/hello');
    const json = await r.json();
    assert.equal(typeof json.hello, 'string');
  });
});
