/**
 * Cross-runtime proof for the muscle-memory corpus (test/muscle-memory/). Run
 * from the repo root:
 *
 *   node test/bun/muscle-memory.mjs
 *   bun  test/bun/muscle-memory.mjs
 *
 * The corpus is TypeScript, stripped by Node's built-in stripper or by amaro on
 * Bun, and its refusals depend on how each runtime fails a module: Node rejects
 * a decorator with a bare SyntaxError while Bun runs legacy decorators and
 * throws a ReferenceError for the undefined decorator, and the two word a
 * missing export differently. So on whichever runtime executes it, this asserts
 * the Lit-idiom page renders the same markers and every dev-time refusal still
 * names its fix.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequestHandler } from '../../packages/server/src/dev.js';
import { REFUSED, caseFiles } from '../muscle-memory/refused-cases.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

// The works half renders identically.
{
  const h = await createRequestHandler({ appDir: join(ROOT, 'test/muscle-memory/works'), dev: false, logger: quiet });
  await h.warmup?.();
  const res = await h.handle(new Request('http://localhost/'));
  assert.equal(res.status, 200, `${runtime}: the corpus page renders`);
  const html = await res.text();
  for (const needle of [
    '<button >Count: 3</button>',
    'shadowrootmode="open" shadowrootdelegatesfocus',
    'h2 { color: rgb(255, 0, 0); }',
    '<p>Light root</p>',
    '<p>Waiting</p>',
    '<li>apple</li><li>pear</li>',
    'APPLE, PEAR',
    '<p>HELLO!</p>',
    '<button >Clicks: 0</button>',
  ]) {
    assert.ok(html.includes(needle), `${runtime}: the corpus render contains ${JSON.stringify(needle)}`);
  }
}

// The Next.js half behaves the same: middleware, cookies(), route handlers,
// env files (Bun's own .env loading must not win over Next's order), public/.
{
  const app = join(ROOT, 'test/muscle-memory/works');
  writeFileSync(join(app, '.env'), 'MM_GREETING=from-env\n');
  writeFileSync(join(app, '.env.local'), 'MM_GREETING=from-env-local\n');
  try {
    const h = await createRequestHandler({ appDir: app, dev: false, logger: quiet });
    await h.warmup?.();
    const go = (path, init = {}) => h.handle(new Request('http://localhost' + path, { redirect: 'manual', ...init }));
    assert.equal((await go('/admin')).status, 307, `${runtime}: middleware redirects without a session`);
    assert.equal((await go('/admin', { headers: { cookie: 'session=abc' } })).status, 200, `${runtime}: middleware continues`);
    assert.match(await (await go('/login', { headers: { cookie: 'session=abc' } })).text(), /Session: abc/, `${runtime}: cookies().get()?.value`);
    const set = await go('/api/session', { method: 'POST', headers: { origin: 'http://localhost', 'sec-fetch-site': 'same-origin' } });
    assert.match(set.headers.get('set-cookie') || '', /^session=abc;/, `${runtime}: cookies().set()`);
    assert.equal((await go('/api/items/2')).status, 404, `${runtime}: notFound() in a route handler`);
    assert.equal((await go('/api/items/first')).status, 307, `${runtime}: redirect() in a route handler`);
    assert.match(await (await go('/docs/a/b')).text(), /Path: a \/ b/, `${runtime}: catch-all arrays`);
    // Next's order skips .env.local in test mode (NODE_ENV=test, set by `bun test`).
    const expected = process.env.NODE_ENV === 'test' ? /Greeting: from-env</ : /Greeting: from-env-local/;
    assert.match(await (await go('/greeting')).text(), expected, `${runtime}: env files load in Next's order`);
    assert.equal((await go('/logo.svg')).status, 200, `${runtime}: public/ at the root`);
  } finally {
    rmSync(join(app, '.env'), { force: true });
    rmSync(join(app, '.env.local'), { force: true });
  }
}

// Every dev-time refusal names its fix.
for (const c of REFUSED.filter((x) => x.load && !(process.versions.bun && x.serverLoadsOnBun))) {
  const appDir = mkdtempSync(join(tmpdir(), `webjs-bun-refused-${c.id}-`));
  try {
    const files = caseFiles(c);
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(dirname(join(appDir, rel)), { recursive: true });
      writeFileSync(join(appDir, rel), body);
    }
    symlinkSync(join(ROOT, 'node_modules'), join(appDir, 'node_modules'));

    const logged = [];
    const sink = (...args) => logged.push(args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    const saved = { error: console.error, warn: console.warn, log: console.log };
    console.error = sink; console.warn = sink; console.log = () => {};
    let text;
    try {
      const h = await createRequestHandler({ appDir, dev: true, logger: { info() {}, debug() {}, warn: sink, error: sink } });
      await h.warmup?.();
      const body = await (await h.handle(new Request('http://localhost' + c.load.path))).text();
      const status = await (await h.handle(new Request('http://localhost/__webjs/dev/status'))).text();
      text = `${body}\n${status}\n${logged.join('\n')}`;
    } finally {
      Object.assign(console, saved);
    }
    assert.match(text, c.load.match, `${runtime}: ${c.idiom} names its fix`);
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
}

console.log(`muscle-memory: ok on ${runtime}`);
