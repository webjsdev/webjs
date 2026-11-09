/**
 * #1689: the `bun --hot` poke batch. When the registry-reset re-run arrives
 * AFTER the poke's 1500ms fallback, the fallback has already rebuilt and
 * notified against the PRE-reset registry, and the late re-run used to find
 * nothing pending and rebuild silently, so the tab never learned the fresh
 * modules were there. `takeForRerun()` now hands such a re-run the fired batch
 * with `notify: true`.
 *
 * Fake timers, so the race is deterministic.
 *
 * COUNTERFACTUAL: the old logic cleared the batch when the fallback fired, so
 * the late re-run below returned `notify: false`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPokeState } from '../../src/dev/poke-state.js';

function fakeTimers() {
  let next = 1;
  const timers = new Map();
  return {
    setTimeout(fn, ms) { const id = next++; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fire() { for (const [id, t] of [...timers]) { timers.delete(id); t.fn(); } },
    get size() { return timers.size; },
    get ms() { return [...timers.values()].at(-1)?.ms; },
  };
}

const page = { v: 'page', by: 'app/page.ts', why: 'page-module' };
const comp = { v: 'component', by: 'components/x.ts', why: 'hot-swap', modules: ['/components/x.ts?t=1'] };

test('a re-run that arrives before the fallback takes the pending batch and notifies', () => {
  const t = fakeTimers();
  const s = createPokeState(t);
  const fell = [];
  s.poke(page, ['/a/app/page.ts'], (v, c) => fell.push([v, c]));
  const r = s.takeForRerun();
  assert.deepEqual(r, { verdict: page, changed: ['/a/app/page.ts'], notify: true });
  assert.equal(t.size, 0, 'the fallback is disarmed');
  assert.deepEqual(fell, []);
  assert.deepEqual(s.takeForRerun(), { verdict: null, changed: [], notify: false }, 'and a second re-run is silent');
});

test('a re-run that arrives AFTER the fallback rebuilds and notifies again with the fired batch', () => {
  const t = fakeTimers();
  const s = createPokeState(t);
  const fell = [];
  s.poke(comp, ['/a/components/x.ts'], (v, c) => fell.push([v, c]));
  t.fire();
  assert.deepEqual(fell, [[comp, ['/a/components/x.ts']]], 'the fallback rebuilt with the batch');
  const late = s.takeForRerun();
  assert.deepEqual(late, { verdict: comp, changed: ['/a/components/x.ts'], notify: true },
    'the late re-run notifies against the fresh registry');
  assert.deepEqual(s.takeForRerun(), { verdict: null, changed: [], notify: false }, 'only once');
});

test('a re-run with nothing poked is a silent re-derive', () => {
  const s = createPokeState(fakeTimers());
  assert.deepEqual(s.takeForRerun(), { verdict: null, changed: [], notify: false });
});

test('pokes inside one window merge, and a poke after a fired fallback folds the fired batch in', () => {
  const t = fakeTimers();
  const s = createPokeState(t);
  const fell = [];
  s.poke(page, ['/a/app/page.ts'], (v, c) => fell.push([v, c]));
  s.poke(comp, ['/a/components/x.ts'], (v, c) => fell.push([v, c]));
  assert.equal(t.size, 1, 'one fallback armed, re-armed by the second poke');
  t.fire();
  assert.equal(fell.length, 1);
  assert.equal(fell[0][0].v, 'page', 'the merged verdict keeps the stronger one');
  assert.deepEqual(fell[0][0].modules, ['/components/x.ts?t=1'], 'and the union of modules');

  s.poke({ v: 'shell', by: 'lib/y.ts', why: 'server-only-module' }, ['/a/lib/y.ts'], () => {});
  const r = s.takeForRerun();
  assert.equal(r.notify, true);
  assert.equal(r.verdict.v, 'shell');
  assert.deepEqual(r.changed.sort(), ['/a/app/page.ts', '/a/components/x.ts', '/a/lib/y.ts']);
});

// Review of #1689: a fired batch whose re-run was genuinely lost must not ride
// along into a later, unrelated edit. Past its window it is dropped, so the
// next poke carries only its own verdict and files, and a stray re-run is a
// silent re-derive.
test('a fired batch expires after its window and never merges into a later poke', () => {
  const t = fakeTimers();
  const s = createPokeState({ ...t, fallbackMs: 1500 });
  const reload = { v: 'reload', by: 'lib/x.ts', why: 'ships-to-browser' };
  s.poke(reload, ['/a/lib/x.ts'], () => {});
  t.fire();
  assert.equal(t.size, 1, 'the fired batch is held on a timer');
  assert.equal(t.ms, 3000, 'for twice the fallback');
  t.fire();
  assert.equal(t.size, 0);
  assert.deepEqual(s.takeForRerun(), { verdict: null, changed: [], notify: false }, 'an expired batch is not replayed');

  s.poke(reload, ['/a/lib/x.ts'], () => {});
  t.fire();
  t.fire();
  s.poke(page, ['/a/app/page.ts'], () => {});
  assert.deepEqual(s.takeForRerun(), { verdict: page, changed: ['/a/app/page.ts'], notify: true },
    'the later edit keeps its page morph and only its own files');
});
