/**
 * App layout problems (app-layout.js) refuse to boot in production and answer
 * every dev request with the problem until an edit fixes it. Also drives a
 * route.ts control-flow throw through the full handler, so the redirect is
 * answered by handleApi rather than reaching the error funnel.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import { buildRouteTable } from '../../src/router.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

function app(files) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-layout-'));
  writeFileSync(join(dir, 'package.json'), '{"name":"x","type":"module"}');
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}

const conflicting = {
  'app/x/page.js': `export default () => 'page';\n`,
  'app/x/route.js': `export function GET() { return new Response('route'); }\n`,
};

test('buildRouteTable records a page and a route at the same URL', async () => {
  const dir = app(conflicting);
  try {
    const t = await buildRouteTable(dir);
    assert.equal(t.conflicts.length, 1);
    assert.equal(t.conflicts[0].url, '/x');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('production refuses to boot on a page/route conflict', async () => {
  const dir = app(conflicting);
  try {
    await assert.rejects(
      () => createRequestHandler({ appDir: dir, dev: false, logger: quiet }),
      (e) => e.code === 'WEBJS_APP_LAYOUT' && /no-page-route-conflict/.test(e.message),
    );
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('dev answers each request with the problem and reports it to the overlay', async () => {
  const dir = app(conflicting);
  try {
    const frames = [];
    const h = await createRequestHandler({ appDir: dir, dev: true, logger: quiet, onDevError: (f) => frames.push(f) });
    const r = await h.handle(new Request('http://x/anything'));
    assert.equal(r.status, 500);
    assert.match(await r.text(), /no-page-route-conflict.*app\/x\/page\.js/);
    assert.ok(frames.some((f) => /no-page-route-conflict/.test(f.message)), 'an overlay frame was pushed');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a redirect() in route.ts answers 307 through the full handler, never an onError report', async () => {
  const dir = app({
    'app/go/route.js': `import { redirect, notFound } from ${JSON.stringify(CORE)};\n` +
      `export function GET(req) { if (new URL(req.url).searchParams.has('nf')) notFound(); redirect('/dest'); }\n`,
  });
  try {
    const reported = [];
    const h = await createRequestHandler({ appDir: dir, dev: false, logger: quiet, onError: (e) => reported.push(e) });
    const r = await h.handle(new Request('http://x/go'));
    assert.equal(r.status, 307);
    assert.equal(r.headers.get('location'), '/dest');
    const nf = await h.handle(new Request('http://x/go?nf=1'));
    assert.equal(nf.status, 404);
    assert.equal(reported.length, 0, 'control flow is not an error');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
