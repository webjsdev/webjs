/**
 * The dev live-reload hold (#1532): a framing host pauses live reload while
 * its agent builds and releases it after. The module is inlined verbatim into
 * the served reload client, so this drives the code that ships.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createReloadHold, strongerHeldVerdict } from '../../src/dev-reload-hold.js';
import { reloadClientJs } from '../../src/dev/helpers.js';

function harness() {
  const applied = [];
  let held = false;
  const hold = createReloadHold((v) => applied.push(v), () => held);
  return { hold, applied, set: (on) => { held = on; } };
}

test('not held: every signal is the caller\'s to apply now', () => {
  const { hold, applied } = harness();
  assert.equal(hold.offer('page'), false);
  hold.release();
  assert.deepEqual(applied, []);
});

test('held: signals are kept, and release applies ONE reload at the strongest verdict', () => {
  const { hold, applied, set } = harness();
  set(true);
  assert.equal(hold.offer('page'), true);
  assert.equal(hold.offer('shell'), true);
  assert.equal(hold.offer('page'), true);
  assert.equal(hold.pending(), 'shell');
  hold.release();
  assert.deepEqual(applied, [], 'release while still held does nothing');
  set(false);
  hold.release();
  assert.deepEqual(applied, ['shell']);
  hold.release();
  assert.deepEqual(applied, ['shell'], 'applied once');
});

test('held with nothing changed: release applies nothing', () => {
  const { hold, applied, set } = harness();
  set(true);
  set(false);
  hold.release();
  assert.deepEqual(applied, []);
});

test('an unknown or missing verdict is a full reload, and reload beats everything', () => {
  assert.equal(strongerHeldVerdict(null, undefined), 'reload');
  assert.equal(strongerHeldVerdict(null, 'bogus'), 'reload');
  assert.equal(strongerHeldVerdict('page', 'reload'), 'reload');
  assert.equal(strongerHeldVerdict('reload', 'page'), 'reload');
  assert.equal(strongerHeldVerdict('page', 'shell'), 'shell');
  assert.equal(strongerHeldVerdict(null, 'page'), 'page');
});

test('the served reload client inlines the hold and gates every reload on it', () => {
  const js = reloadClientJs('');
  assert.match(js, /function createReloadHold\(/);
  assert.doesNotMatch(js, /^export /m, 'inlined as a classic script');
  assert.match(js, /function __webjsApplyReload\(verdict\) \{\n  if \(__webjsHold\.offer\(verdict\)\) return;/);
  assert.match(js, /globalThis\.__webjsDevReleaseHold = /);
  // It must still parse as a script.
  assert.doesNotThrow(() => new Function(js));
});
