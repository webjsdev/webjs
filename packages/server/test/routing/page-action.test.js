/**
 * Integration tests for page server actions (#244): a `page.{js,ts}` that
 * exports `action` handles a non-GET/HEAD submission to its own URL.
 *
 *   - invalid submit  => re-renders the SAME page (422) with field errors and
 *                        the submitted values preserved in the HTML.
 *   - valid submit    => 303 See Other to the PRG target (page's own path, or
 *                        the action's `redirect`).
 *   - no `action`     => non-GET to a page still 404s (the gate is action-
 *                        conditioned, the counterfactual).
 *   - thrown redirect()/notFound() from the action are honored.
 *
 * Exercised through `createRequestHandler` against a tmpdir app fixture, using
 * Web-standard Request/Response (no real HTTP server).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// A tmpdir app fixture cannot resolve the bare `@webjsdev/core` specifier
// server-side (no node_modules link). The browser path resolves it via the
// importmap, but SSR `import()`s the page module itself, so the fixture imports
// core from its absolute file URL. The runtime routing under test is unaffected.
const CORE = JSON.stringify(
  pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString(),
);

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-page-action-')); });
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

// A signup-style page with an `action`. Validates email; on failure returns
// fieldErrors + values (re-render with errors), on success redirects.
const SIGNUP_PAGE = `
import { html } from ${CORE};
export async function action({ formData }) {
  const email = String(formData.get('email') || '').trim();
  if (!email.includes('@')) {
    return {
      success: false,
      fieldErrors: { email: 'Enter a valid email' },
      values: { email },
      status: 422,
    };
  }
  return { success: true, redirect: '/welcome' };
}
export default function Signup({ actionData }) {
  const err = actionData?.fieldErrors?.email;
  const val = actionData?.values?.email || '';
  return html\`
    <form method="POST">
      <input name="email" value="\${val}">
      \${err ? html\`<p class="error">\${err}</p>\` : ''}
      <button>Sign up</button>
    </form>
  \`;
}
`;

function form(fields) {
  const fd = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: fd.toString(),
  };
}

test('POST with invalid data re-renders the page (422) with errors + preserved values', async () => {
  const appDir = makeApp({ 'app/signup/page.ts': SIGNUP_PAGE });
  const app = await createRequestHandler({ appDir, dev: true });
  await app.warmup();

  const resp = await app.handle(
    new Request('http://x/signup', form({ email: 'not-an-email' })),
  );
  assert.equal(resp.status, 422, 'failed action re-renders with 422');
  assert.ok((resp.headers.get('content-type') || '').includes('text/html'));
  const body = await resp.text();
  assert.match(body, /Enter a valid email/, 'field error rendered');
  assert.match(body, /value="not-an-email"/, 'submitted value repopulated');
});

test('POST with valid data returns 303 to the PRG target', async () => {
  const appDir = makeApp({ 'app/signup/page.ts': SIGNUP_PAGE });
  const app = await createRequestHandler({ appDir, dev: true });
  await app.warmup();

  const resp = await app.handle(
    new Request('http://x/signup', form({ email: 'a@b.com' })),
  );
  assert.equal(resp.status, 303, 'success PRG-redirects');
  assert.equal(resp.headers.get('location'), '/welcome');
});

test('success result without an explicit redirect PRGs to the page own path', async () => {
  const PAGE = `
import { html } from ${CORE};
export async function action() { return { success: true }; }
export default () => html\`<p>ok</p>\`;
`;
  const appDir = makeApp({ 'app/save/page.ts': PAGE });
  const app = await createRequestHandler({ appDir, dev: true });
  await app.warmup();

  const resp = await app.handle(new Request('http://x/save', form({ x: '1' })));
  assert.equal(resp.status, 303);
  assert.equal(resp.headers.get('location'), '/save');
});

test('COUNTERFACTUAL: a page WITHOUT an action still 404s on POST', async () => {
  const PAGE = `
import { html } from ${CORE};
export default () => html\`<p>read-only</p>\`;
`;
  const appDir = makeApp({ 'app/info/page.ts': PAGE });
  const app = await createRequestHandler({ appDir, dev: true });
  await app.warmup();

  // GET renders fine.
  const get = await app.handle(new Request('http://x/info'));
  assert.equal(get.status, 200);

  // POST falls through to 404 (the gate is action-conditioned).
  const post = await app.handle(new Request('http://x/info', form({ x: '1' })));
  assert.equal(post.status, 404, 'POST to an action-less page must 404');
});

test('action that throws redirect() is honored (307, not PRG 303)', async () => {
  const PAGE = `
import { html, redirect } from ${CORE};
export async function action() { redirect('/login'); }
export default () => html\`<p>x</p>\`;
`;
  const appDir = makeApp({ 'app/gate/page.ts': PAGE });
  const app = await createRequestHandler({ appDir, dev: true });
  await app.warmup();

  const resp = await app.handle(new Request('http://x/gate', form({ x: '1' })));
  assert.equal(resp.status, 307, 'thrown redirect keeps its own status');
  assert.equal(resp.headers.get('location'), '/login');
});

test('action that throws notFound() yields 404', async () => {
  const PAGE = `
import { html, notFound } from ${CORE};
export async function action() { notFound(); }
export default () => html\`<p>x</p>\`;
`;
  const appDir = makeApp({ 'app/missing/page.ts': PAGE });
  const app = await createRequestHandler({ appDir, dev: true });
  await app.warmup();

  const resp = await app.handle(new Request('http://x/missing', form({ x: '1' })));
  assert.equal(resp.status, 404);
});

test('GET render is unchanged: no actionData, status 200', async () => {
  const appDir = makeApp({ 'app/signup/page.ts': SIGNUP_PAGE });
  const app = await createRequestHandler({ appDir, dev: true });
  await app.warmup();

  const resp = await app.handle(new Request('http://x/signup'));
  assert.equal(resp.status, 200);
  const body = await resp.text();
  assert.doesNotMatch(body, /Enter a valid email/, 'no error block on a plain GET');
  assert.match(body, /value=""/, 'empty input on a plain GET');
});

test('segment middleware wraps the page action', async () => {
  // A per-segment middleware that short-circuits before the action runs proves
  // the action path is wrapped in the same middleware as the page render.
  const PAGE = `
import { html } from ${CORE};
export async function action() { return { success: true }; }
export default () => html\`<p>x</p>\`;
`;
  const MW = `
export default async function (req, next) {
  return new Response('blocked', { status: 401 });
}
`;
  const appDir = makeApp({
    'app/admin/page.ts': PAGE,
    'app/admin/middleware.ts': MW,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  await app.warmup();

  const resp = await app.handle(new Request('http://x/admin', form({ x: '1' })));
  assert.equal(resp.status, 401, 'segment middleware runs before the action');
  assert.equal(await resp.text(), 'blocked');
});
