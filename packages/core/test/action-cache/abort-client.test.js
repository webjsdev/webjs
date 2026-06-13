/**
 * Client action-abort plumbing (#492): the active signal a stub binds fetches to.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setActiveActionSignal, activeActionSignal } from '../../src/action-abort-client.js';

test('activeActionSignal is undefined when no render is in flight', () => {
  setActiveActionSignal(null);
  assert.equal(activeActionSignal(), undefined);
});

test('set then read returns the bound signal; clearing returns undefined', () => {
  const c = new AbortController();
  setActiveActionSignal(c.signal);
  assert.equal(activeActionSignal(), c.signal);
  setActiveActionSignal(null);
  assert.equal(activeActionSignal(), undefined);
});
