/**
 * Cross-runtime proof for Auth.js's middleware and route habits (#1686),
 * through a real request handler: `export { auth as middleware }` with a
 * `callbacks.authorized` gate, a cross-site POST to the sign-in route refused,
 * and a GET to sign-out that only confirms. Run from the repo root under
 * either runtime:
 *
 *   node test/bun/auth-middleware.mjs
 *   bun  test/bun/auth-middleware.mjs
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createRequestHandler } from '@webjsdev/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const here = dirname(fileURLToPath(import.meta.url));
const SERVER = JSON.stringify(pathToFileURL(resolve(here, '../../packages/server/index.js')).toString());
const CORE = JSON.stringify(pathToFileURL(resolve(here, '../../packages/core/index.js')).toString());
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'webjs-auth-mw-'));
const w = (rel, body) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), body); };
try {
  w('package.json', JSON.stringify({ name: 'auth-mw', type: 'module' }));
  w('lib/auth.server.js',
    `import { createAuth, Credentials } from ${SERVER};\n`
    + `export const { auth, signIn, handlers } = createAuth({\n`
    + `  secret: 'auth-middleware-proof-secret-0123456789',\n`
    + `  providers: [Credentials({ authorize: async () => ({ id: '1', email: 'a@example.com' }) })],\n`
    + `  pages: { signIn: '/login' },\n`
    + `  callbacks: { authorized: ({ auth, request }) => !!auth || !new URL(request.url).pathname.startsWith('/dash') },\n`
    + `});\n`);
  w('middleware.js', `export { auth as middleware } from './lib/auth.server.js';\n`);
  w('app/api/auth/[...path]/route.js', `import { handlers } from '../../../../lib/auth.server.js';\nexport const { GET, POST } = handlers;\n`);
  w('app/layout.js', `import { html } from ${CORE};\nexport default ({ children }) => html\`<!doctype html><html><body>\${children}</body></html>\`;\n`);
  w('app/page.js', `import { html } from ${CORE};\nexport default () => html\`<h1>home</h1>\`;\n`);
  w('app/login/page.js', `import { html } from ${CORE};\nexport default () => html\`<h1>login</h1>\`;\n`);
  w('app/dash/page.js', `import { html } from ${CORE};\nexport default () => html\`<h1>dashboard</h1>\`;\n`);

  const app = await createRequestHandler({ appDir: dir, dev: true, logger: quiet });
  const get = (path, headers = {}) => app.handle(new Request('http://localhost' + path, { headers }));

  assert.equal((await get('/')).status, 200, 'a public page passes the middleware');
  const gated = await get('/dash');
  assert.equal(gated.status, 302, 'authorized() returning false redirects');
  assert.match(gated.headers.get('location') || '', /\/login\?callbackUrl=%2Fdash$/);

  const signin = (headers) => app.handle(new Request('http://localhost/api/auth/signin/credentials', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}',
  }));
  assert.equal((await signin({ 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' })).status, 403, 'login CSRF refused');
  const ok = await signin({ 'sec-fetch-site': 'same-origin' });
  assert.equal(ok.status, 302);
  const cookie = (ok.headers.get('set-cookie') || '').split(';')[0];
  assert.match(cookie, /webjs\.auth=/);
  const dash = await get('/dash', { cookie });
  assert.equal(dash.status, 200, 'signed in, the middleware lets the page render (it used to 500)');
  assert.match(await dash.text(), /dashboard/);

  const signout = await get('/api/auth/signout', { cookie });
  assert.equal(signout.status, 200, 'a GET only confirms');
  assert.equal(signout.headers.get('set-cookie'), null, 'and clears nothing');

  console.log(`auth middleware: ok on ${runtime}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
