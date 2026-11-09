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

// Review of #1689: a refresh the dev server answered with a render error
// applied nothing, and the client still logged "page updated in place". The
// served client's logger is run here with a fake console.
test('the in-place log names a refresh that kept the last good page, and only an applied one as updated', () => {
  const js = reloadClientJs('');
  const src = /function __webjsLogRefresh\([\s\S]*?\n\}\n/.exec(js);
  assert.ok(src, 'the client carries one refresh logger');
  const logs = [];
  const log = new Function('console', `${src[0]}; return __webjsLogRefresh;`)({ info: (m) => logs.push(m) });
  log('applied', 'page', 'app/page.ts');
  log('applied', 'shell', 'app/layout.ts');
  log('dev-error', 'page', 'app/page.ts');
  assert.deepEqual(logs, [
    '[webjs] page updated in place (app/page.ts)',
    '[webjs] layout updated in place (app/layout.ts)',
    '[webjs] the page did not render, so the last good version stays under the error overlay (app/page.ts)',
  ]);
  assert.match(js, /refresh\(mode\)\.then\(function \(outcome\) \{[\s\S]*?__webjsLogRefresh\(outcome, mode, verdict\.by\)/, 'the refresh path logs through it');
});

// Review of #1689: a component-only hot swap re-renders nothing on the server,
// so it must not take down an overlay about something else (the browser test
// `test/dev/browser/dev-overlay.test.js` drives the predicate itself).
test('a component hot swap dismisses only an overlay the swap settled', () => {
  const js = reloadClientJs('/base');
  const hot = /function __webjsApplyHot\([\s\S]*?\n\}\n/.exec(js);
  assert.ok(hot, 'the hot apply ships');
  assert.match(hot[0], /if \(mode === 'page' \|\| mode === 'shell'\) dismissDevOverlay\(\);\n\s*else \{/, 'only a page / shell refresh dismisses unconditionally');
  assert.match(hot[0], /dismissDevOverlayCoveredBy\(mods\.map\(/, 'a component swap passes the swapped modules');
  assert.match(hot[0], /var bp = "\/base";/, 'with the base path stripped from their urls');
});
