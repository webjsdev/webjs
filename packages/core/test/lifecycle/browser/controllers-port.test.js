/**
 * Port of lit's reactive-element-controllers test suite.
 *
 * Source: packages/reactive-element/src/test/reactive-element-controllers_test.ts
 * in https://github.com/lit/lit.
 *
 * Adapted for webjs's WebComponent. Controllers are duck-typed objects with
 * optional hostConnected / hostDisconnected / hostUpdate / hostUpdated
 * methods, attached via host.addController(controller) / removeController.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  deepEqual: (a, b, msg) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error(msg || `deepEqual failed: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
    }
  },
};

let _uid = 0;
function uniqTag(prefix) {
  _uid++;
  return `${prefix}-${Date.now().toString(36)}-${_uid}`;
}

suite('Reactive controllers (port from lit)', () => {

  class MyController {
    constructor(host) {
      this.host = host;
      this.updateCount = 0;
      this.updatedCount = 0;
      this.connectedCount = 0;
      this.disconnectedCount = 0;
      this.callbackOrder = [];
      this.host.addController(this);
    }
    hostConnected() {
      this.connectedCount++;
      this.callbackOrder.push('hostConnected');
    }
    hostDisconnected() {
      this.disconnectedCount++;
      this.callbackOrder.push('hostDisconnected');
    }
    hostUpdate() {
      this.updateCount++;
      this.callbackOrder.push('hostUpdate');
    }
    hostUpdated() {
      this.updatedCount++;
      this.callbackOrder.push('hostUpdated');
    }
  }

  // Build a fresh host class per test so element-registration is unique and
  // tests are isolated. Returns { ElClass, makeEl } so tests can either
  // construct with `new` (the lit pattern) or via document.createElement.
  function makeHostClass() {
    class A extends WebComponent {
      static properties = { foo: { type: String } };
      constructor() {
        super();
        this.foo = 'foo';
        this.updateCount = 0;
        this.updatedCount = 0;
        this.connectedCount = 0;
        this.disconnectedCount = 0;
        // Lit's pattern uses `controller = new MyController(this)` as a
        // class field. Class fields run after super(), so this is the
        // same point in the constructor.
        this.controller = new MyController(this);
      }
      connectedCallback() {
        this.connectedCount++;
        super.connectedCallback();
        this.controller.callbackOrder.push('connectedCallback');
      }
      disconnectedCallback() {
        this.disconnectedCount++;
        super.disconnectedCallback();
        this.controller.callbackOrder.push('disconnectedCallback');
      }
      update(changedProperties) {
        this.updateCount++;
        super.update(changedProperties);
        this.controller.callbackOrder.push('update');
      }
      firstUpdated() {
        this.controller.callbackOrder.push('firstUpdated');
      }
      updated() {
        this.updatedCount++;
        this.controller.callbackOrder.push('updated');
      }
      render() { return html`<p>${this.foo}</p>`; }
    }
    const tag = uniqTag('rc-host');
    customElements.define(tag, A);
    return { A, tag };
  }

  let container;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  teardown(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  // Helper: create + mount an element with the standard host class. Returns
  // the element with its `controller` field already wired (constructor ran
  // and addController was called).
  async function mountStandardEl() {
    const { tag } = makeHostClass();
    const el = document.createElement(tag);
    container.appendChild(el);
    await el.updateComplete;
    return el;
  }

  test('controllers can implement hostConnected/hostDisconnected', async () => {
    const el = await mountStandardEl();
    assert.equal(el.connectedCount, 1);
    assert.equal(el.disconnectedCount, 0);
    assert.equal(el.controller.connectedCount, 1);
    assert.equal(el.controller.disconnectedCount, 0);
    container.removeChild(el);
    assert.equal(el.connectedCount, 1);
    assert.equal(el.disconnectedCount, 1);
    assert.equal(el.controller.connectedCount, 1);
    assert.equal(el.controller.disconnectedCount, 1);
    container.appendChild(el);
    assert.equal(el.connectedCount, 2);
    assert.equal(el.disconnectedCount, 1);
    assert.equal(el.controller.connectedCount, 2);
    assert.equal(el.controller.disconnectedCount, 1);
  });

  test('controllers can implement hostUpdate/hostUpdated', async () => {
    const el = await mountStandardEl();
    assert.equal(el.updateCount, 1);
    assert.equal(el.updatedCount, 1);
    assert.equal(el.controller.updateCount, 1);
    assert.equal(el.controller.updatedCount, 1);
    el.foo = 'new';
    await el.updateComplete;
    assert.equal(el.updateCount, 2);
    assert.equal(el.updatedCount, 2);
    assert.equal(el.controller.updateCount, 2);
    assert.equal(el.controller.updatedCount, 2);
  });

  test('controllers can be removed', async () => {
    const el = await mountStandardEl();
    assert.equal(el.controller.connectedCount, 1);
    assert.equal(el.controller.disconnectedCount, 0);
    assert.equal(el.controller.updateCount, 1);
    assert.equal(el.controller.updatedCount, 1);
    el.removeController(el.controller);
    el.foo = 'new';
    await el.updateComplete;
    el.remove();
    assert.equal(el.controller.connectedCount, 1);
    assert.equal(el.controller.disconnectedCount, 0);
    assert.equal(el.controller.updateCount, 1);
    assert.equal(el.controller.updatedCount, 1);
  });

  test('controllers callback order', async () => {
    const el = await mountStandardEl();
    // webjs defers the first render to a microtask after connectedCallback
    // returns, matching lit's reactive-element schedule. The subclass's
    // connectedCallback body pushes 'connectedCallback' before any render
    // hooks fire; the microtask then runs hostUpdate / update / hostUpdated
    // / firstUpdated / updated.
    assert.deepEqual(el.controller.callbackOrder, [
      'hostConnected',
      'connectedCallback',
      'hostUpdate',
      'update',
      'hostUpdated',
      'firstUpdated',
      'updated',
    ]);
    el.controller.callbackOrder = [];
    el.foo = 'new';
    await el.updateComplete;
    assert.deepEqual(el.controller.callbackOrder, [
      'hostUpdate',
      'update',
      'hostUpdated',
      'updated',
    ]);
    el.controller.callbackOrder = [];
    container.removeChild(el);
    assert.deepEqual(el.controller.callbackOrder, [
      'hostDisconnected',
      'disconnectedCallback',
    ]);
  });

  test('controllers added after element is first connected call hostConnected', async () => {
    const el = await mountStandardEl();
    const controller = new MyController(el);
    assert.equal(controller.connectedCount, 1);
    assert.equal(controller.disconnectedCount, 0);
    container.removeChild(el);
    assert.equal(controller.disconnectedCount, 1);
    container.appendChild(el);
    assert.equal(controller.connectedCount, 2);
    assert.equal(controller.disconnectedCount, 1);
  });

  test('controllers added on an upgraded element call hostConnected once', async () => {
    // Create the element BEFORE its class is registered, then upgrade.
    const { A } = makeHostClass();
    class B extends A {}
    const tag = uniqTag('rc-upgraded');
    const el = document.createElement(tag);
    container.appendChild(el);
    customElements.define(tag, B);
    await el.updateComplete;
    assert.equal(el.controller.connectedCount, 1);
    assert.equal(el.controller.disconnectedCount, 0);
    container.removeChild(el);
    assert.equal(el.controller.disconnectedCount, 1);
    container.appendChild(el);
    assert.equal(el.controller.connectedCount, 2);
    assert.equal(el.controller.disconnectedCount, 1);
  });

  test('controllers can be removed during lifecycle', async () => {
    const el = await mountStandardEl();
    class RemovingController {
      constructor(host) {
        this.host = host;
        this.updatedCount = 0;
        this.host.addController(this);
      }
      hostUpdated() {
        this.updatedCount++;
        this.host.removeController(this);
      }
    }
    const removingController = new RemovingController(el);
    const controller = new MyController(el);
    assert.equal(el.controller.updatedCount, 1);
    assert.equal(removingController.updatedCount, 0);
    assert.equal(controller.updatedCount, 0);
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(el.controller.updatedCount, 2);
    assert.equal(removingController.updatedCount, 1);
    assert.equal(controller.updatedCount, 1);
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(el.controller.updatedCount, 3);
    assert.equal(removingController.updatedCount, 1);
    assert.equal(controller.updatedCount, 2);
  });

  test('controllers can add other controllers during lifecycle', async () => {
    const el = await mountStandardEl();
    class AddingController {
      constructor(host) {
        this.host = host;
        this.updateCount = 0;
        this.controllers = undefined;
        this.host.addController(this);
      }
      hostUpdate() {
        this.updateCount++;
        (this.controllers ??= []).push(new MyController(this.host));
      }
    }
    const addingController = new AddingController(el);
    const controller = new MyController(el);
    assert.equal(el.controller.updatedCount, 1);
    assert.equal(addingController.updateCount, 0);
    assert.equal(controller.updateCount, 0);
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(el.controller.updateCount, 2);
    assert.equal(addingController.updateCount, 1);
    assert.equal(addingController.controllers && addingController.controllers.length, 1);
    assert.equal(addingController.controllers[0].updateCount, 1);
    assert.equal(controller.updateCount, 1);
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(el.controller.updateCount, 3);
    assert.equal(addingController.updateCount, 2);
    assert.equal(addingController.controllers.length, 2);
    assert.equal(addingController.controllers[0].updateCount, 2);
    assert.equal(addingController.controllers[1].updateCount, 1);
    assert.equal(controller.updateCount, 2);
  });

  // Additional coverage beyond the lit suite: hooks fire on multiple
  // controllers in registration order.
  test('multiple controllers: all hooks fire in registration order', async () => {
    const order = [];
    function makeTracking(name) {
      return {
        hostConnected() { order.push(`${name}:hostConnected`); },
        hostUpdate() { order.push(`${name}:hostUpdate`); },
        hostUpdated() { order.push(`${name}:hostUpdated`); },
        hostDisconnected() { order.push(`${name}:hostDisconnected`); },
      };
    }
    class MultiEl extends WebComponent {
      render() { return html`<p>ok</p>`; }
    }
    const tag = uniqTag('rc-multi');
    customElements.define(tag, MultiEl);
    const el = document.createElement(tag);
    const a = makeTracking('a');
    const b = makeTracking('b');
    const c = makeTracking('c');
    el.addController(a);
    el.addController(b);
    el.addController(c);
    container.appendChild(el);
    await el.updateComplete;
    // hostConnected fires for a, b, c in order, then hostUpdate triplet,
    // then hostUpdated triplet.
    assert.deepEqual(order.slice(0, 9), [
      'a:hostConnected', 'b:hostConnected', 'c:hostConnected',
      'a:hostUpdate', 'b:hostUpdate', 'c:hostUpdate',
      'a:hostUpdated', 'b:hostUpdated', 'c:hostUpdated',
    ]);
    order.length = 0;
    el.remove();
    assert.deepEqual(order, [
      'a:hostDisconnected', 'b:hostDisconnected', 'c:hostDisconnected',
    ]);
  });

  // Controller's requestUpdate(name, oldValue) propagates to host's
  // changedProperties (controllers commonly call host.requestUpdate).
  test('controller requestUpdate(name, oldValue) propagates to changedProperties', async () => {
    const seen = [];
    class PropEl extends WebComponent {
      static properties = { foo: { type: String } };
      constructor() { super(); this.foo = 'x'; }
      updated(cp) {
        // Snapshot a plain object so the recorded values can't change later.
        const entries = {};
        for (const [k, v] of cp.entries()) entries[k] = v;
        seen.push(entries);
      }
      render() { return html`<p>${this.foo}</p>`; }
    }
    const tag = uniqTag('rc-prop');
    customElements.define(tag, PropEl);
    const el = document.createElement(tag);
    container.appendChild(el);
    await el.updateComplete;
    // Initial render: entries for foo (initial undefined -> 'x')
    // Now a controller mutates a property and requests update via host.
    const ctl = {
      host: el,
      bump() {
        const old = this.host.foo;
        this.host.foo = 'y';
        // The setter calls requestUpdate(name, oldValue) automatically,
        // but a controller might also call host.requestUpdate(name, oldValue)
        // for a virtual property. Exercise that path too.
        this.host.requestUpdate('virtual', 'before');
      },
    };
    el.addController(ctl);
    ctl.bump();
    await el.updateComplete;
    const last = seen[seen.length - 1];
    assert.equal(last.foo, 'x', 'old value of foo recorded in changedProperties');
    assert.equal(last.virtual, 'before', 'virtual prop entry recorded');
  });

  // host.addController during connectedCallback (the controller is added
  // while the host is already connected) should call hostConnected once.
  test('addController during connectedCallback fires hostConnected once', async () => {
    let connectedFires = 0;
    const ctl = { hostConnected() { connectedFires++; } };
    class LateEl extends WebComponent {
      connectedCallback() {
        super.connectedCallback();
        this.addController(ctl);
      }
      render() { return html`<p>ok</p>`; }
    }
    const tag = uniqTag('rc-late');
    customElements.define(tag, LateEl);
    const el = document.createElement(tag);
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(connectedFires, 1);
  });
});
