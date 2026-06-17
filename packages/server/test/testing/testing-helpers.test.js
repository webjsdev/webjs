/**
 * Tests for the handle() test-harness helpers (issue #267):
 *   - testRequest fires through the real pipeline and returns the Response;
 *   - getCsrf returns a usable {cookie, token} pair off the first SSR response;
 *   - actionEndpoint addresses an action by the same file-path hash the stub uses;
 *   - invokeActionForTest round-trips an action through /__webjs/action/<hash>/<fn>,
 *     including the serializer (a Date arg survives) and CSRF;
 *   - the CSRF-missing case is rejected (403) and a thrown action sanitizes in prod;
 *   - loginAndGetCookies drives the real auth flow against a fixture app and the
 *     captured cookie unlocks a protected route.
 *
 * tmpdir app fixtures, like body-limit/integration.test.js. Fixtures that need
 * the `html` tag import it from core's source by absolute file URL (a random
 * tmpdir can't resolve the `@webjsdev/*` bare specifiers).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import {
  testRequest,
  getCsrf,
  actionEndpoint,
  invokeActionForTest,
  rawActionRequest,
  loginAndGetCookies,
  withSessionCookie,
} from '../../src/testing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_URL = JSON.stringify(pathToFileURL(resolve(__dirname, '../../../core/src/html.js')).toString());
const AUTH_URL = JSON.stringify(pathToFileURL(resolve(__dirname, '../../src/auth.js')).toString());

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-testing-')); });
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

/** A fixture app with a page + a rich-type action + a throwing action. */
function actionApp() {
  return makeApp({
    'app/page.js':
      `import { html } from ${HTML_URL};\n` +
      `import { roundtrip, boom } from '../modules/m/act.server.js';\n` +
      `export default function P() { return html\`<p>\${roundtrip}\${boom}</p>\`; }\n`,
    'modules/m/act.server.js':
      `'use server';\n` +
      // Echo back a value that only survives if the wire serializer ran: a Date
      // arg must come back as a Date, and we report its type + ISO string.
      `export async function roundtrip(d) {\n` +
      `  return { isDate: d instanceof Date, iso: d instanceof Date ? d.toISOString() : null, when: d };\n` +
      `}\n` +
      `export async function boom() { throw new Error('secret stack detail'); }\n`,
  });
}

test('testRequest fires a bare path through the real pipeline', async () => {
  const appDir = makeApp({
    'app/page.js': `import { html } from ${HTML_URL};\nexport default () => html\`<h1 id="hi">Hello harness</h1>\`;\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const res = await testRequest(app.handle, '/');
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /Hello harness/);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
});

test('getCsrf returns a usable token off the first SSR response', async () => {
  const appDir = makeApp({
    'app/page.js': `import { html } from ${HTML_URL};\nexport default () => html\`<p>x</p>\`;\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const csrf = await getCsrf(app.handle);
  assert.ok(csrf.token && csrf.token.length >= 16, 'token is a real value');
  assert.match(csrf.cookie, /^webjs_csrf=/);
  assert.equal(csrf.header, 'x-webjs-csrf');
});

test('actionEndpoint matches the hash the generated stub uses', async () => {
  const appDir = actionApp();
  const app = await createRequestHandler({ appDir, dev: true });
  // The stub the dev server serves embeds the real action URL.
  const stub = await (await app.handle(new Request('http://x/modules/m/act.server.js'))).text();
  const stubHash = /\/__webjs\/action\/([a-f0-9]+)\//.exec(stub)[1];
  const endpoint = await actionEndpoint(appDir, 'modules/m/act.server.js', 'roundtrip');
  assert.equal(endpoint, `/__webjs/action/${stubHash}/roundtrip`);
});

test('invokeActionForTest round-trips a Date arg through the serializer', async () => {
  const appDir = actionApp();
  const app = await createRequestHandler({ appDir, dev: true });
  const when = new Date('2026-01-02T03:04:05.000Z');
  const out = await invokeActionForTest(app, 'modules/m/act.server.js', 'roundtrip', [when]);
  // If the wire serializer did NOT run, the arg would arrive as a string and
  // `isDate` would be false. This proves the real /__webjs/action path ran.
  assert.equal(out.isDate, true, 'the Date arg survived as a Date through the wire');
  assert.equal(out.iso, '2026-01-02T03:04:05.000Z');
  assert.ok(out.when instanceof Date, 'the returned value also decoded back to a Date');
});

test('invokeActionForTest accepts just (handle) when appDir is supplied', async () => {
  const appDir = actionApp();
  const app = await createRequestHandler({ appDir, dev: true });
  const out = await invokeActionForTest(
    app.handle, 'modules/m/act.server.js', 'roundtrip', [new Date(0)], { appDir },
  );
  assert.equal(out.isDate, true);
});

test('a CSRF-missing action request is rejected with 403', async () => {
  const appDir = actionApp();
  const app = await createRequestHandler({ appDir, dev: true });
  const res = await rawActionRequest(app, 'modules/m/act.server.js', 'roundtrip', [new Date()], { omitCsrf: true });
  assert.equal(res.status, 403, 'no CSRF header/cookie -> 403 (the endpoint enforces it)');
});

test('invokeActionForTest surfaces a thrown action as a throw with a status', async () => {
  const appDir = actionApp();
  // dev: false so the prod error sanitization path runs.
  const app = await createRequestHandler({ appDir, dev: false });
  await assert.rejects(
    () => invokeActionForTest(app, 'modules/m/act.server.js', 'boom', []),
    (err) => {
      assert.equal(err.status, 500, 'the thrown action surfaces as a 500');
      // Prod sanitization exposes only the message (author-controlled), never
      // the stack. The direct import would NOT exercise this branch.
      assert.match(err.message, /secret stack detail/);
      return true;
    },
  );
});

/* ---------------- auth / session helpers against a real auth app ---------------- */

/**
 * A fixture app wiring createAuth (jwt strategy) with an in-memory user, the
 * auth route handler, and a protected route gated by `auth()`. No database: the
 * authorize callback checks a hard-coded credential so the test needs no DB.
 */
function authApp() {
  return makeApp({
    'lib/auth.server.js':
      `import { createAuth, Credentials } from ${AUTH_URL};\n` +
      `export const { auth, handlers } = createAuth({\n` +
      `  secret: 'test-secret-at-least-32-characters-long!!',\n` +
      `  providers: [Credentials({\n` +
      `    async authorize(c) {\n` +
      `      if (c.email === 'a@b.co' && c.password === 'pw') return { id: '1', name: 'Ann', email: 'a@b.co' };\n` +
      `      return null;\n` +
      `    },\n` +
      `  })],\n` +
      `});\n`,
    'app/api/auth/[...path]/route.js':
      `import { handlers } from '../../../../lib/auth.server.js';\n` +
      `export const GET = handlers.GET;\n` +
      `export const POST = handlers.POST;\n`,
    'app/dashboard/middleware.js':
      `import { auth } from '../../lib/auth.server.js';\n` +
      `export default async function requireAuth(req, next) {\n` +
      `  const session = await auth();\n` +
      `  if (!session?.user) return new Response(null, { status: 302, headers: { location: '/login' } });\n` +
      `  return next();\n` +
      `}\n`,
    'app/dashboard/page.js':
      `import { html } from ${HTML_URL};\n` +
      `import { auth } from '../../lib/auth.server.js';\n` +
      `export default async function Dashboard() {\n` +
      `  const session = await auth();\n` +
      `  return html\`<h1 id="dash">Dashboard for \${session?.user?.email}</h1>\`;\n` +
      `}\n`,
    'app/login/page.js':
      `import { html } from ${HTML_URL};\nexport default () => html\`<h1>Login</h1>\`;\n`,
  });
}

test('loginAndGetCookies drives the real login and the cookie unlocks a protected route', async () => {
  const appDir = authApp();
  const app = await createRequestHandler({ appDir, dev: true });

  // Unauthenticated dashboard redirects to /login (the gate).
  const unauth = await testRequest(app.handle, '/dashboard');
  assert.equal(unauth.status, 302);
  assert.equal(unauth.headers.get('location'), '/login');

  // Real login via the auth route handler captures the genuine session cookie.
  const { cookies, response } = await loginAndGetCookies(app.handle, { email: 'a@b.co', password: 'pw' });
  assert.equal(response.status, 302, 'a valid credentials login 302-redirects');
  assert.match(cookies, /webjs\.auth=/, 'the captured cookie is the real signed auth cookie');

  // The captured cookie unlocks the dashboard.
  const authed = await testRequest(app.handle, '/dashboard', withSessionCookie({}, cookies));
  assert.equal(authed.status, 200);
  const body = await authed.text();
  assert.match(body, /Dashboard for a@b\.co/);
});

test('loginAndGetCookies throws on bad credentials (no session Set-Cookie)', async () => {
  const appDir = authApp();
  const app = await createRequestHandler({ appDir, dev: true });
  await assert.rejects(
    () => loginAndGetCookies(app.handle, { email: 'a@b.co', password: 'wrong' }),
    /no Set-Cookie/,
  );
});
