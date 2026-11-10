/**
 * Task timing in a real element, the `@lit/task` order: `autoRun: true` runs
 * from `hostUpdate` (so the PENDING state is in the same render), the result
 * re-renders the host, `'afterUpdate'` runs after the DOM commit, and a moved
 * (disconnected then reconnected) host keeps its run.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { Task, TaskStatus } from '../../../src/task.js';

import { assert } from '../../../../../test/browser-assert.js';

let _uid = 0;
const uniqTag = (p) => `${p}-${Date.now().toString(36)}-${++_uid}`;
const settle = () => new Promise((r) => setTimeout(r, 0));

suite('Task timing (Lit parity)', () => {
  let container;
  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  teardown(() => container.remove());

  test('autoRun true: the first render already shows PENDING, then COMPLETE', async () => {
    const renders = [];
    let release;
    class El extends WebComponent({ uid: Number }) {
      constructor() { super(); this.uid = 7; }
      task = new Task(this, {
        task: ([uid]) => new Promise((r) => { release = () => r(`user ${uid}`); }),
        args: () => [this.uid],
      });
      render() {
        renders.push(this.task.status);
        return html`<p>${this.task.render({ pending: () => 'loading', complete: (v) => v })}</p>`;
      }
    }
    const tag = uniqTag('task-timing');
    El.register(tag);
    const el = document.createElement(tag);
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(renders[0], TaskStatus.PENDING);
    assert.equal(el.querySelector('p').textContent, 'loading');
    release();
    await el.task.taskComplete;
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'user 7');
  });

  test('a property change re-runs the task with the new args array', async () => {
    const seen = [];
    class El extends WebComponent({ q: String }) {
      constructor() { super(); this.q = 'a'; }
      task = new Task(this, {
        task: async ([q]) => { seen.push(q); return q.toUpperCase(); },
        args: () => [this.q],
      });
      render() { return html`<p>${this.task.value ?? ''}</p>`; }
    }
    const tag = uniqTag('task-args');
    El.register(tag);
    const el = document.createElement(tag);
    container.appendChild(el);
    await el.updateComplete;
    await el.task.taskComplete;
    el.q = 'b';
    await el.updateComplete;
    await el.task.taskComplete;
    await el.updateComplete;
    assert.deepEqual(seen, ['a', 'b']);
    assert.equal(el.querySelector('p').textContent, 'B');
  });

  test("'afterUpdate' runs after the commit, so the task can read rendered DOM", async () => {
    let sawDom;
    class El extends WebComponent {
      task = new Task(this, {
        task: async () => { sawDom = this.querySelector('span')?.textContent; return 1; },
        args: () => [],
        autoRun: 'afterUpdate',
      });
      render() { return html`<span>rendered</span>`; }
    }
    const tag = uniqTag('task-after');
    El.register(tag);
    const el = document.createElement(tag);
    container.appendChild(el);
    await el.updateComplete;
    await settle();
    await el.task.taskComplete;
    assert.equal(sawDom, 'rendered');
  });

  test('moving the host does not abort its run (Lit has no hostDisconnected)', async () => {
    let release;
    let aborted = false;
    class El extends WebComponent {
      task = new Task(this, {
        task: (_a, { signal }) => {
          signal.addEventListener('abort', () => { aborted = true; });
          return new Promise((r) => { release = () => r('kept'); });
        },
        args: () => [],
      });
      render() { return html`<p>${this.task.value ?? ''}</p>`; }
    }
    const tag = uniqTag('task-move');
    El.register(tag);
    const el = document.createElement(tag);
    container.appendChild(el);
    await el.updateComplete;
    const other = document.createElement('div');
    container.appendChild(other);
    other.appendChild(el);
    release();
    await el.task.taskComplete;
    await el.updateComplete;
    assert.equal(aborted, false);
    assert.equal(el.querySelector('p').textContent, 'kept');
  });
});
