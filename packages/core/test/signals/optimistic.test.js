/**
 * Unit tests for the `optimistic(signal, value, action)` helper (#246).
 *
 * A thin wrapper over the signal primitive: it sets the optimistic value
 * immediately, runs the action, and rolls back on a thrown error OR a
 * `{ success: false }` ActionResult, keeping the value on success.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signal } from '../../src/signal.js';
import { optimistic } from '../../src/optimistic.js';

test('optimistic: keeps the value + returns the result on success', async () => {
  const s = signal('old');
  const result = await optimistic(s, 'new', async () => ({ success: true, data: { n: 1 } }));
  assert.equal(s.get(), 'new', 'optimistic value is kept on success');
  assert.deepEqual(result, { success: true, data: { n: 1 } }, 'the action result is returned');
});

test('optimistic: sets the value BEFORE the action settles (instant UI)', async () => {
  const s = signal(0);
  let observedDuringAction;
  await optimistic(s, 5, async () => {
    // The optimistic value is already applied while the action runs.
    observedDuringAction = s.get();
    return { success: true };
  });
  assert.equal(observedDuringAction, 5, 'the signal held the optimistic value during the action');
});

test('optimistic: rolls back + re-throws on a thrown action', async () => {
  const s = signal('old');
  await assert.rejects(
    () => optimistic(s, 'new', async () => { throw new Error('boom'); }),
    /boom/,
    'the thrown error propagates',
  );
  assert.equal(s.get(), 'old', 'the signal rolled back to its prior value');
});

test('optimistic: rolls back + returns the result on a { success: false } envelope', async () => {
  const s = signal('old');
  const result = await optimistic(s, 'new', async () => ({ success: false, error: 'nope', status: 422 }));
  assert.equal(s.get(), 'old', 'the signal rolled back on a failure envelope');
  assert.deepEqual(result, { success: false, error: 'nope', status: 422 }, 'the failure result is returned, not thrown');
});

test('optimistic: a non-envelope truthy success keeps the value', async () => {
  // A bare value (not an ActionResult) is treated as success: keep the value.
  const s = signal(1);
  const result = await optimistic(s, 2, async () => 'done');
  assert.equal(s.get(), 2, 'kept the optimistic value for a non-envelope return');
  assert.equal(result, 'done');
});

test('optimistic: a result with success !== false (e.g. undefined) keeps the value', async () => {
  const s = signal(1);
  // `{ ok: true }` has no `success` key -> not a failure envelope -> success.
  await optimistic(s, 9, async () => ({ ok: true }));
  assert.equal(s.get(), 9, 'absence of success:false is treated as success');
});
