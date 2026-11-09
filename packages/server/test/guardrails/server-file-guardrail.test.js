/**
 * Server-file guardrail: the dev/prod HTTP layer MUST never serve the
 * source of a server-only file to the browser. A file is server-only
 * when its filename matches `.server.{js,ts,mjs,mts}`. The extension
 * is the path-level boundary; the file router refuses to serve the
 * source regardless of whether the file has a `'use server'` directive.
 *
 * Two distinct stubs cover the two cases:
 *   • `.server.ts` WITH `'use server'` (a server action) returns a
 *     generated RPC stub whose exports POST to /__webjs/action/...
 *   • `.server.ts` WITHOUT `'use server'` (a server-only utility)
 *     returns a throw-at-load stub: import-side code immediately
 *     errors with a message explaining the file is server-only.
 *
 * The `'use server'` directive WITHOUT the `.server.ts` extension is
 * silently ignored (a `webjs check` lint rule flags it instead) and
 * the file serves to the browser as plain TS source.
 *
 * This guardrail is the last line of defense against an accidental
 * source leak (DB credentials, privileged business logic, scrypt
 * routines, etc.).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';

let tmpDir;

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'webjs-guard-'));
});

after(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpDir, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

/**
 * The importer every fixture uses: a registered component, whose module the
 * browser loads, plus a page rendering it. A page never loads in the browser
 * (#1686), so a module only a page imports is not servable at all; the stub
 * guardrail is reached through what a component imports.
 */
function viaComponent(importLine, use) {
  return {
    'app/page.ts': `import '../components/importer.ts';\nexport default function P() { return '<x-importer></x-importer>'; }\n`,
    'components/importer.ts':
      `import { WebComponent } from '@webjsdev/core';\n${importLine}\n` +
      `class Importer extends WebComponent { get used() { return ${use}; } }\n` +
      `Importer.register('x-importer');\n`,
  };
}

function assertIsRpcStub(text) {
  assert.ok(
    text.startsWith('// webjs: generated server-action stub'),
    `expected RPC stub, got body starting with: ${text.slice(0, 80)}`
  );
  assertNoSourceLeak(text);
}

function assertIsServerOnlyStub(text) {
  assert.ok(
    text.startsWith('// webjs: server-only module stub'),
    `expected server-only throw-at-load stub, got body starting with: ${text.slice(0, 80)}`
  );
  assert.ok(/throw new Error/.test(text), 'server-only stub must throw on import');
  // #263: the throw-at-load message anchors a stable, fetchable docs URL.
  assert.ok(
    text.includes('https://webjs.dev/docs/server-actions'),
    'server-only stub message must anchor a docs URL'
  );
  assertNoSourceLeak(text);
}

function assertNoSourceLeak(text) {
  // Confirm the real source is NOT present by checking secrets markers
  // that only show up in the scaffolded fixture source.
  assert.ok(!/SECRET_DB_PASSWORD/.test(text),
    `stub leaked the source: found SECRET_DB_PASSWORD:\n${text.slice(0, 400)}`);
  assert.ok(!/fakeDbClient/.test(text),
    `stub leaked the source: found fakeDbClient reference`);
}

test(`guardrail: .server.ts with 'use server' returns RPC stub, never source`, async () => {
  const appDir = makeApp({
    ...viaComponent(`import { listPosts } from '../modules/posts/queries/list-posts.server.ts';`, 'listPosts'),
    'modules/posts/queries/list-posts.server.ts':
      `'use server';\n` +
      `const SECRET_DB_PASSWORD = 'hunter2';\n` +
      `const fakeDbClient = () => ({ findMany: () => [] });\n` +
      `export async function listPosts() { return []; }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request(
    'http://localhost/modules/posts/queries/list-posts.server.ts'
  ));
  assert.equal(resp.status, 200);
  assert.equal(
    resp.headers.get('content-type'),
    'application/javascript; charset=utf-8'
  );
  assertIsRpcStub(await resp.text());
});

test(`guardrail: .server.ts without 'use server' returns throw-at-load stub`, async () => {
  const appDir = makeApp({
    ...viaComponent(`import { db } from '../lib/db.server.ts';`, 'db'),
    'lib/db.server.ts':
      `const SECRET_DB_PASSWORD = 'hunter2';\n` +
      `const fakeDbClient = () => ({ findMany: () => [] });\n` +
      `export const db = fakeDbClient();\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request(
    'http://localhost/lib/db.server.ts'
  ));
  assert.equal(resp.status, 200);
  const text = await resp.text();
  assertIsServerOnlyStub(text);
  assert.ok(/server-only/.test(text), 'stub mentions server-only in the error');
});

test(`guardrail: 'use server' WITHOUT .server.ts is NOT source-protected (lint rule covers it)`, async () => {
  // Under the two-marker convention, a 'use server' directive without
  // the .server.{js,ts} extension is silently ignored. The file serves
  // to the browser as plain TS source. The `use-server-needs-extension`
  // lint rule flags it at check time.
  const appDir = makeApp({
    ...viaComponent(`import { greeting } from '../lib/loose.ts';`, 'greeting'),
    'lib/loose.ts':
      `'use server';\n` +
      `export const greeting = 'hi from loose.ts';\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://localhost/lib/loose.ts'));
  assert.equal(resp.status, 200);
  const text = await resp.text();
  // Source IS served (no stub). The 'use server' string sits as a
  // no-op string literal at the top of an otherwise-normal module.
  assert.ok(!text.startsWith('// webjs: generated server-action stub'),
    'plain .ts with bare directive should NOT be RPC-stubbed');
  assert.ok(!text.startsWith('// webjs: server-only module stub'),
    'plain .ts with bare directive should NOT be server-only-stubbed');
  assert.ok(/greeting/.test(text), 'the actual source is served');
});

test('guardrail: .server.js request returns throw-at-load stub when no directive', async () => {
  const appDir = makeApp({
    ...viaComponent(`import { doWork } from '../lib/util.server.js';`, 'doWork'),
    'lib/util.server.js':
      `const SECRET_DB_PASSWORD = 'hunter2';\n` +
      `export function doWork() { return 1; }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request(
    'http://localhost/lib/util.server.js'
  ));
  assert.equal(resp.status, 200);
  assertIsServerOnlyStub(await resp.text());
});

test('guardrail: ordinary .ts files still serve source (negative control)', async () => {
  const appDir = makeApp({
    ...viaComponent(`import { hello } from '../components/widget.ts';`, 'hello'),
    'components/widget.ts':
      `export function hello() { return 'hi'; }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request(
    'http://localhost/components/widget.ts'
  ));
  assert.equal(resp.status, 200);
  const text = await resp.text();
  // Non-server .ts files are compiled (TS stripped) and served as JS.
  assert.ok(!text.startsWith('// webjs: generated server-action stub'),
    'ordinary .ts should NOT be stubbed');
  assert.ok(/function hello/.test(text),
    'ordinary .ts source should be present');
});

test('guardrail: file created AFTER boot is still caught (index race)', async () => {
  // Simulates the race window: the action index is built at boot, but a
  // developer adds a new .server.ts during dev. The guardrail must catch
  // it on first request regardless of index state. The new file has
  // 'use server' so it's a server action; the response is the RPC stub.
  //
  // A component already imports the path so it's in the browser-bound graph
  // (the module-graph resolver records the resolved path even when the
  // file doesn't exist yet at boot time). The membership gate then
  // passes through to the guardrail, which catches the late-created
  // file by re-reading its `'use server'` directive at request time.
  const appDir = makeApp({
    ...viaComponent(`import { late } from '../modules/late.server.ts';`, 'late'),
  });
  const app = await createRequestHandler({ appDir, dev: true });

  // Write the server file AFTER createRequestHandler returned.
  const lateFile = join(appDir, 'modules/late.server.ts');
  mkdirSync(join(lateFile, '..'), { recursive: true });
  writeFileSync(lateFile,
    `'use server';\n` +
    `const SECRET_DB_PASSWORD = 'hunter2';\n` +
    `export async function late() { return 42; }\n`);

  const resp = await app.handle(new Request(
    'http://localhost/modules/late.server.ts'
  ));
  assert.equal(resp.status, 200);
  assertIsRpcStub(await resp.text());
});

test('guardrail: a .server file only a page imports is not servable, one a component imports gets its stub (#1686)', async () => {
  // A page runs only on the server, so nothing it imports is browser-bound:
  // the request 404s before the guardrail is even reached, and no stub (nor
  // any source) leaves. The same kind of file imported by a component is
  // browser-bound and gets its stub as before.
  const appDir = makeApp({
    'app/page.ts':
      `import { db } from '../lib/page-only.server.ts';\n` +
      `import '../components/importer.ts';\n` +
      `export default function P() { return db; }\n`,
    'lib/page-only.server.ts':
      `const SECRET_DB_PASSWORD = 'hunter2';\n` +
      `export const db = 1;\n`,
    'components/importer.ts':
      `import { WebComponent } from '@webjsdev/core';\n` +
      `import { util } from '../lib/shared.server.ts';\n` +
      `class Importer extends WebComponent { get used() { return util; } }\n` +
      `Importer.register('x-importer');\n`,
    'lib/shared.server.ts':
      `const SECRET_DB_PASSWORD = 'hunter2';\n` +
      `export const util = 1;\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const pageOnly = await app.handle(new Request('http://localhost/lib/page-only.server.ts'));
  assert.equal(pageOnly.status, 404, 'a server file only a page imports is not browser-bound');
  assertNoSourceLeak(await pageOnly.text());
  const shared = await app.handle(new Request('http://localhost/lib/shared.server.ts'));
  assert.equal(shared.status, 200);
  assertIsServerOnlyStub(await shared.text());
  assert.equal((await app.handle(new Request('http://localhost/app/page.ts'))).status, 404,
    'and the page itself is never served');
});
