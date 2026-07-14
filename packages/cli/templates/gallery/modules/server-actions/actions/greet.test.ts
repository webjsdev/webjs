// Example node test for the documented test helpers (from @webjsdev/server).
// Run it with node --test (or webjs test after moving it under test/). The
// handle() harness drives the FULL request pipeline: createRequestHandler({
// appDir }) builds it, and rawActionRequest() fires a 'use server' action
// through it (CSRF + the rich serializer included), returning the raw Response.
// buildRouteTable(appDir) parses the file router; matchPage / matchApi resolve a
// URL against it, params included. See the testing docs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequestHandler, buildRouteTable, matchPage, matchApi, rawActionRequest, invokeActionForTest } from '@webjsdev/server';

const appDir = process.cwd();

test('buildRouteTable + matchPage resolve a dynamic route with its params', async () => {
  const table = await buildRouteTable(appDir);
  const m = matchPage(table, '/features/routing/42');
  assert.ok(m, 'the [id] route matches');
  assert.equal(m.params.id, '42');
});

test('matchApi resolves the route-handler endpoint', async () => {
  const table = await buildRouteTable(appDir);
  const m = matchApi(table, '/features/route-handler/data');
  assert.ok(m, 'the route.ts endpoint matches');
});

test('rawActionRequest fires the greet action through the pipeline', async () => {
  const app = await createRequestHandler({ appDir, dev: true });
  if (app.warmup) await app.warmup();
  const res = await rawActionRequest(
    app,
    'modules/server-actions/actions/greet.server.ts',
    'greet',
    [{ name: 'Ada' }],
  );
  assert.equal(res.status, 200);
});

test('the middleware sets the caller on the context and greet reads it via actionContext()', async () => {
  const app = await createRequestHandler({ appDir, dev: true });
  if (app.warmup) await app.warmup();
  // invokeActionForTest returns the deserialized result as unknown; cast to the
  // action's ActionResult shape to read it.
  const r = (await invokeActionForTest(
    app,
    'modules/server-actions/actions/greet.server.ts',
    'greet',
    [{ name: 'Bob' }],
  )) as { success: boolean; data?: { message: string }; error?: string; status?: number };
  assert.equal(r.success, true);
  // The message carries BOTH the input (Bob) and the middleware-set caller (Ada).
  assert.match(r.data?.message ?? '', /BOB/);
  assert.match(r.data?.message ?? '', /Ada/);
});

test('the auth middleware short-circuits a signed-out request before greet runs', async () => {
  const app = await createRequestHandler({ appDir, dev: true });
  if (app.warmup) await app.warmup();
  // A middleware short-circuit rides as a normal failure envelope (200 with the
  // status inside), so read the result rather than expecting a thrown non-2xx.
  const r = (await invokeActionForTest(
    app,
    'modules/server-actions/actions/greet.server.ts',
    'greet',
    [{ name: 'Bob', signedOut: true }],
    { throwOnError: false },
  )) as { success: boolean; data?: { message: string }; error?: string; status?: number };
  assert.equal(r.success, false);
  assert.equal(r.status, 401);
});
