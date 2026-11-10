/**
 * The server-side findings of the owner's fourth review of PR #1687, each
 * pinned by a test through `createRequestHandler` against a tmpdir app (the
 * attribute-reader one is in packages/core/test).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../src/dev.js';
import { createAuth, Credentials } from '../src/auth.js';
import { setBasePath } from '../src/importmap.js';
import { headerSafeLocation } from '../src/redirect-location.js';

const SECRET = 'review-1687-round4-secret-at-least-32-bytes';

const __dirname = dirname(fileURLToPath(import.meta.url));
// A tmpdir fixture cannot resolve the bare specifiers, so it imports by URL.
const CORE = JSON.stringify(pathToFileURL(resolve(__dirname, '../../core/index.js')).toString());
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-review-r4-')); });
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

const identityOf = (html) => /name="__webjs_action" value="([^"]*)"/.exec(html)?.[1] ?? null;

function post(path, fields, headers = {}) {
  return new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(fields).toString(),
  });
}

/** The `name=value` pairs a response sets, as a request Cookie header. */
const cookieOf = (res) => res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

test('a failed form action on a cached page renders the error, never the cached 200', async () => {
  const seen = [];
  const appDir = makeApp({
    'modules/x/actions/boom.server.ts': `'use server';\nexport async function boom() { throw new Error('ACTION_BOOM'); }\n`,
    'app/c/page.ts': `
import { html } from ${CORE};
import { boom } from '../../modules/x/actions/boom.server.ts';
export const revalidate = 60;
export default () => html\`<form action=\${boom}><button>go</button></form>\`;
`,
  });
  const app = await createRequestHandler({ appDir, dev: true, logger: quiet, onError: (e) => seen.push(e) });
  // Warm the HTML cache: the first GET stores the page, the second is a hit.
  const html = await (await app.handle(new Request('http://x/c'))).text();
  await app.handle(new Request('http://x/c'));
  const quietErr = console.error;
  console.error = () => {};
  let res;
  try { res = await app.handle(post('/c', { __webjs_action: identityOf(html) })); } finally { console.error = quietErr; }
  assert.equal(res.status, 500, 'the throw answers with the error page, not the cached page');
  assert.ok(seen.some((e) => e instanceof Error && e.message === 'ACTION_BOOM'), 'and onError hears it');
});

test('an action result is shown only on the page its redirect lands on, and a frame load leaves it', async () => {
  const appDir = makeApp({
    'modules/x/actions/save.server.ts': `'use server';\nexport async function save() { return { success: true, message: 'SAVED_MSG' }; }\n`,
    'app/a/page.ts': `
import { html } from ${CORE};
import { save } from '../../modules/x/actions/save.server.ts';
export default ({ actionData }) => html\`<p>\${actionData?.message ?? 'none'}</p><form action=\${save}><button>go</button></form>\`;
`,
    'app/other/page.ts': `
import { html } from ${CORE};
export default ({ actionData }) => html\`<p>\${actionData?.message ?? 'none'}</p>\`;
`,
  });
  const app = await createRequestHandler({ appDir, dev: true, logger: quiet });
  const html = await (await app.handle(new Request('http://x/a'))).text();
  const done = await app.handle(post('/a', { __webjs_action: identityOf(html) }));
  assert.equal(done.status, 303);
  const cookie = cookieOf(done);

  const other = await app.handle(new Request('http://x/other', { headers: { cookie } }));
  const otherHtml = await other.text();
  assert.doesNotMatch(otherHtml, /SAVED_MSG/, 'another page never shows it');
  assert.equal(other.headers.getSetCookie().length, 0, 'and leaves it unconsumed');

  const frame = await app.handle(new Request('http://x/a', { headers: { cookie, 'x-webjs-frame': 'f' } }));
  await frame.text();
  assert.equal(frame.headers.getSetCookie().length, 0, 'a frame load of the target leaves it too');

  const target = await app.handle(new Request('http://x/a', { headers: { cookie } }));
  assert.match(await target.text(), /SAVED_MSG/, 'the page the redirect named shows it');
});

test('a schema validator that throws issues re-renders the form at 422; any other throw is still an error', async () => {
  const appDir = makeApp({
    'modules/x/actions/join.server.ts': `'use server';
export function validate(input) {
  if (input.email === 'crash') throw new Error('VALIDATOR_CRASH');
  const e = new Error('[{"path":["email"]}]');
  e.issues = [{ path: ['email'], message: 'EMAIL_ISSUE' }, { path: ['email'], message: 'second' }, { path: [], message: 'FORM_ISSUE' }];
  throw e;
}
export async function join() { return { success: true }; }
`,
    'app/j/page.ts': `
import { html } from ${CORE};
import { join } from '../../modules/x/actions/join.server.ts';
export default ({ actionData }) => html\`<p id="f">\${actionData?.fieldErrors?.email ?? ''}</p><p id="e">\${actionData?.error ?? ''}</p><form action=\${join}><input name="email"></form>\`;
`,
  });
  const app = await createRequestHandler({ appDir, dev: true, logger: quiet, onError: () => {} });
  const id = identityOf(await (await app.handle(new Request('http://x/j'))).text());

  const invalid = await app.handle(post('/j', { __webjs_action: id, email: 'nope' }));
  assert.equal(invalid.status, 422, 'invalid input re-renders the form');
  const body = await invalid.text();
  assert.match(body, /<p id="f">EMAIL_ISSUE<\/p>/, 'the first issue per field becomes its fieldError');
  assert.match(body, /<p id="e">FORM_ISSUE<\/p>/, 'a path-less issue becomes the form error');

  const quietErr = console.error;
  console.error = () => {};
  let crash;
  try { crash = await app.handle(post('/j', { __webjs_action: id, email: 'crash' })); } finally { console.error = quietErr; }
  assert.equal(crash.status, 500, 'a validator that crashes still renders the error page');
});

test('sign-in and sign-out targets go through callbacks.redirect, whose default keeps this origin', async () => {
  const providers = [Credentials({ authorize: async () => ({ id: '1', email: 'a@b.c' }) })];
  const plain = createAuth({ secret: SECRET, providers });
  const req = new Request('https://app.example/account');
  const where = async (auth, redirectTo) =>
    (await auth.signOut({ redirectTo, req })).headers.get('location');

  // The default (Auth.js's): a local path, or this origin's URL as its path.
  assert.equal(await where(plain, '/bye'), '/bye');
  assert.equal(await where(plain, 'https://app.example/bye?x=1'), '/bye?x=1', 'a same-origin URL keeps its path');
  assert.equal(await where(plain, 'https://idp.example/end-session'), '/', 'another origin is dropped, even from server code');
  assert.equal(await where(plain, '/日本'), '/%E6%97%A5%E6%9C%AC', 'a non-Latin-1 target is encoded, not a thrown header');

  // The app allows its identity provider's end-session URL the Auth.js way.
  const oidc = createAuth({
    secret: SECRET, providers,
    callbacks: { redirect: ({ url, baseUrl }) => (url.startsWith('https://idp.example/') ? url : new URL(url, baseUrl).pathname) },
  });
  assert.equal(await where(oidc, 'https://idp.example/end-session?id_token_hint=t'), 'https://idp.example/end-session?id_token_hint=t');

  // A submitted target through the sign-out route takes the same default.
  const routed = await plain.handlers.POST(new Request('https://app.example/api/auth/signout', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://app.example' },
    body: 'redirectTo=https%3A%2F%2Fevil.example%2F',
  }));
  assert.equal(routed.headers.get('location'), '/', 'a submitted absolute target is dropped');

  // And so does a credentials sign-in, server-side value or not.
  const signedIn = await plain.signIn('credentials', { email: 'a@b.c' }, { redirectTo: 'https://evil.example/', req });
  assert.equal(signedIn.headers.get('location'), '/', 'signIn takes the same default');
});

test('the auth routes match their base path at a segment boundary, and under a webjs.basePath mount', async () => {
  const auth = createAuth({ secret: SECRET, providers: [Credentials({ authorize: async () => null })] });
  const ok = await auth.handlers.GET(new Request('https://app.example/api/auth/session'));
  assert.match(ok.headers.get('content-type') || '', /json/, '/api/auth/session is the session route');
  // A prefix match read /api/authsession as /api/auth + session.
  const near = await auth.handlers.GET(new Request('https://app.example/api/authsession'));
  assert.doesNotMatch(near.headers.get('content-type') || '', /json/, '/api/authsession is not');

  const prev = process.env.AUTH_URL;
  // A non-default auth path under a mount: no /api/auth fallback can rescue it.
  process.env.AUTH_URL = 'https://app.example/app/custom-auth';
  await setBasePath('/app');
  try {
    const mounted = createAuth({ secret: SECRET, providers: [Credentials({ authorize: async () => null })] });
    // The ingress strip has removed /app from the path the handler sees.
    const res = await mounted.handlers.GET(new Request('https://app.example/custom-auth/session'));
    assert.match(res.headers.get('content-type') || '', /json/, 'the stripped path still reaches the session route');
    const providers = await (await mounted.handlers.GET(new Request('https://app.example/custom-auth/providers'))).json();
    assert.equal(providers.credentials.signinUrl, '/app/custom-auth/signin/credentials', 'emitted URLs keep the public prefix');
  } finally {
    await setBasePath('');
    if (prev === undefined) delete process.env.AUTH_URL; else process.env.AUTH_URL = prev;
  }
});

test('a redirect target holding a lone surrogate becomes a valid Location, not a URIError', () => {
  assert.equal(headerSafeLocation('/search?q=a\uD83D'), '/search?q=a%EF%BF%BD');
  assert.equal(headerSafeLocation('/q?x=\uD83D\uDE00'), '/q?x=%F0%9F%98%80', 'a whole pair still encodes as itself');
});
