/**
 * Integration test for forbidden() / unauthorized() and their boundary files
 * (#848, Next 15/16 parity), through the REAL SSR pipeline. A page that throws
 * forbidden() / unauthorized() renders the nearest forbidden.{js,ts} /
 * unauthorized.{js,ts} boundary at status 403 / 401 (nearest-wins), or a default
 * page when none exists. Web-standard Request/Response, no HTTP server.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-403-')); });
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

const pkg = JSON.stringify({ name: 'boundary-app' });

test('forbidden() renders the nearest forbidden.ts at 403', async () => {
  const appDir = makeApp({
    'package.json': pkg,
    'app/admin/page.js':
      `import { forbidden } from ${JSON.stringify(CORE)};\n` +
      `export default function Admin() { forbidden(); }\n`,
    'app/admin/forbidden.js':
      `import { html } from ${JSON.stringify(CORE)};\n` +
      `export default function F() { return html\`<main>no access to admin</main>\`; }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/admin'));
  assert.equal(resp.status, 403);
  assert.match(await resp.text(), /no access to admin/);
});

test('unauthorized() renders unauthorized.ts at 401', async () => {
  const appDir = makeApp({
    'package.json': pkg,
    'app/account/page.js':
      `import { unauthorized } from ${JSON.stringify(CORE)};\n` +
      `export default function Acct() { unauthorized(); }\n`,
    'app/account/unauthorized.js':
      `import { html } from ${JSON.stringify(CORE)};\n` +
      `export default function U() { return html\`<main>please sign in</main>\`; }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/account'));
  assert.equal(resp.status, 401);
  assert.match(await resp.text(), /please sign in/);
});

test('nearest forbidden.ts wins over an ancestor one', async () => {
  const appDir = makeApp({
    'package.json': pkg,
    'app/forbidden.js':
      `import { html } from ${JSON.stringify(CORE)};\n` +
      `export default function Root() { return html\`<main>root forbidden</main>\`; }\n`,
    'app/team/forbidden.js':
      `import { html } from ${JSON.stringify(CORE)};\n` +
      `export default function Team() { return html\`<main>team forbidden</main>\`; }\n`,
    'app/team/page.js':
      `import { forbidden } from ${JSON.stringify(CORE)};\n` +
      `export default function T() { forbidden(); }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/team'));
  assert.equal(resp.status, 403);
  const body = await resp.text();
  assert.match(body, /team forbidden/, 'the nearest (team) boundary wins');
  assert.doesNotMatch(body, /root forbidden/);
});

test('forbidden() thrown from a page ACTION (no-JS write path) renders the 403 boundary, not a 500', async () => {
  const appDir = makeApp({
    'package.json': pkg,
    // A page with an `action` export that throws forbidden() on submit.
    'app/settings/page.js':
      `import { html, forbidden } from ${JSON.stringify(CORE)};\n` +
      `export default function S() { return html\`<form method="post"><button>go</button></form>\`; }\n` +
      `export function action() { forbidden(); }\n`,
    'app/settings/forbidden.js':
      `import { html } from ${JSON.stringify(CORE)};\n` +
      `export default function F() { return html\`<main>settings forbidden</main>\`; }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin', origin: 'http://x' },
    body: '',
  }));
  assert.equal(resp.status, 403, 'page-action forbidden() is a 403, not a generic 500');
  assert.match(await resp.text(), /settings forbidden/);
});

test('unauthorized() thrown from a page ACTION renders the 401 boundary', async () => {
  const appDir = makeApp({
    'package.json': pkg,
    'app/private/page.js':
      `import { html, unauthorized } from ${JSON.stringify(CORE)};\n` +
      `export default function P() { return html\`<form method="post"><button>go</button></form>\`; }\n` +
      `export function action() { unauthorized(); }\n`,
    'app/private/unauthorized.js':
      `import { html } from ${JSON.stringify(CORE)};\n` +
      `export default function U() { return html\`<main>private unauthorized</main>\`; }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/private', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin', origin: 'http://x' },
    body: '',
  }));
  assert.equal(resp.status, 401);
  assert.match(await resp.text(), /private unauthorized/);
});

test('forbidden() with NO boundary file falls back to a default 403 page', async () => {
  const appDir = makeApp({
    'package.json': pkg,
    'app/secret/page.js':
      `import { forbidden } from ${JSON.stringify(CORE)};\n` +
      `export default function S() { forbidden(); }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/secret'));
  assert.equal(resp.status, 403);
  assert.match(await resp.text(), /403/);
});
