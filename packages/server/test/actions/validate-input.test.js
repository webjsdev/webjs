import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildActionIndex,
  resolveServerModule,
  invokeAction,
  invokeExposedAction,
  matchExposedAction,
  runValidate,
  RPC_CONTENT_TYPE,
} from '../../src/actions.js';
import { stringify as wjStringify, parse as wjParse } from '../../../core/src/serialize.js';

// The scaffolded action files import the attacher (`expose` / `validateInput`)
// directly from the core SOURCE entry (not the bare `@webjsdev/core` specifier),
// because the prebuilt `dist/` bundle the bare specifier resolves to in this
// monorepo can be stale (no-build framework). Importing the source guarantees
// the test exercises the CODE UNDER TEST, not a stale published bundle.
const CORE_SRC = fileURLToPath(new URL('../../../core/index.js', import.meta.url));

async function scaffold(files) {
  // Created UNDER the server package's test tree (not /tmp) so the scaffolded
  // modules can resolve relative imports back into the repo if needed; the
  // core import is an absolute file URL, so resolution is location-independent.
  const dir = await mkdtemp(join(fileURLToPath(new URL('.', import.meta.url)), 'tmp-validate-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(dir, rel);
    await mkdir(join(p, '..'), { recursive: true });
    await writeFile(p, body.replaceAll('@webjsdev/core', CORE_SRC));
  }
  return dir;
}

/** Build a CSRF-valid RPC request for invokeAction. */
function rpcReq(hash, fn, args) {
  const tok = 't';
  return new Request('http://x/__webjs/action/' + hash + '/' + fn, {
    method: 'POST',
    headers: { 'content-type': RPC_CONTENT_TYPE, cookie: `webjs_csrf=${tok}`, 'x-webjs-csrf': tok },
    body: args,
  });
}

// --- the pure contract: runValidate's disambiguation rules -------------------

test('runValidate: { success: true, data } passes and substitutes data', () => {
  const r = runValidate((i) => ({ success: true, data: { ...i, coerced: true } }), { a: 1 });
  assert.deepEqual(r, { ok: true, value: { a: 1, coerced: true } });
});

test('runValidate: { success: true } with no data keeps the original input', () => {
  const r = runValidate(() => ({ success: true }), { a: 1 });
  assert.deepEqual(r, { ok: true, value: { a: 1 } });
});

test('runValidate: { success: false, fieldErrors } is a 422 structured failure', () => {
  const r = runValidate(() => ({ success: false, fieldErrors: { title: 'required' } }), {});
  assert.equal(r.ok, false);
  assert.deepEqual(r.result, { success: false, fieldErrors: { title: 'required' }, status: 422 });
});

test('runValidate: { fieldErrors } WITHOUT a literal success is still a failure', () => {
  const r = runValidate(() => ({ fieldErrors: { x: 'bad' }, message: 'nope' }), {});
  assert.equal(r.ok, false);
  assert.equal(r.result.status, 422);
  assert.deepEqual(r.result.fieldErrors, { x: 'bad' });
  assert.equal(r.result.error, 'nope');
});

test('runValidate: a non-envelope return transforms the input (back-compat)', () => {
  // A `validate: Schema.parse` returns the parsed object (no `success` key).
  const r = runValidate((i) => ({ title: String(i.title).trim() }), { title: '  hi ' });
  assert.deepEqual(r, { ok: true, value: { title: 'hi' } });
});

test('runValidate: undefined return keeps the input (no transform)', () => {
  const r = runValidate(() => undefined, { a: 1 });
  assert.deepEqual(r, { ok: true, value: { a: 1 } });
});

test('runValidate: a THROW is a 400 failure carrying the original error', () => {
  const err = new Error('parse failed');
  const r = runValidate(() => { throw err; }, {});
  assert.equal(r.ok, false);
  assert.equal(r.result.status, 400);
  assert.equal(r.result.error, 'parse failed');
  assert.equal(r.thrown, err);
});

// --- RPC-path rejection: structured field errors, body NOT run ---------------

test('RPC path: a failing validator returns fieldErrors and does NOT run the body', async () => {
  const dir = await scaffold({
    'actions/post.server.js': `'use server';
      import { validateInput } from '@webjsdev/core';
      globalThis.__webjs_body_ran = false;
      export const createPost = validateInput(
        async (input) => { globalThis.__webjs_body_ran = true; return { success: true, data: input }; },
        (input) => (input && input.title)
          ? { success: true }
          : { success: false, fieldErrors: { title: 'required' } },
      );
    `,
  });
  try {
    globalThis.__webjs_body_ran = false;
    const idx = await buildActionIndex(dir, true);
    const file = resolveServerModule(idx, '/actions/post.server.js');
    const hash = idx.fileToHash.get(file);
    const res = await invokeAction(idx, hash, 'createPost', rpcReq(hash, 'createPost', await wjStringify([{ title: '' }])));
    assert.equal(res.status, 200, 'a validation failure is a normal 200 RPC result');
    const out = wjParse(await res.text());
    assert.equal(out.success, false);
    assert.deepEqual(out.fieldErrors, { title: 'required' });
    assert.equal(out.status, 422);
    assert.equal(globalThis.__webjs_body_ran, false, 'the action body must NOT run on a validation failure');
  } finally {
    delete globalThis.__webjs_body_ran;
    await rm(dir, { recursive: true, force: true });
  }
});

// --- RPC-path pass-through, with data substitution ---------------------------

test('RPC path: a valid input passes; { success: true, data } substitutes the arg', async () => {
  const dir = await scaffold({
    'actions/post.server.js': `'use server';
      import { validateInput } from '@webjsdev/core';
      export const createPost = validateInput(
        async (input) => ({ success: true, data: input }),
        (input) => ({ success: true, data: { title: String(input.title).trim().toUpperCase() } }),
      );
    `,
  });
  try {
    const idx = await buildActionIndex(dir, true);
    const file = resolveServerModule(idx, '/actions/post.server.js');
    const hash = idx.fileToHash.get(file);
    const res = await invokeAction(idx, hash, 'createPost', rpcReq(hash, 'createPost', await wjStringify([{ title: '  hi ' }])));
    assert.equal(res.status, 200);
    const out = wjParse(await res.text());
    assert.equal(out.success, true);
    assert.equal(out.data.title, 'HI', 'the action received the validator-substituted data');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- both paths share one validator ------------------------------------------

test('one validator runs on BOTH the RPC path and the expose() REST path', async () => {
  const dir = await scaffold({
    'actions/post.server.js': `'use server';
      import { expose } from '@webjsdev/core';
      export const createPost = expose('POST /api/posts', async (input) => ({ success: true, data: input }), {
        validate: (input) => (input && input.title)
          ? { success: true }
          : { success: false, fieldErrors: { title: 'required' } },
      });
    `,
  });
  try {
    const idx = await buildActionIndex(dir, true);
    const file = resolveServerModule(idx, '/actions/post.server.js');
    const hash = idx.fileToHash.get(file);

    // --- RPC path: invalid rejects with fieldErrors ---
    const rpcBad = await invokeAction(idx, hash, 'createPost', rpcReq(hash, 'createPost', await wjStringify([{ title: '' }])));
    const rpcBadOut = wjParse(await rpcBad.text());
    assert.equal(rpcBadOut.success, false);
    assert.deepEqual(rpcBadOut.fieldErrors, { title: 'required' });

    // --- RPC path: valid passes ---
    const rpcOk = await invokeAction(idx, hash, 'createPost', rpcReq(hash, 'createPost', await wjStringify([{ title: 'Hello' }])));
    const rpcOkOut = wjParse(await rpcOk.text());
    assert.equal(rpcOkOut.success, true);
    assert.equal(rpcOkOut.data.title, 'Hello');

    // --- REST path: invalid rejects with a 422 + fieldErrors ---
    const m = matchExposedAction(idx, 'POST', '/api/posts');
    assert.ok(m, 'route matched');
    const restBad = await invokeExposedAction(idx, m.route, m.params, new Request('http://x/api/posts', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: '' }),
    }));
    assert.equal(restBad.status, 422);
    const restBadOut = await restBad.json();
    assert.deepEqual(restBadOut.fieldErrors, { title: 'required' });

    // --- REST path: valid passes ---
    const restOk = await invokeExposedAction(idx, m.route, m.params, new Request('http://x/api/posts', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Hello' }),
    }));
    assert.equal(restOk.status, 200);
    const restOkOut = await restOk.json();
    assert.equal(restOkOut.data.title, 'Hello');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- throw / zod back-compat on both paths -----------------------------------

test('a THROWING validator (Schema.parse style) fails on both paths, sanitized', async () => {
  const dir = await scaffold({
    'actions/strict.server.js': `'use server';
      import { expose } from '@webjsdev/core';
      // A zod/valibot-style parse that throws on bad input, returns the parsed
      // object on good input (the transform contract).
      const parse = (input) => {
        if (!input || typeof input.n !== 'number') {
          const e = new Error('expected a number');
          e.issues = [{ path: ['n'], message: 'expected a number' }];
          throw e;
        }
        return { n: input.n };
      };
      export const compute = expose('POST /api/compute', async (input) => ({ success: true, data: input.n * 2 }), { validate: parse });
    `,
  });
  try {
    const idx = await buildActionIndex(dir, false); // dev:false → prod sanitization
    const file = resolveServerModule(idx, '/actions/strict.server.js');
    const hash = idx.fileToHash.get(file);

    // --- RPC path: throw → sanitized error response, SAME as a thrown action
    // (a non-200 the client stub throws on; prod sanitizes to message only). A
    // thrown action returns 500 via actionErrorResponse, so a thrown validator
    // matches that for transport consistency. ---
    const rpcBad = await invokeAction(idx, hash, 'compute', rpcReq(hash, 'compute', await wjStringify([{ n: 'x' }])));
    assert.equal(rpcBad.status, 500);
    const rpcBadOut = wjParse(await rpcBad.text());
    assert.equal(rpcBadOut.error, 'expected a number');
    assert.equal(rpcBadOut.stack, undefined, 'no stack in prod');

    // --- RPC path: good input passes (transform return used as arg) ---
    const rpcOk = await invokeAction(idx, hash, 'compute', rpcReq(hash, 'compute', await wjStringify([{ n: 21 }])));
    const rpcOkOut = wjParse(await rpcOk.text());
    assert.equal(rpcOkOut.data, 42);

    // --- REST path: throw → 400 carrying the schema lib's `issues` (legacy shape) ---
    const m = matchExposedAction(idx, 'POST', '/api/compute');
    const restBad = await invokeExposedAction(idx, m.route, m.params, new Request('http://x/api/compute', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ n: 'x' }),
    }));
    assert.equal(restBad.status, 400);
    const restBadOut = await restBad.json();
    assert.equal(restBadOut.error, 'expected a number');
    assert.ok(Array.isArray(restBadOut.issues), 'structured issues survive on REST (back-compat)');

    // --- REST path: a transform-return replaces the input (back-compat) ---
    const restOk = await invokeExposedAction(idx, m.route, m.params, new Request('http://x/api/compute', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ n: 21 }),
    }));
    assert.equal(restOk.status, 200);
    const restOkOut = await restOk.json();
    assert.equal(restOkOut.data, 42);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- the validator is never shipped to the client ----------------------------

test('the validator lives in the .server file: the RPC stub never embeds it', async () => {
  const { serveActionStub } = await import('../../src/actions.js');
  const dir = await scaffold({
    'actions/post.server.js': `'use server';
      import { validateInput } from '@webjsdev/core';
      export const createPost = validateInput(
        async (input) => ({ success: true, data: input }),
        (input) => (input && input.title) ? { success: true } : { success: false, fieldErrors: { title: 'SECRET_VALIDATOR_MARKER' } },
      );
    `,
  });
  try {
    const idx = await buildActionIndex(dir, true);
    const file = resolveServerModule(idx, '/actions/post.server.js');
    const stub = await serveActionStub(idx, file);
    assert.match(stub, /export const createPost = /);
    assert.doesNotMatch(stub, /SECRET_VALIDATOR_MARKER/, 'the validator body is not in the client stub');
    assert.doesNotMatch(stub, /validateInput/, 'the attacher is not referenced in the client stub');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- validateInput coexists with an expose()d sibling in the same file -------

test('validateInput-only action coexists with an exposed sibling in the same module', async () => {
  const dir = await scaffold({
    'actions/mixed.server.js': `'use server';
      import { expose, validateInput } from '@webjsdev/core';
      export const exposed = expose('POST /api/x', async (i) => ({ success: true, data: i }));
      export const guarded = validateInput(
        async (i) => ({ success: true, data: i }),
        (i) => (i && i.ok) ? { success: true } : { success: false, fieldErrors: { ok: 'required' } },
      );
    `,
  });
  try {
    // The index loads this module (it references expose); the validate-only
    // `guarded` must NOT crash the index build (no method/path) and must NOT
    // register a REST route.
    const idx = await buildActionIndex(dir, true);
    assert.equal(idx.httpRoutes.length, 1, 'only the exposed action registers a REST route');
    assert.equal(idx.httpRoutes[0].fnName, 'exposed');

    const file = resolveServerModule(idx, '/actions/mixed.server.js');
    const hash = idx.fileToHash.get(file);
    // The validate-only action still validates over RPC.
    const bad = await invokeAction(idx, hash, 'guarded', rpcReq(hash, 'guarded', await wjStringify([{ ok: false }])));
    const badOut = wjParse(await bad.text());
    assert.deepEqual(badOut.fieldErrors, { ok: 'required' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
