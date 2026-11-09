/**
 * `no-next-url`: `request.nextUrl` is Next.js's extended URL, which WebJs does
 * not add to the platform Request (it throws in dev). The rule catches it at
 * edit time without flagging an app's own `nextUrl` field.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { checkConventions } from '../../src/check.js';

function app(files) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-next-url-'));
  for (const [rel, body] of Object.entries({ 'package.json': '{"name":"n","type":"module"}', ...files })) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}

const hits = async (dir) => (await checkConventions(dir)).filter((v) => v.rule === 'no-next-url').map((v) => v.file).sort();

test('flags request.nextUrl in a route handler and any .nextUrl in middleware', async () => {
  const dir = app({
    'app/api/x/route.js': 'export function GET(request) { return Response.json(request.nextUrl.searchParams); }\n',
    'middleware.js': 'export default (r, next) => r.nextUrl.pathname === "/a" ? new Response("a") : next();\n',
  });
  try {
    assert.deepEqual(await hits(dir), ['app/api/x/route.js', 'middleware.js']);
    const v = (await checkConventions(dir)).find((x) => x.rule === 'no-next-url');
    assert.match(v.fix, /new URL\(request\.url\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("leaves an app's own nextUrl field and a mention in a comment or string alone", async () => {
  const dir = app({
    'modules/feed/load.js': 'export async function load(res) { const page = await res.json(); return page.nextUrl; }\n',
    'app/api/y/route.js': '// request.nextUrl is Next only\nexport function GET() { return Response.json({ note: "request.nextUrl" }); }\n',
  });
  try {
    assert.deepEqual(await hits(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
