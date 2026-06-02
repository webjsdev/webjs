/**
 * Unit + integration tests for the standalone `cors()` middleware
 * primitive (`src/cors.js`), the app-facing surface usable in
 * `middleware.js` or wrapped around a `route.js` handler.
 *
 * Covers: allowed-origin reflection, disallowed-origin (no ACAO),
 * OPTIONS preflight short-circuit, credentialed specific origin,
 * the credentials+wildcard guard (COUNTERFACTUAL), Vary: Origin
 * append-not-clobber, and RegExp / function / array origin policies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cors, resolveOrigin, applyCorsHeaders, _resetCorsWarnings } from '../../src/cors.js';

/**
 * Run `fn` capturing console.warn calls, then restore. Returns the array
 * of warning strings emitted during `fn`.
 *
 * @param {() => unknown | Promise<unknown>} fn
 * @returns {Promise<string[]>}
 */
async function captureWarnings(fn) {
  const original = console.warn;
  /** @type {string[]} */
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.warn = original;
  }
  return warnings;
}

/** @param {string|null} origin @param {string} [method] @param {Record<string,string>} [extra] */
function req(origin, method = 'GET', extra = {}) {
  const headers = new Headers();
  if (origin) headers.set('origin', origin);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Request('http://localhost/api', { method, headers });
}

/** A next() that returns a plain JSON 200, optionally with seeded headers. */
function nextOk(seed = {}) {
  return async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: seed });
}

// --- allowed / disallowed origin on the actual request ---

test('allowed exact-string origin reflects ACAO on the actual response', async () => {
  const mw = cors({ origin: 'https://a.com' });
  const resp = await mw(req('https://a.com'), nextOk());
  assert.equal(resp.headers.get('access-control-allow-origin'), 'https://a.com');
  assert.equal(resp.status, 200);
  assert.deepEqual(await resp.json(), { ok: true });
});

test('disallowed origin gets NO ACAO but the request is still served', async () => {
  const mw = cors({ origin: 'https://a.com' });
  const resp = await mw(req('https://evil.com'), nextOk());
  assert.equal(resp.headers.get('access-control-allow-origin'), null);
  // CORS is browser-enforced: the server still serves the body.
  assert.equal(resp.status, 200);
  assert.deepEqual(await resp.json(), { ok: true });
});

test('wildcard origin sends ACAO: * (no credentials)', async () => {
  const mw = cors({ origin: '*' });
  const resp = await mw(req('https://anything.com'), nextOk());
  assert.equal(resp.headers.get('access-control-allow-origin'), '*');
});

test('default policy (no origin option) is wildcard', async () => {
  const mw = cors();
  const resp = await mw(req('https://anything.com'), nextOk());
  assert.equal(resp.headers.get('access-control-allow-origin'), '*');
});

// --- array / RegExp / function policies ---

test('array allow-list reflects an included origin, omits a non-member', async () => {
  const mw = cors({ origin: ['https://a.com', 'https://b.com'] });
  const ok = await mw(req('https://b.com'), nextOk());
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://b.com');
  const no = await mw(req('https://c.com'), nextOk());
  assert.equal(no.headers.get('access-control-allow-origin'), null);
});

test('RegExp origin policy matches by pattern', async () => {
  const mw = cors({ origin: /\.example\.com$/ });
  const ok = await mw(req('https://app.example.com'), nextOk());
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://app.example.com');
  const no = await mw(req('https://example.com.evil.net'), nextOk());
  assert.equal(no.headers.get('access-control-allow-origin'), null);
});

test('function origin policy decides dynamically', async () => {
  const mw = cors({ origin: (o) => o.startsWith('https://trusted-') });
  const ok = await mw(req('https://trusted-1.io'), nextOk());
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://trusted-1.io');
  const no = await mw(req('https://hostile.io'), nextOk());
  assert.equal(no.headers.get('access-control-allow-origin'), null);
});

test('mixed array of RegExp + string entries matches either', async () => {
  const mw = cors({ origin: ['https://a.com', /\.b\.com$/] });
  const a = await mw(req('https://a.com'), nextOk());
  assert.equal(a.headers.get('access-control-allow-origin'), 'https://a.com');
  const b = await mw(req('https://x.b.com'), nextOk());
  assert.equal(b.headers.get('access-control-allow-origin'), 'https://x.b.com');
});

// --- OPTIONS preflight short-circuit ---

test('OPTIONS preflight short-circuits 204 with Allow-Methods/Headers and does NOT call next', async () => {
  let nextCalled = false;
  const mw = cors({ origin: 'https://a.com', methods: ['GET', 'POST'], maxAge: 600 });
  const resp = await mw(
    req('https://a.com', 'OPTIONS', {
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,authorization',
    }),
    async () => {
      nextCalled = true;
      return new Response('should not happen');
    },
  );
  assert.equal(nextCalled, false, 'next() must not run on a preflight');
  assert.equal(resp.status, 204);
  assert.equal(resp.headers.get('access-control-allow-origin'), 'https://a.com');
  assert.equal(resp.headers.get('access-control-allow-methods'), 'GET, POST');
  assert.equal(resp.headers.get('access-control-allow-headers'), 'content-type,authorization');
  assert.equal(resp.headers.get('access-control-max-age'), '600');
});

test('preflight reflects Access-Control-Request-Headers when allowedHeaders unset', async () => {
  const mw = cors({ origin: '*' });
  const resp = await mw(
    req('https://a.com', 'OPTIONS', {
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'x-custom-header',
    }),
    nextOk(),
  );
  assert.equal(resp.headers.get('access-control-allow-headers'), 'x-custom-header');
});

test('preflight uses configured allowedHeaders over the request header', async () => {
  const mw = cors({ origin: '*', allowedHeaders: ['x-only-this'] });
  const resp = await mw(
    req('https://a.com', 'OPTIONS', {
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'content-type',
    }),
    nextOk(),
  );
  assert.equal(resp.headers.get('access-control-allow-headers'), 'x-only-this');
});

test('disallowed preflight returns a bare 204 with no CORS headers', async () => {
  const mw = cors({ origin: 'https://a.com' });
  const resp = await mw(
    req('https://evil.com', 'OPTIONS', { 'access-control-request-method': 'POST' }),
    nextOk(),
  );
  assert.equal(resp.status, 204);
  assert.equal(resp.headers.get('access-control-allow-origin'), null);
  assert.equal(resp.headers.get('access-control-allow-methods'), null);
});

test('OPTIONS without Access-Control-Request-Method is NOT a preflight (passes to next)', async () => {
  let nextCalled = false;
  const mw = cors({ origin: '*' });
  const resp = await mw(req('https://a.com', 'OPTIONS'), async () => {
    nextCalled = true;
    return new Response(null, { status: 204 });
  });
  assert.equal(nextCalled, true);
  // It is an actual request, so ACAO is still applied.
  assert.equal(resp.headers.get('access-control-allow-origin'), '*');
});

// --- credentials ---

test('credentialed request with a specific allowed origin sets ACAC: true', async () => {
  const mw = cors({ origin: 'https://a.com', credentials: true });
  const resp = await mw(req('https://a.com'), nextOk());
  assert.equal(resp.headers.get('access-control-allow-origin'), 'https://a.com');
  assert.equal(resp.headers.get('access-control-allow-credentials'), 'true');
});

test('COUNTERFACTUAL: credentials + wildcard NEVER emits ACAO: * with ACAC', async () => {
  // The CORS spec forbids `Access-Control-Allow-Origin: *` together with
  // `Access-Control-Allow-Credentials: true`. The guard narrows the
  // wildcard to the reflected request origin. If the guard were removed
  // (resolveOrigin returning `{ allowOrigin: '*' }` under credentials),
  // this assertion fails.
  const mw = cors({ origin: '*', credentials: true });
  let resp;
  await captureWarnings(async () => {
    resp = await mw(req('https://a.com'), nextOk());
  });
  const acao = resp.headers.get('access-control-allow-origin');
  assert.notEqual(acao, '*', 'must not send wildcard ACAO with credentials');
  assert.equal(acao, 'https://a.com', 'wildcard narrows to the reflected origin');
  assert.equal(resp.headers.get('access-control-allow-credentials'), 'true');
  // And it varies by origin, so caches must key on Origin.
  assert.equal(resp.headers.get('vary'), 'Origin');
});

test('credentials + wildcard with NO origin header refuses (no ACAO at all)', async () => {
  const mw = cors({ origin: '*', credentials: true });
  let resp;
  await captureWarnings(async () => {
    resp = await mw(req(null), nextOk());
  });
  assert.equal(resp.headers.get('access-control-allow-origin'), null);
  assert.equal(resp.headers.get('access-control-allow-credentials'), null);
});

test('resolveOrigin counterfactual at the unit level: wildcard+credentials never yields *', async () => {
  let r;
  await captureWarnings(() => {
    r = resolveOrigin('*', 'https://a.com', true);
  });
  assert.ok(r);
  assert.notEqual(r.allowOrigin, '*');
  assert.equal(r.allowOrigin, 'https://a.com');
  assert.equal(r.dynamic, true);
  // Without credentials it is a plain static wildcard.
  const w = resolveOrigin('*', 'https://a.com', false);
  assert.deepEqual(w, { allowOrigin: '*', dynamic: false });
});

// --- Vary: Origin ---

test('Vary: Origin is set for a dynamic (reflected) origin', async () => {
  const mw = cors({ origin: ['https://a.com'] });
  const resp = await mw(req('https://a.com'), nextOk());
  assert.equal(resp.headers.get('vary'), 'Origin');
});

test('static wildcard (no credentials) does NOT add Vary: Origin', async () => {
  const mw = cors({ origin: '*' });
  const resp = await mw(req('https://a.com'), nextOk());
  // No Origin variance for a constant `*`.
  assert.equal(resp.headers.get('vary'), null);
});

test('Vary: Origin appends and does NOT clobber an existing Vary', async () => {
  const mw = cors({ origin: 'https://a.com' });
  const resp = await mw(req('https://a.com'), nextOk({ vary: 'Accept-Encoding' }));
  const vary = resp.headers.get('vary');
  const parts = vary.split(',').map((s) => s.trim().toLowerCase());
  assert.ok(parts.includes('accept-encoding'), 'existing Vary preserved');
  assert.ok(parts.includes('origin'), 'Origin appended');
});

test('Vary: Origin not duplicated when already present', () => {
  const headers = new Headers({ vary: 'Origin' });
  applyCorsHeaders(headers, { allowOrigin: 'https://a.com', dynamic: true }, {});
  assert.equal(headers.get('vary'), 'Origin');
});

// --- exposedHeaders ---

test('exposedHeaders sets Access-Control-Expose-Headers on the actual response', async () => {
  const mw = cors({ origin: '*', exposedHeaders: ['x-total-count', 'x-page'] });
  const resp = await mw(req('https://a.com'), nextOk());
  assert.equal(resp.headers.get('access-control-expose-headers'), 'x-total-count, x-page');
});

// --- usable wrapped around a route handler ---

test('cors() wraps a route.js handler: compose middleware + handler', async () => {
  const mw = cors({ origin: 'https://app.example.com', credentials: true });
  /** A toy route handler. */
  const GET = async () => Response.json({ users: [] });
  const handler = (request) => mw(request, () => GET(request));

  const resp = await handler(req('https://app.example.com'));
  assert.equal(resp.headers.get('access-control-allow-origin'), 'https://app.example.com');
  assert.equal(resp.headers.get('access-control-allow-credentials'), 'true');
  assert.deepEqual(await resp.json(), { users: [] });
});

// --- credentials + wildcard footgun warning ---

test('credentials + wildcard warns LOUDLY (the dangerous any-origin reflection)', async () => {
  _resetCorsWarnings();
  const mw = cors({ origin: '*', credentials: true });
  const warnings = await captureWarnings(() => mw(req('https://a.com'), nextOk()));
  assert.equal(warnings.length, 1, 'exactly one warning for the credentials+wildcard combo');
  assert.match(warnings[0], /credentials/i);
  assert.match(warnings[0], /wildcard|any origin/i);
  assert.match(warnings[0], /allowlist/i, 'points the user at the explicit-allowlist fix');
});

test('credentials + wildcard warning is deduped to ONCE across many requests', async () => {
  _resetCorsWarnings();
  const mw = cors({ origin: true, credentials: true });
  const warnings = await captureWarnings(async () => {
    await mw(req('https://a.com'), nextOk());
    await mw(req('https://b.com'), nextOk());
    await mw(req('https://c.com'), nextOk());
  });
  assert.equal(warnings.length, 1, 'one-time, not per-request');
});

test('explicit allowlist with credentials does NOT warn (the safe path)', async () => {
  _resetCorsWarnings();
  const mw = cors({ origin: ['https://a.com', 'https://b.com'], credentials: true });
  const warnings = await captureWarnings(async () => {
    await mw(req('https://a.com'), nextOk());
    await mw(req('https://b.com'), nextOk());
  });
  assert.equal(warnings.length, 0, 'an explicit allowlist is safe and silent');
});

test('wildcard WITHOUT credentials does not warn (no footgun, plain ACAO: *)', async () => {
  _resetCorsWarnings();
  const mw = cors({ origin: '*' });
  const warnings = await captureWarnings(() => mw(req('https://a.com'), nextOk()));
  assert.equal(warnings.length, 0);
});

test('the warning still serves the request (warn, not error)', async () => {
  _resetCorsWarnings();
  const mw = cors({ origin: '*', credentials: true });
  let resp;
  await captureWarnings(async () => {
    resp = await mw(req('https://a.com'), nextOk());
  });
  assert.equal(resp.status, 200, 'request proceeds despite the warning');
  assert.equal(resp.headers.get('access-control-allow-origin'), 'https://a.com');
});
