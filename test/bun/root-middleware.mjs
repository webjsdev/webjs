/**
 * Cross-runtime proof that a root `middleware.ts` is resolved AND runs on
 * both Node and Bun. WebJs runs on Node 24+ OR Bun, and this touches two
 * runtime-sensitive surfaces at once: the module-load path (a bare
 * `import()` of a `.ts` file, stripped by Node 24+'s built-in stripper or by
 * amaro on Bun) and the request dispatch that invokes the middleware. Run
 * from the repo root:
 *
 *   node test/bun/root-middleware.mjs
 *   bun  test/bun/root-middleware.mjs
 *
 * Asserts, on whichever runtime executes it: a root middleware.ts short-
 * circuits the request, and a root middleware.ts that calls next() can
 * post-process the page response.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../../packages/server/src/dev.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpdir(), 'webjs-root-mw-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

const PAGE = `export default function Home() { return 'home'; }\n`;

// A root middleware.ts that short-circuits. Typed params, so the file is
// genuinely TypeScript and has to go through each runtime's stripper.
{
  const appDir = makeApp({
    'app/page.js': PAGE,
    'middleware.ts': [
      'export default async function mw(req: Request, next: () => Promise<Response>): Promise<Response> {',
      "  return new Response('short-circuited');",
      '}',
      '',
    ].join('\n'),
  });

  const h = await createRequestHandler({ appDir, dev: false });
  await h.warmup?.();
  const res = await h.handle(new Request('http://localhost/'));
  assert.equal(await res.text(), 'short-circuited', `root middleware.ts did not run on ${runtime}`);
}

// A root middleware.ts that post-processes the real page response.
{
  const appDir = makeApp({
    'app/page.js': PAGE,
    'middleware.ts': [
      'export default async function mw(req: Request, next: () => Promise<Response>): Promise<Response> {',
      '  const res = await next();',
      "  res.headers.set('x-mw', 'ran');",
      '  return res;',
      '}',
      '',
    ].join('\n'),
  });

  const h = await createRequestHandler({ appDir, dev: false });
  await h.warmup?.();
  const res = await h.handle(new Request('http://localhost/'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-mw'), 'ran', `root middleware.ts post-process did not run on ${runtime}`);
}

// Next.js conventions: a proxy.ts with a named `proxy` export, a matcher, and
// returning undefined to continue (URLPattern + the TS strip, runtime-sensitive).
{
  const appDir = makeApp({
    'package.json': '{"name":"x","type":"module"}',
    'app/page.js': PAGE,
    'app/admin/page.js': PAGE,
    'proxy.ts': [
      'export function proxy(req: Request): Response | undefined {',
      "  if (new URL(req.url).pathname.startsWith('/admin')) return new Response('nope', { status: 403 });",
      '}',
      "export const config = { matcher: ['/admin/:path*', '/'] };",
      '',
    ].join('\n'),
  });
  const h = await createRequestHandler({ appDir, dev: false });
  assert.equal((await h.handle(new Request('http://localhost/admin/'))).status, 403, `proxy matcher on ${runtime}`);
  assert.equal((await h.handle(new Request('http://localhost/'))).status, 200, `undefined continues on ${runtime}`);
}

// A root middleware that cannot load fails CLOSED.
{
  const appDir = makeApp({ 'package.json': '{"name":"x","type":"module"}', 'app/page.js': PAGE, 'middleware.js': 'this is not js !!!' });
  const h = await createRequestHandler({ appDir, dev: false, logger: { info() {}, warn() {}, error() {} } });
  assert.equal((await h.handle(new Request('http://localhost/'))).status, 500, `fail closed on ${runtime}`);
}

console.log(`root middleware.ts resolution OK on ${runtime}`);
