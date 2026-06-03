/**
 * Integration tests for the trailing-slash policy (issue #255). Exercised
 * through createRequestHandler so they cover the real response pipeline (the
 * canonicalization runs at the start of produce(), after the declarative
 * redirects, before routing / SSR), not the matcher in isolation.
 * Web-standard Request/Response, no real HTTP server.
 *
 * The contract under test:
 *   - `never`: /about/ -> 308 /about; /about and / stay; query preserved
 *   - `always`: /about -> 308 /about/; /about/ and / stay; a file path
 *     (/foo.js) is NOT redirected
 *   - `ignore` / absent: no canonicalization (both forms render 200)
 *   - an explicit webjs.redirects rule wins first, then the survivor is
 *     slash-canonicalized, with no loop
 *   - /__webjs/* framework paths are exempt
 *   - SECURITY: a network-path-reference path (`//attacker.com/`, `/\evil.com/`)
 *     is NOT canonicalized into a protocol-relative cross-origin redirect
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import {
  readTrailingSlashPolicy,
  applyTrailingSlash,
} from '../../src/redirects.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_URL = pathToFileURL(
  resolve(__dirname, '../../../core/src/html.js')
).toString();

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-trailing-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

function page(body) {
  return (
    `import { html } from ${JSON.stringify(HTML_URL)};\n` +
    `export default function P() { return html\`${body}\`; }\n`
  );
}

function pkg(extra) {
  return JSON.stringify({ name: 'slash-app', webjs: extra });
}

/* ------------------------------ never ------------------------------ */

test('never: /about/ 308-redirects to /about', async () => {
  const appDir = makeApp({
    'package.json': pkg({ trailingSlash: 'never' }),
    'app/about/page.js': page('<h1>about</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/about/'));
  // COUNTERFACTUAL anchor: remove the applyTrailingSlash call in produce()
  // and /about/ renders 200 (the router matches it) instead of 308-ing,
  // so this assertion fails.
  assert.equal(resp.status, 308);
  assert.equal(resp.headers.get('location'), '/about');
});

test('never: /about (no slash) is canonical, stays 200', async () => {
  const appDir = makeApp({
    'package.json': pkg({ trailingSlash: 'never' }),
    'app/about/page.js': page('<h1>about</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/about'));
  assert.equal(resp.status, 200);
});

test('never: the root / is always left alone', async () => {
  const appDir = makeApp({
    'package.json': pkg({ trailingSlash: 'never' }),
    'app/page.js': page('<h1>home</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/'));
  assert.equal(resp.status, 200);
});

test('never: the query string is preserved on the redirect', async () => {
  const appDir = makeApp({
    'package.json': pkg({ trailingSlash: 'never' }),
    'app/about/page.js': page('<h1>about</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/about/?x=1&y=2'));
  assert.equal(resp.status, 308);
  assert.equal(resp.headers.get('location'), '/about?x=1&y=2');
});

/* ------------------------------ always ------------------------------ */

test('always: /about (no slash) 308-redirects to /about/', async () => {
  const appDir = makeApp({
    'package.json': pkg({ trailingSlash: 'always' }),
    'app/about/page.js': page('<h1>about</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/about'));
  assert.equal(resp.status, 308);
  assert.equal(resp.headers.get('location'), '/about/');
});

test('always: /about/ is canonical, stays 200', async () => {
  const appDir = makeApp({
    'package.json': pkg({ trailingSlash: 'always' }),
    'app/about/page.js': page('<h1>about</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/about/'));
  assert.equal(resp.status, 200);
});

test('always: a file path (/foo.js) is NOT given a trailing slash', async () => {
  const appDir = makeApp({
    'package.json': pkg({ trailingSlash: 'always' }),
    'app/page.js': page('<h1>home</h1>'),
    'public/foo.js': 'export const x = 1;\n',
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/foo.js'));
  assert.notEqual(resp.status, 308);
});

test('always: the root / is always left alone', async () => {
  const appDir = makeApp({
    'package.json': pkg({ trailingSlash: 'always' }),
    'app/page.js': page('<h1>home</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/'));
  assert.equal(resp.status, 200);
});

/* ------------------------------ ignore / absent ------------------------------ */

test('ignore: /about/ is NOT canonicalized (renders 200)', async () => {
  const appDir = makeApp({
    'package.json': pkg({ trailingSlash: 'ignore' }),
    'app/about/page.js': page('<h1>about</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/about/'));
  assert.equal(resp.status, 200);
});

test('absent config: no canonicalization (both forms render 200)', async () => {
  const appDir = makeApp({
    'package.json': JSON.stringify({ name: 'no-config-app' }),
    'app/about/page.js': page('<h1>about</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const slashed = await app.handle(new Request('http://x/about/'));
  const bare = await app.handle(new Request('http://x/about'));
  assert.equal(slashed.status, 200);
  assert.equal(bare.status, 200);
});

/* --------------------- interaction with webjs.redirects --------------------- */

test('an explicit redirect wins first, then the survivor is slash-canonicalized (no loop)', async () => {
  const appDir = makeApp({
    // /old/ -> (redirect) /new -> (already canonical under never) served
    'package.json': pkg({
      trailingSlash: 'never',
      redirects: [{ source: '/old', destination: '/new' }],
    }),
    'app/new/page.js': page('<h1>new</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  // /old (no slash) matches the explicit redirect and goes straight to /new,
  // never reaching the slash policy. The explicit redirect wins first.
  const r1 = await app.handle(new Request('http://x/old'));
  assert.equal(r1.status, 308);
  assert.equal(r1.headers.get('location'), '/new');
  // A non-redirected, non-canonical path is still slash-canonicalized: the
  // two surfaces compose without a loop.
  const r2 = await app.handle(new Request('http://x/new/'));
  assert.equal(r2.status, 308);
  assert.equal(r2.headers.get('location'), '/new');
});

/* ------------------------------ exemptions ------------------------------ */

test('/__webjs/* framework paths are exempt from canonicalization', async () => {
  const appDir = makeApp({
    'package.json': pkg({ trailingSlash: 'never' }),
    'app/page.js': page('<h1>home</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/__webjs/health/'));
  // The health probe path is infrastructure, not an app URL: it must not be
  // 308-redirected by the slash policy.
  assert.notEqual(resp.status, 308);
});

/* ------------------- SECURITY: open-redirect guard ------------------- */

// A request path that is a network-path reference (`//host`, or `/\host` which
// the URL parser normalizes to `//host`) must NOT be canonicalized: stripping
// the trailing slash off `//attacker.com/` would emit `Location: //attacker.com`,
// a protocol-relative URL the browser resolves to a FOREIGN origin (an open
// redirect). The guard returns null so the path falls through to the router.

test('never: //attacker.com/ does NOT produce a cross-origin redirect', async () => {
  const appDir = makeApp({
    'package.json': pkg({ trailingSlash: 'never' }),
    'app/page.js': page('<h1>home</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://victim.example//attacker.com/'));
  // The headline assertion: no 3xx with a `//`-prefixed / cross-origin Location.
  // COUNTERFACTUAL: drop the isSameOriginPath guard and this 308s to
  // `//attacker.com`, an open redirect, so this fails.
  assert.notEqual(resp.status, 308);
  const loc = resp.headers.get('location');
  if (loc) assert.ok(!loc.startsWith('//'), `unexpected protocol-relative Location: ${loc}`);
});

test('never: /\\evil.com/ (backslash) does NOT produce a cross-origin redirect', async () => {
  const appDir = makeApp({
    'package.json': pkg({ trailingSlash: 'never' }),
    'app/page.js': page('<h1>home</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  // The URL parser normalizes the backslash to `/`, so the path is `//evil.com/`.
  const resp = await app.handle(new Request('http://victim.example/\\evil.com/'));
  assert.notEqual(resp.status, 308);
  const loc = resp.headers.get('location');
  if (loc) assert.ok(!loc.startsWith('//'), `unexpected protocol-relative Location: ${loc}`);
});

test('applyTrailingSlash returns null for a network-path-reference path (no open redirect)', () => {
  // Direct-call coverage of the guard under both active policies.
  assert.equal(
    applyTrailingSlash(new Request('http://victim.example//attacker.com/'), 'never'),
    null
  );
  assert.equal(
    applyTrailingSlash(new Request('http://victim.example//attacker.com'), 'always'),
    null
  );
  // The backslash form (parser-normalized to `//evil.com/`) is rejected too.
  assert.equal(
    applyTrailingSlash(new Request('http://victim.example/\\evil.com/'), 'never'),
    null
  );
});

/* ----------------------------- unit-level ----------------------------- */

test('readTrailingSlashPolicy normalizes config values', () => {
  assert.equal(readTrailingSlashPolicy({ webjs: { trailingSlash: 'never' } }), 'never');
  assert.equal(readTrailingSlashPolicy({ webjs: { trailingSlash: 'always' } }), 'always');
  assert.equal(readTrailingSlashPolicy({ webjs: { trailingSlash: 'ignore' } }), 'ignore');
  // absent / malformed / unknown -> the non-breaking 'ignore' default
  assert.equal(readTrailingSlashPolicy({}), 'ignore');
  assert.equal(readTrailingSlashPolicy({ webjs: {} }), 'ignore');
  assert.equal(readTrailingSlashPolicy({ webjs: { trailingSlash: 'maybe' } }), 'ignore');
  assert.equal(readTrailingSlashPolicy(null), 'ignore');
});

test('applyTrailingSlash returns null for ignore policy and for canonical paths', () => {
  assert.equal(applyTrailingSlash(new Request('http://x/about/'), 'ignore'), null);
  assert.equal(applyTrailingSlash(new Request('http://x/about'), 'never'), null);
  assert.equal(applyTrailingSlash(new Request('http://x/about/'), 'always'), null);
  assert.equal(applyTrailingSlash(new Request('http://x/'), 'never'), null);
  assert.equal(applyTrailingSlash(new Request('http://x/'), 'always'), null);
});

test('applyTrailingSlash preserves the hash on the redirect', () => {
  // A hash never reaches the server in a real request, but the helper keeps
  // it for completeness / direct callers.
  const resp = applyTrailingSlash(new Request('http://x/about/?q=1'), 'never');
  assert.equal(resp.status, 308);
  assert.equal(resp.headers.get('location'), '/about?q=1');
});
