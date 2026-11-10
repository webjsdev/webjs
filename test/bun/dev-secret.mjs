/**
 * Cross-runtime proof for the generated development secret (#1686): an app
 * whose root middleware is `session()` and that sets no `SESSION_SECRET` (a
 * fresh clone or a worktree, where `.env` is absent) still answers in dev,
 * signing its cookie with a secret generated into `.webjs/dev-secret` and read
 * back on the next boot. Run from the repo root under either runtime:
 *
 *   node test/bun/dev-secret.mjs
 *   bun  test/bun/dev-secret.mjs
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createRequestHandler } from '@webjsdev/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const here = dirname(fileURLToPath(import.meta.url));
const SERVER = JSON.stringify(pathToFileURL(resolve(here, '../../packages/server/index.js')).toString());
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-secret-'));
const w = (rel, body) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), body); };
const prevCwd = process.cwd();
const saved = { SESSION_SECRET: process.env.SESSION_SECRET, NODE_ENV: process.env.NODE_ENV };
try {
  delete process.env.SESSION_SECRET;
  // `webjs dev` sets this when it is unset; NODE_ENV alone opts a process in.
  process.env.NODE_ENV = 'development';
  w('package.json', JSON.stringify({ name: 'dev-secret', type: 'module' }));
  w('middleware.js', `import { session } from ${SERVER};\nexport default session();\n`);
  w('app/api/visit/route.js',
    `import { getSession } from ${SERVER};\n`
    + `export async function GET() { getSession().set('seen', true); return Response.json({ ok: true }); }\n`);
  process.chdir(dir);

  const app = await createRequestHandler({ appDir: dir, dev: true, logger: quiet });
  const res = await app.handle(new Request('http://localhost/api/visit'));
  assert.equal(res.status, 200, 'the session-backed route answers with no SESSION_SECRET set');
  assert.match(res.headers.get('set-cookie') || '', /webjs\.sid=/, 'the cookie is signed and set');
  const secret = readFileSync(join(dir, '.webjs', 'dev-secret'), 'utf8').trim();
  assert.match(secret, /^[0-9a-f]{64}$/, 'the generated secret is kept for the next boot');

  console.log(`dev secret: ok on ${runtime}`);
} finally {
  process.chdir(prevCwd);
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  rmSync(dir, { recursive: true, force: true });
}
