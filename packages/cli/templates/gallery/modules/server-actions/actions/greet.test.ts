// Example node test for the documented test helpers (from @webjsdev/server).
// Run it with node --test (or webjs test after moving it under test/). The
// handle() harness drives the FULL request pipeline: createRequestHandler({
// appDir }) builds it, and rawActionRequest() fires a 'use server' action
// through it (CSRF + the rich serializer included), returning the raw Response.
// buildRouteTable(appDir) parses the file router; matchPage / matchApi resolve a
// URL against it, params included. See the testing docs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequestHandler, buildRouteTable, matchPage, matchApi, rawActionRequest } from '@webjsdev/server';

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
