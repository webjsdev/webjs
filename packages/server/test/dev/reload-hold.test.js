/**
 * The dev live-reload hold (#1532): a framing host pauses live reload while
 * its agent builds and releases it after. The module is inlined verbatim into
 * the served reload client, so this drives the code that ships.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createReloadHold, mergeHeldVerdict } from '../../src/dev-reload-hold.js';
import { reloadClientJs } from '../../src/dev/helpers.js';

function harness() {
  const applied = [];
  let held = false;
  const hold = createReloadHold((v) => applied.push(v), () => held);
  return { hold, applied, set: (on) => { held = on; } };
}

const vOf = (list) => list.map((x) => x.v);

test('not held: every signal is the caller\'s to apply now', () => {
  const { hold, applied } = harness();
  assert.equal(hold.offer({ v: 'page' }), false);
  hold.release();
  assert.deepEqual(applied, []);
});

test('held: signals are kept, and release applies ONE reload at the strongest verdict', () => {
  const { hold, applied, set } = harness();
  set(true);
  assert.equal(hold.offer({ v: 'page', by: 'app/page.ts', why: 'page-module' }), true);
  assert.equal(hold.offer({ v: 'shell', by: 'app/layout.ts', why: 'server-only-module' }), true);
  assert.equal(hold.offer({ v: 'page', by: 'app/page.ts', why: 'page-module' }), true);
  assert.equal(hold.pending().v, 'shell');
  assert.equal(hold.pending().by, 'app/layout.ts', 'the stronger verdict keeps its own by');
  hold.release();
  assert.deepEqual(applied, [], 'release while still held does nothing');
  set(false);
  hold.release();
  assert.deepEqual(vOf(applied), ['shell']);
  hold.release();
  assert.deepEqual(vOf(applied), ['shell'], 'applied once');
});

// #1689: a held batch keeps every component module and the stylesheet flag,
// not just the strongest name, so the release does all the batch's work.
test('held: modules union and css ORs across the held signals', () => {
  const { hold, applied, set } = harness();
  set(true);
  hold.offer({ v: 'css', by: 'public/app.css', why: 'stylesheet', css: true });
  hold.offer({ v: 'component', by: 'components/a.ts', why: 'hot-swap', modules: ['/components/a.ts?t=1'] });
  hold.offer({ v: 'component', by: 'components/b.ts', why: 'hot-swap', modules: ['/components/b.ts?t=2', '/components/a.ts?t=1'] });
  set(false);
  hold.release();
  assert.equal(applied.length, 1);
  assert.equal(applied[0].v, 'component');
  assert.equal(applied[0].by, 'components/a.ts', 'the first of equal strength keeps its by');
  assert.deepEqual(applied[0].modules, ['/components/a.ts?t=1', '/components/b.ts?t=2']);
  assert.equal(applied[0].css, true);
});

test('held with nothing changed: release applies nothing', () => {
  const { hold, applied, set } = harness();
  set(true);
  set(false);
  hold.release();
  assert.deepEqual(applied, []);
});

test('an unknown or missing verdict is a full reload, and reload beats everything', () => {
  const m = (a, b) => mergeHeldVerdict(a === null ? null : mergeHeldVerdict(null, a), b).v;
  assert.equal(mergeHeldVerdict(null, undefined).v, 'reload');
  assert.equal(mergeHeldVerdict(null, 'bogus').v, 'reload');
  assert.equal(mergeHeldVerdict(null, { v: 'bogus' }).v, 'reload');
  assert.equal(m({ v: 'page' }, { v: 'reload' }), 'reload');
  assert.equal(m({ v: 'reload' }, { v: 'page' }), 'reload');
  assert.equal(m({ v: 'page' }, { v: 'shell' }), 'shell');
  assert.equal(m({ v: 'css' }, { v: 'component' }), 'component');
  assert.equal(mergeHeldVerdict(null, { v: 'page' }).v, 'page');
});

test('a legacy string verdict (a relay older than #1689) is read as { v }', () => {
  const held = mergeHeldVerdict(null, 'shell');
  assert.deepEqual(held, { v: 'shell', by: '', why: '', modules: [], css: false });
  assert.equal(mergeHeldVerdict(held, 'page').v, 'shell');
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
