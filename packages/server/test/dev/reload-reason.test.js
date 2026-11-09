/**
 * #1689: a dev full reload says why, AFTER the reload. A reason logged before
 * `location.reload()` dies with the document whose console it went to, so the
 * reload client stores `{ why, by }` in `sessionStorage` and the reloaded page
 * prints it once: `[webjs] full reload: <why> (<by>)`.
 *
 * The shared source the reload client inlines is driven here with a fake
 * storage, location and log, and the served client is checked to route every
 * reload through it.
 *
 * COUNTERFACTUAL: without the stored reason, `printPendingReason` on the
 * reloaded page has nothing to print and the first test fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reloadWithReason, printPendingReason } from '../../src/dev-reload-reason.js';
import { reloadClientJs } from '../../src/dev/helpers.js';

function fakeStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    size: () => m.size,
  };
}

test('a reason written before the reload is printed once by the reloaded page, then forgotten', () => {
  const store = fakeStore();
  const logs = [];
  let reloads = 0;
  reloadWithReason({ v: 'reload', why: 'constructor-changed', by: 'components/counter.ts' }, { reload: () => { reloads++; } }, store, (m) => logs.push(m));
  assert.equal(reloads, 1);
  assert.deepEqual(logs, [], 'nothing is logged into the document that is about to go away');

  printPendingReason(store, (m) => logs.push(m));
  assert.deepEqual(logs, ['[webjs] full reload: constructor-changed (components/counter.ts)']);
  assert.equal(store.size(), 0, 'removed once printed');
  printPendingReason(store, (m) => logs.push(m));
  assert.equal(logs.length, 1, 'a later page load prints nothing');
});

test('a verdict with no reason falls back to its name, and no file prints no parentheses', () => {
  const store = fakeStore();
  const logs = [];
  reloadWithReason({ v: 'reload' }, { reload() {} }, store, () => {});
  printPendingReason(store, (m) => logs.push(m));
  assert.deepEqual(logs, ['[webjs] full reload: reload']);
});

test('with no storage the reason is logged before the reload instead', () => {
  const logs = [];
  let reloads = 0;
  const throwing = { setItem() { throw new Error('denied'); }, getItem() { throw new Error('denied'); }, removeItem() {} };
  reloadWithReason({ why: 'server-restarted', by: '' }, { reload: () => { reloads++; } }, throwing, (m) => logs.push(m));
  reloadWithReason({ why: 'missed-update' }, { reload: () => { reloads++; } }, null, (m) => logs.push(m));
  assert.equal(reloads, 2);
  assert.deepEqual(logs, ['[webjs] full reload: server-restarted', '[webjs] full reload: missed-update']);
  printPendingReason(throwing, (m) => logs.push(m));
  printPendingReason(null, (m) => logs.push(m));
  assert.equal(logs.length, 2, 'a storage that throws prints nothing and does not throw');
});

test('a corrupt stored value is dropped silently', () => {
  const store = fakeStore();
  store.setItem('webjs:dev-reload-reason', '{nope');
  const logs = [];
  printPendingReason(store, (m) => logs.push(m));
  assert.deepEqual(logs, []);
  assert.equal(store.size(), 0);
});

test('the served reload client routes every reload through it and prints the pending reason at startup', () => {
  const js = reloadClientJs('');
  assert.match(js, /function reloadWithReason\(/, 'the shared source is inlined');
  assert.match(js, /\nprintPendingReason\(__webjsStore\(\), __webjsInfo\);\n/, 'the pending reason prints when the client starts');
  assert.doesNotMatch(js, /location\.reload\(\);/, 'no bare location.reload() call is left');
  for (const why of ['styles-failed', 'refresh-failed']) {
    assert.match(js, new RegExp(`__webjsReload\\(\\{ why: '${why}'`), `a ${why} reload names its reason`);
  }
  assert.match(js, /\{ why: 'no-client-router', by: verdict\.by \}/, 'so does a refresh with no client router to apply it');
  assert.match(js, /function reload\(why\) \{ __webjsReload\(\{ why: why, by: verdict\.by \}\); \}/, 'and a refused hot swap');
  assert.match(js, /' updated in place'/, 'an in-place refresh says what it did');
});
