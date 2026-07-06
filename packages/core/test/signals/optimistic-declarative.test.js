import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimistic } from '../../src/optimistic.js';

// Mock component host
class MockHost {
  constructor() {
    this.updateCount = 0;
    this.controllers = [];
  }
  requestUpdate() {
    this.updateCount++;
  }
  addController(c) {
    this.controllers.push(c);
  }
  removeController(c) {
    this.controllers = this.controllers.filter(x => x !== c);
  }
}

test('declarative optimistic: tracks source value initially', () => {
  const host = new MockHost();
  let todos = ['a', 'b'];
  const opt = optimistic(host, {
    source: () => todos,
    update: (state, payload) => [...state, payload],
  });

  assert.deepEqual(opt.value, ['a', 'b']);
  assert.equal(host.updateCount, 0);
});

test('declarative optimistic: manual add and release cycles', () => {
  const host = new MockHost();
  let todos = ['a', 'b'];
  const opt = optimistic(host, {
    source: () => todos,
    update: (state, payload) => [...state, payload],
  });

  const release = opt.add('c');
  assert.deepEqual(opt.value, ['a', 'b', 'c']);
  assert.equal(host.updateCount, 1, 'schedules render on add');

  // source state updates in the background
  todos = ['a', 'b', 'real-c'];

  release();
  assert.deepEqual(opt.value, ['a', 'b', 'real-c'], 'reverts to new source state after release');
  assert.equal(host.updateCount, 2, 'schedules render on release');
});

test('declarative optimistic: default reducer replaces state directly', () => {
  const host = new MockHost();
  let count = 0;
  const opt = optimistic(host, {
    source: () => count,
  });

  assert.equal(opt.value, 0);
  const release = opt.add(42);
  assert.equal(opt.value, 42);

  count = 1;
  release();
  assert.equal(opt.value, 1);
});

test('declarative optimistic: auto-releases when a Promise resolves', async () => {
  const host = new MockHost();
  let todos = ['a', 'b'];
  const opt = optimistic(host, {
    source: () => todos,
    update: (state, payload) => [...state, payload],
  });

  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  opt.add('c', promise);
  assert.deepEqual(opt.value, ['a', 'b', 'c']);
  assert.equal(host.updateCount, 1);

  // simulate server action completing and source state updating
  todos = ['a', 'b', 'real-c'];
  resolvePromise({ success: true });

  await promise;
  // wait for microtask tick for .finally() to execute
  await new Promise(r => setTimeout(r, 0));

  assert.deepEqual(opt.value, ['a', 'b', 'real-c'], 'auto-reverted once promise resolved');
  assert.equal(host.updateCount, 2);
});

test('declarative optimistic: auto-releases when a Promise rejects', async () => {
  const host = new MockHost();
  let todos = ['a', 'b'];
  const opt = optimistic(host, {
    source: () => todos,
    update: (state, payload) => [...state, payload],
  });

  let rejectPromise;
  const promise = new Promise((_, reject) => {
    rejectPromise = reject;
  });

  opt.add('c', promise);
  assert.deepEqual(opt.value, ['a', 'b', 'c']);

  rejectPromise(new Error('fail'));

  await promise.catch(() => {});
  await new Promise(r => setTimeout(r, 0));

  assert.deepEqual(opt.value, ['a', 'b'], 'reverted after promise rejection');
  assert.equal(host.updateCount, 2);
});

test('declarative optimistic: concurrent updates fold in order', () => {
  const host = new MockHost();
  let todos = ['a'];
  const opt = optimistic(host, {
    source: () => todos,
    update: (state, payload) => [...state, payload],
  });

  const r1 = opt.add('b');
  const r2 = opt.add('c');

  assert.deepEqual(opt.value, ['a', 'b', 'c'], 'both updates applied');
  assert.equal(host.updateCount, 2);

  r1();
  assert.deepEqual(opt.value, ['a', 'c'], 'first update released, second remains');
  assert.equal(host.updateCount, 3);

  r2();
  assert.deepEqual(opt.value, ['a'], 'all updates released');
  assert.equal(host.updateCount, 4);
});

test('declarative optimistic: handles host lacking requestUpdate method', () => {
  const host = {}; // no requestUpdate method
  let val = 'a';
  const opt = optimistic(host, { source: () => val });

  assert.equal(opt.value, 'a');
  const release = opt.add('b');
  assert.equal(opt.value, 'b');

  release();
  assert.equal(opt.value, 'a');
});

test('declarative optimistic: handles thenables lacking finally method', async () => {
  const host = new MockHost();
  let val = 'a';
  const opt = optimistic(host, { source: () => val });

  // Custom thenable without finally
  let resolveThenable;
  const thenable = {
    then(onFulfilled, onRejected) {
      return new Promise((resolve) => {
        resolveThenable = resolve;
      }).then(onFulfilled, onRejected);
    }
  };

  opt.add('b', thenable);
  assert.equal(opt.value, 'b');

  resolveThenable();
  // wait for microtasks
  await new Promise(r => setTimeout(r, 0));

  assert.equal(opt.value, 'a', 'auto-released using fallback then()');
});

