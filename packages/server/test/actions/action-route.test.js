/**
 * The optional `route()` REST adapter (#488): wraps a plain `'use server'`
 * action as a `route.ts`-style handler. Unit-level coverage drives the handler
 * directly with a fabricated Request (no app boot needed; the adapter is pure
 * over (action, opts) -> (req, ctx) -> Response).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route } from '../../src/action-route.js';

test('GET maps the query string into the action input and JSON-responds', async () => {
  const action = async (input) => ({ got: input });
  const handler = route(action);
  const res = await handler(new Request('http://x/api/echo?name=ada&n=1'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { got: { name: 'ada', n: '1' } });
});

test('route params merge into the input', async () => {
  const action = async (input) => ({ id: input.id, q: input.q });
  const handler = route(action);
  const res = await handler(new Request('http://x/api/posts/42?q=hi'), { params: { id: '42' } });
  assert.deepEqual(await res.json(), { id: '42', q: 'hi' });
});

test('POST merges the JSON body on top of query + params (body wins)', async () => {
  const action = async (input) => input;
  const handler = route(action);
  const res = await handler(
    new Request('http://x/api/posts?title=fromquery', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'frombody', body: 'hello' }),
    }),
    { params: { kind: 'note' } },
  );
  assert.deepEqual(await res.json(), { title: 'frombody', kind: 'note', body: 'hello' });
});

test('a non-object JSON body becomes { body: parsed }', async () => {
  const action = async (input) => input;
  const handler = route(action);
  const res = await handler(
    new Request('http://x/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([1, 2, 3]),
    }),
  );
  assert.deepEqual(await res.json(), { body: [1, 2, 3] });
});

test('invalid JSON is a 400', async () => {
  const handler = route(async (i) => i);
  const res = await handler(
    new Request('http://x/api/x', { method: 'POST', body: '{not json' }),
  );
  assert.equal(res.status, 400);
});

test('a structured validator failure yields a 422 JSON', async () => {
  let ran = false;
  const action = async () => { ran = true; return { success: true }; };
  const handler = route(action, {
    validate: (input) => (input.title ? { success: true } : { success: false, fieldErrors: { title: 'required' } }),
  });
  const res = await handler(new Request('http://x/api/posts', { method: 'POST' }));
  assert.equal(res.status, 422);
  assert.deepEqual(await res.json(), { success: false, fieldErrors: { title: 'required' } });
  assert.equal(ran, false, 'the action must not run on a validation failure');
});

test('a thrown validator yields a 400 keeping a schema lib issues array', async () => {
  const handler = route(async (i) => i, {
    validate: () => { const e = new Error('bad'); /** @type any */ (e).issues = [{ path: ['x'] }]; throw e; },
  });
  const res = await handler(new Request('http://x/api/x?a=1'));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'bad');
  assert.deepEqual(body.issues, [{ path: ['x'] }]);
});

test('a validator transform-return replaces the input', async () => {
  const action = async (input) => input;
  const handler = route(action, { validate: (input) => ({ ...input, coerced: true }) });
  const res = await handler(new Request('http://x/api/x?a=1'));
  assert.deepEqual(await res.json(), { a: '1', coerced: true });
});

test('a returned Response passes through verbatim', async () => {
  const action = async () => new Response('raw', { status: 201, headers: { 'x-custom': 'y' } });
  const handler = route(action);
  const res = await handler(new Request('http://x/api/x?a=1'));
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('x-custom'), 'y');
  assert.equal(await res.text(), 'raw');
});

test('a middleware short-circuit with a numeric status maps to the HTTP status', async () => {
  let ran = false;
  const action = async () => { ran = true; return { success: true }; };
  const deny = async () => ({ success: false, error: 'nope', status: 404 });
  const handler = route(action, { middleware: [deny] });
  const res = await handler(new Request('http://x/api/x?a=1'));
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { success: false, error: 'nope' });
  assert.equal(ran, false, 'a short-circuit must not run the action');
});

test('middleware runs around the action when it calls next', async () => {
  const order = [];
  const mw = async (ctx, next) => { order.push('in'); const r = await next(); order.push('out'); return r; };
  const action = async () => { order.push('fn'); return { ok: true }; };
  const handler = route(action, { middleware: [mw] });
  const res = await handler(new Request('http://x/api/x?a=1'));
  assert.deepEqual(await res.json(), { ok: true });
  assert.deepEqual(order, ['in', 'fn', 'out']);
});

test('the action receives the request + params as its second arg', async () => {
  let seen;
  const action = async (input, ctx) => { seen = { method: ctx.req.method, params: ctx.params }; return { ok: true }; };
  const handler = route(action);
  await handler(new Request('http://x/api/x?a=1', { method: 'GET' }), { params: { id: '9' } });
  assert.deepEqual(seen, { method: 'GET', params: { id: '9' } });
});

test('a validator transform-return reaches the action body (REST boundary, #245)', async () => {
  // The REST boundary runs the validator like the RPC boundary does, so a
  // transformed/coerced value (not the raw merged input) is what the action sees.
  let received;
  const action = async (input) => { received = input; return { ok: true }; };
  const handler = route(action, { validate: (i) => ({ ...i, coerced: true }) });
  await handler(new Request('http://x/api/x?a=1', { method: 'GET' }));
  assert.deepEqual(received, { a: '1', coerced: true });
});

// --- Module-namespace form: auto-apply the action's declared config (#876) ---

test('route(module) applies the action-declared middleware (short-circuit)', async () => {
  let ran = false;
  // A module namespace: one action function + a declared `export const middleware`.
  const mod = {
    middleware: [async () => ({ success: false, error: 'mw-blocked', status: 403 })],
    async guarded() { ran = true; return { success: true }; },
  };
  const handler = route(mod);
  const res = await handler(new Request('http://x/api/x?a=1', { method: 'POST' }));
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { success: false, error: 'mw-blocked' });
  assert.equal(ran, false, 'declared middleware must gate the route boundary too');
});

test('COUNTERFACTUAL: route(fn) without opts does NOT apply the declared middleware', async () => {
  // Passing the bare function (not the module) cannot see sibling config, so the
  // body runs. This is the exact gap #876 fixes for the module form.
  let ran = false;
  const mod = {
    middleware: [async () => ({ success: false, error: 'mw-blocked', status: 403 })],
    async guarded() { ran = true; return { success: true }; },
  };
  const handler = route(mod.guarded);
  const res = await handler(new Request('http://x/api/x?a=1', { method: 'POST' }));
  assert.equal(res.status, 200);
  assert.equal(ran, true, 'the bare-function form has no access to declared middleware');
});

test('route(module) applies the action-declared validate', async () => {
  const mod = {
    validate: (input) => (input.title ? { success: true } : { success: false, fieldErrors: { title: 'required' } }),
    async createPost(input) { return { made: input.title }; },
  };
  const handler = route(mod);
  const bad = await handler(new Request('http://x/api/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
  assert.equal(bad.status, 422);
  const ok = await handler(new Request('http://x/api/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'hi' }) }));
  assert.deepEqual(await ok.json(), { made: 'hi' });
});

test('explicit opts override the module-declared config', async () => {
  const mod = {
    middleware: [async () => ({ success: false, error: 'declared', status: 403 })],
    async guarded() { return { success: true, from: 'body' }; },
  };
  // Passing an empty middleware array explicitly overrides the declared one.
  const handler = route(mod, { middleware: [] });
  const res = await handler(new Request('http://x/api/x?a=1', { method: 'POST' }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { success: true, from: 'body' });
});

test('route(module) with more than one action function throws', () => {
  const mod = { async a() {}, async b() {} };
  assert.throws(() => route(mod), /exactly one action function/);
});
