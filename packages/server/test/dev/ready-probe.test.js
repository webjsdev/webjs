/**
 * #1689: the dev reload client's readiness probe never gives up. It used to
 * reload after 100 failed tries (about 10 seconds), which turned a slow restart
 * into the browser's own error page. It now backs off (100ms for 2 seconds, 1s
 * for 10 more, then every 5s), says once that it is waiting, never reloads, and
 * runs one loop that a later caller joins.
 *
 * The probe is the shared source `reloadClientJs` inlines, driven here with a
 * fake fetch and a fake clock.
 *
 * COUNTERFACTUAL: the old probe called `location.reload()` on the 101st
 * failure, so "never reloads past 100 failures" below fails against it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createReadyProbe } from '../../src/dev-ready-probe.js';
import { reloadClientJs } from '../../src/dev/helpers.js';

/** A fake clock: `setTimeout` records the delay, `tick()` runs the next timer. */
function fakeTimers() {
  const queue = [];
  return {
    delays: [],
    setTimeout(fn, ms) { this.delays.push(ms); queue.push(fn); },
    async tick() {
      const fn = queue.shift();
      if (fn) fn();
      await new Promise((r) => setImmediate(r));
    },
    pending() { return queue.length; },
  };
}

const flush = () => new Promise((r) => setImmediate(r));

test('keeps probing past 100 failures with the stated backoff, logs once, and never reloads', async () => {
  const timers = fakeTimers();
  const logs = [];
  let calls = 0;
  let up = false;
  const probe = createReadyProbe(async () => { calls++; return { ok: up }; }, '/__webjs/version', timers, (m) => logs.push(m));
  let ready = 0;
  probe(() => { ready++; });
  await flush();
  for (let i = 0; i < 150; i++) await timers.tick();
  assert.equal(ready, 0, 'not ready while the server is down');
  assert.ok(calls > 100, `still probing after ${calls} attempts`);
  assert.deepEqual(timers.delays.slice(0, 20), Array(20).fill(100), '100ms for the first 20 tries');
  assert.deepEqual(timers.delays.slice(20, 30), Array(10).fill(1000), 'then 1s for 10');
  assert.ok(timers.delays.slice(30).every((d) => d === 5000), 'then every 5s, forever');
  assert.deepEqual(logs, ['[webjs] waiting for the dev server...'], 'said once that it is waiting');

  up = true;
  await timers.tick();
  assert.equal(ready, 1, 'runs the callback once the server answers');
  assert.equal(timers.pending(), 0, 'and stops');
});

test('a thrown or rejected fetch counts as a failure, not a crash', async () => {
  const timers = fakeTimers();
  let n = 0;
  const probe = createReadyProbe(() => { n++; if (n === 1) throw new Error('sync'); if (n === 2) return Promise.reject(new Error('net')); return Promise.resolve({ ok: true }); }, '/v', timers, () => {});
  let ready = false;
  probe(() => { ready = true; });
  await flush();
  await timers.tick();
  await timers.tick();
  assert.equal(ready, true);
});

test('a second caller joins the running loop instead of starting another', async () => {
  const timers = fakeTimers();
  let calls = 0;
  let up = false;
  const probe = createReadyProbe(async () => { calls++; return { ok: up }; }, '/v', timers, () => {});
  const order = [];
  probe(() => order.push('a'));
  await flush();
  probe(() => order.push('b'));
  probe(() => order.push('c'));
  await flush();
  assert.equal(calls, 1, 'one request in flight, not three');
  up = true;
  await timers.tick();
  assert.deepEqual(order, ['a', 'b', 'c'], 'every caller runs, in order, from the one loop');
  // A later signal starts a fresh loop.
  probe(() => order.push('d'));
  await flush();
  assert.deepEqual(order, ['a', 'b', 'c', 'd']);
});

test('an up server answers on the first try with no timer at all', async () => {
  const timers = fakeTimers();
  const probe = createReadyProbe(async () => ({ ok: true }), '/v', timers, () => {});
  let ready = false;
  probe(() => { ready = true; });
  await flush();
  assert.equal(ready, true);
  assert.deepEqual(timers.delays, []);
});

test('the served reload client carries this probe and no bounded reload', () => {
  const js = reloadClientJs('');
  assert.match(js, /function createReadyProbe\(/, 'the shared source is inlined');
  assert.match(js, /var __webjsWhenReady = createReadyProbe\(/);
  assert.doesNotMatch(js, /tries > 100/, 'the old give-up-and-reload loop is gone');
});
