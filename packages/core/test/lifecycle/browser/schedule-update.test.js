/**
 * Lit's update-scheduling members on WebComponent: `hasUpdated`,
 * `isUpdatePending`, `scheduleUpdate()`, `performUpdate()` and
 * `enableUpdating()`. A Lit author overrides `scheduleUpdate()` to delay an
 * update and calls `performUpdate()` to flush one, so both have to be the
 * methods the scheduler really calls.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { assert } from '../../../../../test/browser-assert.js';

let n = 0;
const tag = () => `sched-el-${++n}`;

suite('Lit update scheduling members', () => {
  test('hasUpdated is false through the first render and true after it', async () => {
    /** @type {boolean[]} */
    const seen = [];
    class E extends WebComponent {
      willUpdate() { seen.push(this.hasUpdated); }
      firstUpdated() { seen.push(this.hasUpdated); }
      render() { return html`<p>x</p>`; }
    }
    E.register(tag());
    const el = new E();
    assert.equal(el.hasUpdated, false);
    document.body.append(el);
    await el.updateComplete;
    assert.deepEqual(seen, [false, true]);
    assert.equal(el.hasUpdated, true);
    el.remove();
  });

  test('isUpdatePending is true from requestUpdate until the update runs', async () => {
    class E extends WebComponent({ count: Number }) {
      render() { return html`<p>${this.count}</p>`; }
    }
    E.register(tag());
    const el = new E();
    document.body.append(el);
    assert.equal(el.isUpdatePending, true, 'the first update is queued on connect');
    await el.updateComplete;
    assert.equal(el.isUpdatePending, false);
    el.count = 3;
    assert.equal(el.isUpdatePending, true);
    await el.updateComplete;
    assert.equal(el.isUpdatePending, false);
    el.remove();
  });

  test('an async scheduleUpdate override delays the update and updateComplete waits for it', async () => {
    /** @type {() => void} */
    let release = () => {};
    const gate = new Promise((r) => { release = () => r(undefined); });
    let renders = 0;
    class E extends WebComponent({ count: Number }) {
      async scheduleUpdate() {
        await gate;
        super.scheduleUpdate();
      }
      render() { renders++; return html`<p>${this.count}</p>`; }
    }
    E.register(tag());
    const el = new E();
    el.count = 1;
    document.body.append(el);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(renders, 0, 'the override held the first update');
    let done = false;
    el.updateComplete.then(() => { done = true; });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(done, false);
    release();
    await el.updateComplete;
    assert.equal(renders, 1);
    assert.equal(el.querySelector('p').textContent, '1');
    el.remove();
  });

  test('performUpdate() flushes a pending update synchronously and is a no-op otherwise', async () => {
    let renders = 0;
    class E extends WebComponent({ count: Number }) {
      render() { renders++; return html`<p>${this.count}</p>`; }
    }
    E.register(tag());
    const el = new E();
    document.body.append(el);
    await el.updateComplete;
    const before = renders;
    el.performUpdate();
    assert.equal(renders, before, 'nothing pending, nothing rendered');
    el.count = 7;
    el.performUpdate();
    assert.equal(renders, before + 1);
    assert.equal(el.querySelector('p').textContent, '7');
    await el.updateComplete;
    assert.equal(renders, before + 1, 'the queued microtask found nothing left to do');
    el.remove();
  });

  test('enableUpdating is called on connect, before the first update', async () => {
    /** @type {string[]} */
    const order = [];
    class E extends WebComponent {
      enableUpdating(requested) { order.push(`enable:${requested}`); super.enableUpdating(requested); }
      willUpdate() { order.push('willUpdate'); }
      render() { return html`<p></p>`; }
    }
    E.register(tag());
    const el = new E();
    document.body.append(el);
    await el.updateComplete;
    assert.deepEqual(order, ['enable:true', 'willUpdate']);
    el.remove();
  });

  test('a property set by a controller on connect renders once, not twice', async () => {
    let renders = 0;
    class E extends WebComponent({ count: Number }) {
      constructor() {
        super();
        this.addController({ hostConnected: () => { this.count = 5; } });
      }
      render() { renders++; return html`<p>${this.count}</p>`; }
    }
    E.register(tag());
    const el = new E();
    document.body.append(el);
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(renders, 1);
    assert.equal(el.querySelector('p').textContent, '5');
    el.remove();
  });
});
