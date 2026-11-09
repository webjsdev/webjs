/**
 * The muscle-memory corpus, "works" half: code written the way an agent trained
 * on Lit and the Next.js App Router writes it (with WebJs imports), which must
 * be clean under `webjs check` and behave as it would in Lit or Next.js with no
 * WebJs-specific adjustment. Each fixture file names the idiom it carries in its header.
 *
 * This file covers the check verdict and the server render. The same components
 * are exercised after hydration in `browser/works.test.js`, where the idioms
 * that only act in the browser (`renderRoot`, a Task resolving, context, a
 * signal write) prove themselves. `test/bun/muscle-memory.mjs` repeats the
 * render on Bun. The refusal half lives in `refused.test.mjs`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkConventions } from '@webjsdev/server/check';
import { createRequestHandler } from '@webjsdev/server';
import { makeEnvApp, EXPECTED_GREETING } from './env-app.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), 'works');
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

test('the corpus is clean under webjs check', async () => {
  const violations = await checkConventions(APP);
  assert.deepEqual(violations.map((v) => `[${v.rule}] ${v.file}: ${v.message}`), []);
});

test('the corpus renders every Lit idiom on the server', async () => {
  const h = await createRequestHandler({ appDir: APP, dev: false, logger: quiet });
  await h.warmup?.();
  const res = await h.handle(new Request('http://localhost/'));
  assert.equal(res.status, 200);
  const html = await res.text();
  const has = (needle, why) => assert.ok(html.includes(needle), `${why}: expected ${JSON.stringify(needle)}`);

  has('<title>Muscle memory</title>', 'static metadata');
  has('<div class="shell">', 'the root layout wraps the page');
  has('<button >Count: 3</button>', '`static properties` with `declare` reads the attribute');
  has('shadowrootmode="open" shadowrootdelegatesfocus', '`static shadowRootOptions` reaches the declarative shadow root');
  has('h2 { color: rgb(255, 0, 0); }', 'composed `static styles` with `unsafeCSS`');
  has('<p>Light root</p>', '`createRenderRoot() { return this; }` renders light DOM');
  has('<p>Waiting</p>', 'a Task renders its initial state on the server');
  has('<span>Theme: none</span>', 'a context consumer renders before any provider answers');
  has('<li>apple</li><li>pear</li>', 'two-argument `repeat`');
  has('APPLE, PEAR', '`join` over `map`');
  has('<b>0</b><b>1</b><b>2</b>', '`range`');
  has('<p>Has fruit</p>', '`when`');
  has('<p>Short mode</p>', '`choose`');
  assert.match(html, /<p class="\s*active\s*">Mode flag<\/p>/, '`classMap`');
  has('<p>HELLO!</p>', 'a custom directive');
  has('<button >Clicks: 0</button>', 'a bare signal in a child hole');
});

test('the corpus behaves the Next.js way on the server', async () => {
  {
    const h = await createRequestHandler({ appDir: APP, dev: false, logger: quiet });
    await h.warmup?.();
    const go = (path, init = {}) => h.handle(new Request('http://localhost' + path, { redirect: 'manual', ...init }));
    const same = { origin: 'http://localhost', 'sec-fetch-site': 'same-origin' };

    // Named `middleware` export with config.matcher and request.cookies.
    const blocked = await go('/admin');
    assert.equal(blocked.status, 307, 'middleware redirects a request without a session');
    assert.match(blocked.headers.get('location') || '', /\/login$/);
    const allowed = await go('/admin', { headers: { cookie: 'session=abc' } });
    assert.equal(allowed.status, 200, 'returning nothing from middleware continues');
    assert.match(await allowed.text(), /Admin area/);
    assert.equal((await go('/greeting')).status, 200, 'the matcher leaves other paths alone');

    // cookies(): Next's shape for reading and writing.
    assert.match(await (await go('/login', { headers: { cookie: 'session=abc' } })).text(), /Session: abc/, '(await cookies()).get(name)?.value');
    const setRes = await go('/api/session', { method: 'POST', headers: same });
    assert.equal(setRes.status, 200);
    assert.match(setRes.headers.get('set-cookie') || '', /^session=abc;.*HttpOnly/, 'cookies().set() writes Set-Cookie');

    // Route handlers: notFound(), redirect(), and HEAD for free.
    assert.deepEqual(await (await go('/api/items/1')).json(), { id: '1', name: 'Widget' });
    assert.equal((await go('/api/items/2')).status, 404, 'notFound() in a route handler is a 404');
    const moved = await go('/api/items/first');
    assert.equal(moved.status, 307, 'redirect() in a route handler is a 307');
    assert.equal(moved.headers.get('location'), '/api/items/1');
    assert.equal((await go('/api/items/1', { method: 'HEAD' })).status, 200, 'HEAD is answered from GET');

    // Pages: catch-all arrays, permanentRedirect, env files, public/ at the root.
    assert.match(await (await go('/docs/a/b')).text(), /Path: a \/ b/, 'a catch-all param is an array');
    const perm = await go('/old-about');
    assert.equal(perm.status, 308, 'permanentRedirect() is a 308');
    const logo = await go('/logo.svg');
    assert.equal(logo.status, 200, 'public/logo.svg is served at /logo.svg');
    assert.match(await logo.text(), /<svg/);

    // A (prevState, formData) action: { errors } re-renders, redirect() is a 303.
    const form = await (await go('/guestbook')).text();
    const ident = /name="__webjs_action" value="([^"]+)"/.exec(form);
    assert.ok(ident, 'the bound form carries the action identity');
    const submit = (name) => go('/guestbook', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...same },
      body: new URLSearchParams({ __webjs_action: ident[1], name }),
    });
    const failed = await submit('');
    assert.equal(failed.status, 422, '{ errors } is a failed result');
    assert.match(await failed.text(), /Name is required/, 'the failed result reaches the page as actionData');
    const ok = await submit('Ada');
    assert.equal(ok.status, 303, 'redirect() after the write answers 303, so the browser GETs the target');
    assert.equal(ok.headers.get('location'), '/guestbook?thanks=1');
  }
});

test('env files load in Next.js order, in an app of their own', async () => {
  const { dir, cleanup } = makeEnvApp();
  try {
    const h = await createRequestHandler({ appDir: dir, dev: false, logger: quiet });
    await h.warmup?.();
    const greeting = await (await h.handle(new Request('http://localhost/greeting'))).text();
    assert.match(greeting, EXPECTED_GREETING(), '.env.local overrides .env (skipped in test mode)');
  } finally {
    cleanup();
  }
});
