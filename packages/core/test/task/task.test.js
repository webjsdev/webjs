/**
 * Task controller: the `@lit/task` contract under `@webjsdev/core/task`.
 *
 * Each case pins a behaviour Lit's Task has, so a component written from Lit
 * memory gets the same result: the args ARRAY as the first argument, both
 * constructor forms, `taskComplete`, `initialValue`, `initialState`,
 * `argsEqual`, `onComplete` / `onError`, `abort(reason)`, and the three
 * `autoRun` modes. Plus the WebJs-only rule that a task never runs at SSR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TaskStatus,
  Task,
  initialState,
  shallowArrayEquals,
  deepArrayEquals,
  deepEquals,
} from '../../src/task.js';

function createMockHost() {
  const controllers = [];
  let updateCount = 0;
  return {
    requestUpdate() { updateCount++; },
    addController(c) { controllers.push(c); },
    get controllers() { return controllers; },
    get updateCount() { return updateCount; },
  };
}

/**
 * Run `fn` with a stubbed `globalThis.window` so the auto-run path executes
 * in Node. Auto-run is gated on `typeof window !== 'undefined'` so the task
 * function never fires during SSR.
 */
async function withBrowser(fn) {
  const had = 'window' in globalThis;
  const prev = globalThis.window;
  globalThis.window = /** @type {any} */ ({});
  try {
    await fn();
  } finally {
    if (had) globalThis.window = prev;
    else delete globalThis.window;
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test('TaskStatus values match Lit', () => {
  assert.deepEqual({ ...TaskStatus }, { INITIAL: 0, PENDING: 1, COMPLETE: 2, ERROR: 3 });
});

test('starts INITIAL and registers itself as a controller', () => {
  const host = createMockHost();
  const task = new Task(host, { task: async () => {} });
  assert.equal(task.status, TaskStatus.INITIAL);
  assert.equal(task.value, undefined);
  assert.equal(task.error, undefined);
  assert.equal(task.autoRun, true);
  assert.deepEqual(host.controllers, [task]);
});

test('the task function receives the args ARRAY, not spread arguments', async () => {
  const host = createMockHost();
  let received;
  const task = new Task(host, {
    task: async (args, options) => { received = { args, options }; },
    args: () => ['x', 42],
    autoRun: false,
  });
  await task.run();
  assert.deepEqual(received.args, ['x', 42]);
  assert.ok(received.options.signal instanceof AbortSignal);
});

test('a destructured single arg reads the value, the Lit idiom', async () => {
  const host = createMockHost();
  const task = new Task(host, {
    task: async ([attempt]) => `attempt ${attempt}`,
    args: () => [3],
    autoRun: false,
  });
  await task.run();
  assert.equal(task.value, 'attempt 3');
});

test('positional form new Task(host, taskFn, argsFn)', async () => {
  const host = createMockHost();
  const task = new Task(host, async ([a, b]) => a + b, () => [2, 3]);
  await task.run();
  assert.equal(task.status, TaskStatus.COMPLETE);
  assert.equal(task.value, 5);
});

test('a missing task function throws a fix message', () => {
  assert.throws(() => new Task(createMockHost(), {}), /needs a task function/);
});

test('run(args) overrides args() for that run and records them', async () => {
  const host = createMockHost();
  const seen = [];
  const task = new Task(host, {
    task: async (args) => { seen.push(args); },
    args: () => ['from-args-fn'],
    autoRun: false,
  });
  await task.run(['explicit']);
  assert.deepEqual(seen, [['explicit']]);
});

test('args() returning a non-array throws', async () => {
  const task = new Task(createMockHost(), { task: async () => 1, args: () => 'nope', autoRun: false });
  await assert.rejects(() => task.run(), /must return an array/);
});

test('run() goes PENDING then COMPLETE and requests an update for each', async () => {
  const host = createMockHost();
  const statuses = [];
  const task = new Task(host, {
    task: async () => { statuses.push(task.status); return 'done'; },
    autoRun: false,
  });
  await task.run();
  assert.deepEqual(statuses, [TaskStatus.PENDING]);
  assert.equal(task.status, TaskStatus.COMPLETE);
  assert.equal(task.value, 'done');
  assert.equal(host.updateCount, 2);
});

test('a throw lands as ERROR and run() itself never rejects', async () => {
  const task = new Task(createMockHost(), {
    task: async () => { throw new Error('boom'); },
    autoRun: false,
  });
  await task.run();
  assert.equal(task.status, TaskStatus.ERROR);
  assert.equal(task.error.message, 'boom');
  assert.equal(task.value, undefined);
});

test('returning initialState puts the task back into INITIAL', async () => {
  const task = new Task(createMockHost(), { task: async () => initialState, autoRun: false });
  await task.run();
  assert.equal(task.status, TaskStatus.INITIAL);
});

test('initialValue starts COMPLETE and records the args so it does not run', async () => {
  await withBrowser(async () => {
    let calls = 0;
    const task = new Task(createMockHost(), {
      task: async () => { calls++; return 'fresh'; },
      args: () => [1],
      initialValue: 'seeded',
    });
    assert.equal(task.status, TaskStatus.COMPLETE);
    assert.equal(task.value, 'seeded');
    task.hostUpdate();
    await tick();
    assert.equal(calls, 0, 'unchanged args do not run');
  });
});

test('taskComplete resolves with the value of the pending run', async () => {
  let release;
  const task = new Task(createMockHost(), {
    task: () => new Promise((r) => { release = r; }),
    autoRun: false,
  });
  const run = task.run();
  const done = task.taskComplete;
  release('v');
  assert.equal(await done, 'v');
  await run;
  assert.equal(await task.taskComplete, 'v', 'a settled task resolves straight away');
});

test('taskComplete rejects with the error', async () => {
  const task = new Task(createMockHost(), { task: async () => { throw new Error('bad'); }, autoRun: false });
  const run = task.run();
  await assert.rejects(task.taskComplete, /bad/);
  await run;
});

test('taskComplete before any run resolves with the initial value', async () => {
  const task = new Task(createMockHost(), { task: async () => 1, autoRun: false });
  assert.equal(await task.taskComplete, undefined);
});

test('onComplete and onError are called, and a throw from them is swallowed', async () => {
  const log = [];
  const ok = new Task(createMockHost(), {
    task: async () => 'yes',
    onComplete: (v) => { log.push(['complete', v]); throw new Error('ignored'); },
    autoRun: false,
  });
  await ok.run();
  const bad = new Task(createMockHost(), {
    task: async () => { throw new Error('no'); },
    onError: (e) => log.push(['error', e.message]),
    autoRun: false,
  });
  await bad.run();
  assert.deepEqual(log, [['complete', 'yes'], ['error', 'no']]);
  assert.equal(ok.status, TaskStatus.COMPLETE);
});

test('a newer run supersedes an older one, aborting its signal', async () => {
  const signals = [];
  const resolvers = [];
  const task = new Task(createMockHost(), {
    task: (_args, { signal }) => {
      signals.push(signal);
      return new Promise((r) => resolvers.push(r));
    },
    autoRun: false,
  });
  const first = task.run();
  const second = task.run();
  assert.equal(signals[0].aborted, true);
  resolvers[1]('second');
  resolvers[0]('first');
  await Promise.all([first, second]);
  assert.equal(task.value, 'second');
});

test('abort(reason) aborts the pending run with that reason, and the rejection is ERROR', async () => {
  let seen;
  const task = new Task(createMockHost(), {
    task: (_args, { signal }) => new Promise((_r, reject) => {
      signal.addEventListener('abort', () => { seen = signal.reason; reject(signal.reason); });
    }),
    autoRun: false,
  });
  const run = task.run();
  task.abort('stop');
  await run;
  assert.equal(seen, 'stop');
  assert.equal(task.status, TaskStatus.ERROR);
  assert.equal(task.error, 'stop');
});

test('abort() when nothing is pending is a no-op', () => {
  const task = new Task(createMockHost(), { task: async () => 1, autoRun: false });
  task.abort();
  assert.equal(task.status, TaskStatus.INITIAL);
});

test('the task has no hostDisconnected, so removing the host does not abort it (Lit)', () => {
  const task = new Task(createMockHost(), { task: async () => 1 });
  assert.equal(typeof task.hostDisconnected, 'undefined');
});

test('render() picks the callback for the status, missing ones render undefined', async () => {
  const task = new Task(createMockHost(), { task: async () => 'v', autoRun: false });
  const r = {
    initial: () => 'I', pending: () => 'P', complete: (v) => `C:${v}`, error: (e) => `E:${e}`,
  };
  assert.equal(task.render(r), 'I');
  const run = task.run();
  assert.equal(task.render(r), 'P');
  await run;
  assert.equal(task.render(r), 'C:v');
  assert.equal(task.render({}), undefined);
});

test('autoRun true runs in hostUpdate when args change, compared with Object.is', async () => {
  await withBrowser(async () => {
    let calls = 0;
    let arg = NaN;
    const task = new Task(createMockHost(), {
      task: async () => { calls++; },
      args: () => [arg],
    });
    task.hostUpdate();
    await tick();
    assert.equal(calls, 1);
    task.hostUpdate();
    await tick();
    assert.equal(calls, 1, 'NaN equals NaN under Object.is');
    arg = 1;
    task.hostUpdate();
    await tick();
    assert.equal(calls, 2);
    task.hostUpdated();
    await tick();
    assert.equal(calls, 2, 'hostUpdated does nothing for autoRun true');
  });
});

test("autoRun 'afterUpdate' runs from hostUpdated, never hostUpdate", async () => {
  await withBrowser(async () => {
    let calls = 0;
    const task = new Task(createMockHost(), {
      task: async () => { calls++; },
      args: () => [1],
      autoRun: 'afterUpdate',
    });
    task.hostUpdate();
    await tick();
    assert.equal(calls, 0);
    task.hostUpdated();
    await tick();
    assert.equal(calls, 1);
  });
});

test('autoRun false never runs on its own, and autoRun can be flipped later', async () => {
  await withBrowser(async () => {
    let calls = 0;
    const task = new Task(createMockHost(), {
      task: async () => { calls++; },
      args: () => [1],
      autoRun: false,
    });
    task.hostUpdate();
    await tick();
    assert.equal(calls, 0);
    task.autoRun = true;
    task.hostUpdate();
    await tick();
    assert.equal(calls, 1);
  });
});

test('a task with no args function never auto-runs', async () => {
  await withBrowser(async () => {
    let calls = 0;
    const task = new Task(createMockHost(), { task: async () => { calls++; } });
    task.hostUpdate();
    await tick();
    assert.equal(calls, 0);
  });
});

test('a custom argsEqual decides whether args changed', async () => {
  await withBrowser(async () => {
    let calls = 0;
    let obj = { id: 1 };
    const task = new Task(createMockHost(), {
      task: async () => { calls++; },
      args: () => [obj],
      argsEqual: deepArrayEquals,
    });
    task.hostUpdate();
    await tick();
    obj = { id: 1 };
    task.hostUpdate();
    await tick();
    assert.equal(calls, 1, 'a structurally equal fresh object does not re-run');
    obj = { id: 2 };
    task.hostUpdate();
    await tick();
    assert.equal(calls, 2);
  });
});

test('hostUpdate never runs the task server-side (no window)', async () => {
  assert.equal(typeof globalThis.window, 'undefined');
  let calls = 0;
  const task = new Task(createMockHost(), { task: async () => { calls++; }, args: () => [1] });
  task.hostUpdate();
  task.hostUpdated();
  await tick();
  assert.equal(calls, 0);
  assert.equal(task.status, TaskStatus.INITIAL);
});

test('shallowArrayEquals / deepArrayEquals / deepEquals', () => {
  assert.equal(shallowArrayEquals([1, 'a'], [1, 'a']), true);
  assert.equal(shallowArrayEquals([{}], [{}]), false);
  assert.equal(shallowArrayEquals([0], [-0]), false);
  assert.equal(deepArrayEquals([{ a: [1, 2] }], [{ a: [1, 2] }]), true);
  assert.equal(deepArrayEquals([{ a: 1 }], [{ a: 2 }]), false);
  assert.equal(deepEquals(new Date(5), new Date(5)), true);
  assert.equal(deepEquals(new Map([['k', 1]]), new Map([['k', 1]])), true);
  assert.equal(deepEquals(new Set([1, 2]), new Set([2, 1])), true);
  assert.equal(deepEquals(/a/g, /a/g), true);
  assert.equal(deepEquals(/a/g, /a/i), false);
  assert.equal(deepEquals([1], { 0: 1 }), false, 'different constructors are never equal');
});
