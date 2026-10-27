/**
 * The public env shim is a per-build snapshot (#1644). It used to enumerate
 * `process.env` on EVERY page render (about 266 µs with a couple of hundred
 * variables, 24% of a production render's CPU), for a result that only
 * changes with the build: `applyEnvValidation` writes coerced values back
 * before any render, and a dev rebuild re-snapshots through the epoch.
 *
 * Counterfactual: `process.env` is swapped for a Proxy that counts
 * enumerations. Two renders with different nonces enumerate ONCE, and the two
 * outputs differ only in the nonce attribute. With the memo removed, the count
 * is two and the test fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { publicEnvShim } from '../../src/ssr/env-shim.js';
import { bumpBuildEpoch } from '../../src/build-epoch.js';

/** Run `fn` with `process.env` replaced by a counting Proxy over `vars`. */
function withCountedEnv(vars, fn) {
  const real = process.env;
  let enumerations = 0;
  const proxy = new Proxy({ ...vars }, {
    ownKeys(t) { enumerations++; return Reflect.ownKeys(t); },
  });
  process.env = proxy;
  try { return { out: fn(), enumerations }; }
  finally { process.env = real; }
}

test('publicEnvShim: one enumeration per build, nonce per call, identical payload', () => {
  bumpBuildEpoch();
  const { out, enumerations } = withCountedEnv({ WEBJS_PUBLIC_API: 'https://api.example', SECRET: 'no' }, () => [
    publicEnvShim({ dev: false, nonce: 'alpha' }),
    publicEnvShim({ dev: false, nonce: 'beta' }),
    publicEnvShim({ dev: false }),
  ]);
  assert.equal(enumerations, 1, 'process.env is enumerated once per build, not once per render');
  const [a, b, c] = out;
  assert.match(a, /^<script nonce="alpha">/);
  assert.match(b, /^<script nonce="beta">/);
  assert.match(c, /^<script>/);
  const payload = (s) => s.slice(s.indexOf('>') + 1);
  assert.equal(payload(a), payload(b), 'the memoized payload is byte-identical across renders');
  assert.equal(payload(b), payload(c));
  assert.ok(a.includes('"WEBJS_PUBLIC_API":"https://api.example"'));
  assert.ok(!a.includes('SECRET'), 'a non-public var never reaches the browser');
});

test('publicEnvShim: a new build enumerates again, a dev flag flip is a different snapshot', () => {
  bumpBuildEpoch();
  const first = withCountedEnv({ WEBJS_PUBLIC_X: '1' }, () => publicEnvShim({ dev: false }));
  assert.equal(first.enumerations, 1);
  const same = withCountedEnv({ WEBJS_PUBLIC_X: 'changed-at-runtime' }, () => publicEnvShim({ dev: false }));
  assert.equal(same.enumerations, 0, 'within a build the snapshot is served');
  assert.ok(same.out.includes('"WEBJS_PUBLIC_X":"1"'), 'a runtime mutation is not reflected until the next build (documented)');
  bumpBuildEpoch();
  const next = withCountedEnv({ WEBJS_PUBLIC_X: '2' }, () => publicEnvShim({ dev: false }));
  assert.equal(next.enumerations, 1, 'the next build re-snapshots');
  assert.ok(next.out.includes('"WEBJS_PUBLIC_X":"2"'));
  const dev = withCountedEnv({ WEBJS_PUBLIC_X: '2' }, () => publicEnvShim({ dev: true }));
  assert.ok(dev.out.includes('"NODE_ENV":"development"'), 'dev and prod snapshots are kept apart');
});

test('publicEnvShim: an explicit env is never memoized', () => {
  bumpBuildEpoch();
  const a = publicEnvShim({ dev: false, env: { WEBJS_PUBLIC_A: '1' } });
  const b = publicEnvShim({ dev: false, env: { WEBJS_PUBLIC_A: '2' } });
  assert.ok(a.includes('"WEBJS_PUBLIC_A":"1"'));
  assert.ok(b.includes('"WEBJS_PUBLIC_A":"2"'), 'a test-injected env is computed fresh every call');
});
