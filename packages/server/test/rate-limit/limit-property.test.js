/**
 * Rate-limit property test (issue #187, subsystem hardening).
 *
 * INVARIANT: within one window, exactly the first `max` requests from a key
 * pass; every request after that is 429 with a Retry-After header, until the
 * window resets. The existing rate-limit.test.js checks max=2; this asserts
 * the count invariant across a range of `max` values so an off-by-one in the
 * `count > max` boundary cannot slip through.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { rateLimit } from '../../src/rate-limit.js';
import { setStore, memoryStore } from '../../src/cache.js';

beforeEach(() => setStore(memoryStore()));

const req = () => new Request('http://x/', { headers: { 'x-webjs-remote-ip': '1.2.3.4' } });
const next = async () => new Response('ok', { status: 200 });

for (const max of [0, 1, 3, 10, 25]) {
  test(`exactly ${max} requests pass per window, the rest are 429`, async () => {
    setStore(memoryStore());
    const mw = rateLimit({ window: '1h', max, key: `prop-${max}` });
    let passed = 0;
    let blocked = 0;
    for (let i = 0; i < max + 5; i++) {
      const resp = await mw(req(), next);
      if (resp.status === 200) passed++;
      else if (resp.status === 429) {
        blocked++;
        assert.ok(resp.headers.get('retry-after'), '429 must carry a Retry-After header');
      } else {
        assert.fail(`unexpected status ${resp.status}`);
      }
    }
    assert.equal(passed, max, `exactly ${max} requests should pass`);
    assert.equal(blocked, 5, 'every request past the limit should be blocked');
  });
}

test('separate keys get independent budgets', async () => {
  setStore(memoryStore());
  const mw = rateLimit({ window: '1h', max: 1, key: (r) => r.headers.get('x-webjs-remote-ip') });
  const a = new Request('http://x/', { headers: { 'x-webjs-remote-ip': 'a' } });
  const b = new Request('http://x/', { headers: { 'x-webjs-remote-ip': 'b' } });
  assert.equal((await mw(a, next)).status, 200, 'a first request passes');
  assert.equal((await mw(a, next)).status, 429, 'a second request blocked');
  assert.equal((await mw(b, next)).status, 200, 'b has its own budget');
});

test('a new window admits another `max` after the old one expires', async () => {
  setStore(memoryStore());
  const mw = rateLimit({ window: 20, max: 2, key: 'win' }); // 20ms window
  assert.equal((await mw(req(), next)).status, 200);
  assert.equal((await mw(req(), next)).status, 200);
  assert.equal((await mw(req(), next)).status, 429, 'third blocked in the first window');
  await new Promise((r) => setTimeout(r, 35));
  assert.equal((await mw(req(), next)).status, 200, 'window reset admits a fresh request');
});
