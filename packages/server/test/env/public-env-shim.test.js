/**
 * Unit tests for the public env shim that exposes WEBJS_PUBLIC_*
 * environment variables to the browser via window.process.env.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicEnvShim } from '../../src/ssr.js';

test('filters to WEBJS_PUBLIC_* keys only', () => {
  const out = publicEnvShim({
    dev: false,
    env: {
      WEBJS_PUBLIC_API_URL: 'https://api.example.com',
      WEBJS_PUBLIC_STRIPE_KEY: 'pk_live_abc',
      DATABASE_URL: 'postgres://secret',
      AUTH_SECRET: 'do-not-leak',
      RANDOM_VAR: 'irrelevant',
    },
  });
  assert.ok(out.includes('WEBJS_PUBLIC_API_URL'));
  assert.ok(out.includes('https://api.example.com'));
  assert.ok(out.includes('WEBJS_PUBLIC_STRIPE_KEY'));
  assert.ok(out.includes('pk_live_abc'));
  assert.equal(out.includes('DATABASE_URL'), false, 'unprefixed secret must not leak');
  assert.equal(out.includes('postgres://secret'), false, 'unprefixed value must not leak');
  assert.equal(out.includes('AUTH_SECRET'), false);
  assert.equal(out.includes('RANDOM_VAR'), false);
});

test('sets NODE_ENV=development when dev=true', () => {
  const out = publicEnvShim({ dev: true, env: {} });
  assert.ok(/"NODE_ENV":"development"/.test(out));
});

test('sets NODE_ENV=production when dev=false', () => {
  const out = publicEnvShim({ dev: false, env: {} });
  assert.ok(/"NODE_ENV":"production"/.test(out));
});

test('skips undefined values', () => {
  const out = publicEnvShim({
    dev: false,
    env: { WEBJS_PUBLIC_A: 'set', WEBJS_PUBLIC_B: undefined },
  });
  assert.ok(out.includes('WEBJS_PUBLIC_A'));
  assert.equal(out.includes('WEBJS_PUBLIC_B'), false);
});

test('coerces non-string values to strings', () => {
  const out = publicEnvShim({
    dev: false,
    env: { WEBJS_PUBLIC_PORT: 3000 },
  });
  assert.ok(out.includes('"WEBJS_PUBLIC_PORT":"3000"'));
});

test('escapes </ in values so a malicious env var cannot terminate the script tag', () => {
  const out = publicEnvShim({
    dev: false,
    env: { WEBJS_PUBLIC_X: '</script><script>alert(1)</script>' },
  });
  // The literal '</script>' must not appear in the output as a closing tag.
  // After escaping, the only </script> in the output should be the legitimate
  // one at the end of the inline script. Count occurrences and assert exactly 1.
  const closings = out.match(/<\/script>/g) || [];
  assert.equal(closings.length, 1, 'env value containing </script> must be escaped');
  // The escaped form should appear in the JSON.
  assert.ok(out.includes('<\\/script>'));
});

test('adds nonce attribute when nonce is provided', () => {
  const out = publicEnvShim({ dev: false, env: {}, nonce: 'abc123' });
  assert.ok(out.startsWith('<script nonce="abc123">'));
});

test('omits nonce attribute when nonce is absent', () => {
  const out = publicEnvShim({ dev: false, env: {} });
  assert.ok(out.startsWith('<script>'));
  assert.equal(out.includes('nonce='), false);
});

test('output is a single inline script that assigns window.process.env', () => {
  const out = publicEnvShim({
    dev: false,
    env: { WEBJS_PUBLIC_X: 'y' },
  });
  assert.ok(out.startsWith('<script'));
  assert.ok(out.endsWith('</script>'));
  assert.ok(out.includes('window.process=window.process||{}'));
  assert.ok(out.includes('window.process.env=Object.assign(window.process.env||{},'));
});

test('output is parseable JS (sanity check, no syntax errors)', () => {
  const out = publicEnvShim({
    dev: true,
    env: { WEBJS_PUBLIC_A: 'a', WEBJS_PUBLIC_B: 'b"with quotes' },
  });
  // Extract the script body and evaluate it in a fake window.
  const body = out.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  const win = {};
  // eslint-disable-next-line no-new-func
  new Function('window', body)(win);
  assert.equal(win.process.env.WEBJS_PUBLIC_A, 'a');
  assert.equal(win.process.env.WEBJS_PUBLIC_B, 'b"with quotes');
  assert.equal(win.process.env.NODE_ENV, 'development');
});
