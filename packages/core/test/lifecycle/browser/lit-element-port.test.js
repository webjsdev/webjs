/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Port of Lit's LitElement suite to WebJs's `WebComponent`, which is both
 * Lit's ReactiveElement and LitElement (it renders an `html` template).
 *
 * Upstream: lit/packages/lit-element/src/test/lit-element_test.ts (lit commit
 * b17fb144). LitElement renders into a shadow root by default, so each
 * element here sets `static shadow = true` unless the test is about the light
 * DOM. Class-field initializers of reactive properties become constructor
 * assignments, as in the reactive-element ports.
 *
 * Not ported:
 *   - "adds a version number" (`window.litElementVersions`, a Lit-only global).
 *
 * Skipped with the reason inline:
 *   - "exceptions in `render` throw but do not prevent further updates": WebJs
 *     routes a throwing render() to its error boundary (renderError()), so
 *     updateComplete resolves; recovery is covered by "throwing render()
 *     routes to renderError() fallback" in lifecycle-port.test.js.
 *   - The two disconnection tests that await a frame after reconnecting: a
 *     WebJs component behaves as Lit's `SignalWatcher(LitElement)` (the
 *     built-in SignalWatcher, /docs/lifecycle), which requests an update on
 *     every reconnect, so the log gains the host's re-render. The first half
 *     of the second one (directives a disconnected host renders start
 *     disconnected and reconnect with it) is asserted by the WebJs test after
 *     it.
 *
 * `stripExpressionComments` (from @lit-labs/testing) becomes `stripComments`,
 * which drops every comment node's markup: these templates author none, so
 * what is left over is the renderer's own markers.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { AsyncDirective, directive } from '../../../src/async-directive.js';
import { ref, createRef } from '../../../src/directives.js';
import { nothing } from '../../../src/sentinels.js';

import { assert } from '../../../../../test/browser-assert.js';

let __ctr = 0;
const tag = () => `lit-el-port-${++__ctr}`;
const SIGNAL_WATCHER = 'WebJs components carry a built-in SignalWatcher, and Lit\'s SignalWatcher requests an update on every reconnect, so the host renders again after reconnecting';
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
/** @param {string} s */
const stripComments = (s) => s.replace(/<!--[^]*?-->/g, '');

suite('LitElement port (lit-element_test.ts)', () => {
  let container;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  teardown(() => {
    if (container && container.parentNode) container.parentNode.removeChild(container);
  });

  test('renders initial content into shadowRoot', async () => {
    const rendered = `hello world`;
    const name = tag();
    customElements.define(name, class extends WebComponent {
      static shadow = true;
      render() { return html`${rendered}`; }
    });
    const el = document.createElement(name);
    container.appendChild(el);
    await new Promise((resolve) => {
      setTimeout(() => {
        assert.ok(el.shadowRoot);
        assert.equal(stripComments(el.shadowRoot.innerHTML), rendered);
        resolve();
      });
    });
  });

  test('can set render target to light dom', async () => {
    const rendered = `hello world`;
    const name = tag();
    customElements.define(name, class extends WebComponent {
      render() { return html`${rendered}`; }
      createRenderRoot() { return this; }
    });
    const el = document.createElement(name);
    container.appendChild(el);
    await el.updateComplete;
    assert.notOk(el.shadowRoot);
    assert.equal(stripComments(el.innerHTML), rendered);
  });

  test('renders when created via constructor', async () => {
    const rendered = `hello world`;
    class E extends WebComponent {
      static shadow = true;
      render() { return html`${rendered}`; }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.ok(el.shadowRoot);
    assert.equal(stripComments(el.shadowRoot.innerHTML), rendered);
  });

  test('updates/renders attributes, properties, and event listeners via `lit-html`', async () => {
    class E extends WebComponent {
      static shadow = true;
      render() {
        const attr = 'attr';
        const prop = 'prop';
        const event = function (e) {
          this._event = e;
        };
        return html`<div attr="${attr}" .prop="${prop}" @zug="${event}"></div>`;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    const d = el.shadowRoot.querySelector('div');
    assert.equal(d.getAttribute('attr'), 'attr');
    assert.equal(d.prop, 'prop');
    const e = new Event('zug');
    d.dispatchEvent(e);
    assert.equal(el._event, e);
  });

  test('event listeners are invoked with the right `this` value', async () => {
    class E extends WebComponent {
      static shadow = true;
      render() { return html`<div @test=${this.onTest}></div>`; }
      onTest(e) { this.event = e; }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    const div = el.shadowRoot.querySelector('div');
    const event = new Event('test');
    div.dispatchEvent(event);
    assert.equal(el.event, event);
  });

  test('can set properties and attributes on sub-element', async () => {
    class E extends WebComponent {
      static shadow = true;
      static get properties() { return { foo: {}, attr: {}, bool: { type: Boolean } }; }
      constructor() { super(); this.foo = 'hi'; this.bool = false; }
      render() { return html`${this.foo}`; }
    }
    customElements.define('x-2448', E);

    class F extends WebComponent {
      static shadow = true;
      inner = null;
      static get properties() { return { bar: {}, bool: { type: Boolean } }; }
      constructor() { super(); this.bar = 'outer'; this.bool = false; }
      render() {
        return html`<x-2448
          .foo="${this.bar}"
          attr="${this.bar}"
          .bool="${this.bool}"
        ></x-2448>`;
      }
      firstUpdated() { this.inner = this.shadowRoot.querySelector('x-2448'); }
      get updateComplete() {
        return super.updateComplete.then(() => this.inner.updateComplete);
      }
    }
    customElements.define(tag(), F);
    const el = new F();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.inner.shadowRoot.textContent, 'outer');
    assert.equal(el.inner.attr, 'outer');
    assert.equal(el.inner.getAttribute('attr'), 'outer');
    assert.equal(el.inner.bool, false);
    el.bar = 'test';
    el.bool = true;
    await el.updateComplete;
    assert.equal(el.inner.shadowRoot.textContent, 'test');
    assert.equal(el.inner.attr, 'test');
    assert.equal(el.inner.getAttribute('attr'), 'test');
    assert.equal(el.inner.bool, true);
  });

  test('event fired during rendering element can trigger an update', async () => {
    class E extends WebComponent {
      static shadow = true;
      connectedCallback() {
        super.connectedCallback();
        this.dispatchEvent(new CustomEvent('foo', { bubbles: true, detail: 'foo' }));
      }
    }
    customElements.define('x-child-61012', E);

    class F extends WebComponent {
      static shadow = true;
      static get properties() { return { foo: { type: String } }; }
      constructor() { super(); this.foo = ''; }
      render() {
        return html`<x-child-61012 @foo=${this._handleFoo}></x-child-61012
          ><span>${this.foo}</span>`;
      }
      _handleFoo(e) { this.foo = e.detail; }
    }
    customElements.define(tag(), F);
    const el = new F();
    container.appendChild(el);
    while (!(await el.updateComplete)) { /* settle */ }
    assert.equal(el.shadowRoot.textContent, 'foo');
  });

  test.skip('exceptions in `render` throw but do not prevent further updates (WebJs error boundary: a throwing render() commits renderError() and updateComplete resolves)', () => {});

  test('if `render` is unimplemented, do not overwrite renderRoot', async () => {
    class A extends WebComponent {
      addedDom = null;
      createRenderRoot() { return this; }
    }
    customElements.define(tag(), A);
    const a = new A();
    const testDom = document.createElement('div');
    a.appendChild(testDom);
    container.appendChild(a);
    await a.updateComplete;
    assert.equal(testDom.parentNode, a, 'testDom should be a child of the component');
  });

  test('can use ReactiveElement', async () => {
    class A extends WebComponent {}
    customElements.define(tag(), A);
    const a = new A();
    container.appendChild(a);
    await a.updateComplete;
    assert.ok(a.hasUpdated);
  });

  test('can customize shadowRootOptions', async () => {
    class A extends WebComponent {
      static shadow = true;
      static shadowRootOptions = { mode: 'closed' };
    }
    customElements.define(tag(), A);
    const a = new A();
    container.appendChild(a);
    await a.updateComplete;
    // Lit's `assert.equal(a.shadowRoot, undefined)` is chai's loose `==`; a
    // closed root reads as `null`.
    assert.equal(a.shadowRoot, null);
  });

  suite('directives', () => {
    suite('disconnection handling', () => {
      let host;
      const log = [];

      const d = directive(
        class extends AsyncDirective {
          render(id) {
            log.push(`render-${id}-${this.isConnected}`);
            return (this.id = id);
          }
          disconnected() { log.push(`disconnect-${this.id}`); }
          reconnected() { log.push(`reconnect-${this.id}`); }
        },
      );

      class Child extends WebComponent {
        static shadow = true;
        static properties = { attr: { type: String }, prop: { type: String } };
        constructor() { super(); this.attr = 'default'; this.prop = 'default'; }
        render() {
          return html`<div attr=${d('child-attr')} .prop=${d('child-prop')}>
            ${d('child-node')}
          </div>`;
        }
        get child() { return this.shadowRoot?.firstElementChild; }
      }
      customElements.define('disc-child', Child);

      class Host extends WebComponent {
        static shadow = true;
        render() {
          return html`<disc-child attr=${d('host-attr')} .prop=${d('host-prop')}
            >${d('host-node')}</disc-child
          >`;
        }
        get child() { return this.shadowRoot.firstElementChild; }
      }
      customElements.define('disc-host', Host);

      const assertRendering = (host) => {
        const child = host.child;
        assert.equal(child.getAttribute('attr'), 'host-attr');
        assert.equal(child.prop, 'host-prop');
        assert.equal(child.textContent?.trim(), 'host-node');
        const grandChild = child.child;
        if (grandChild) {
          assert.equal(grandChild.getAttribute('attr'), 'child-attr');
          assert.equal(grandChild.prop, 'child-prop');
          assert.equal(grandChild.textContent?.trim(), 'child-node');
        }
      };

      setup(() => {
        log.length = 0;
        host = new Host();
      });

      teardown(() => {
        if (host.isConnected) container.removeChild(host);
      });

      test('directives render on connection', async () => {
        container.appendChild(host);
        await nextFrame();
        assertRendering(host);
        assert.deepEqual(log, [
          'render-host-attr-true',
          'render-host-prop-true',
          'render-host-node-true',
          'render-child-attr-true',
          'render-child-prop-true',
          'render-child-node-true',
        ]);
      });

      test('directives disconnect on disconnection', async () => {
        container.appendChild(host);
        await nextFrame();
        assertRendering(host);
        log.length = 0;
        container.removeChild(host);
        assertRendering(host);
        // Note: directive disconnection/reconnection is synchronous to
        // connected/disconnectedCallback
        assert.deepEqual(log, [
          'disconnect-host-attr',
          'disconnect-host-prop',
          'disconnect-host-node',
          'disconnect-child-attr',
          'disconnect-child-prop',
          'disconnect-child-node',
        ]);
      });

      const reconnected = [
        'reconnect-host-attr',
        'reconnect-host-prop',
        'reconnect-host-node',
        'reconnect-child-attr',
        'reconnect-child-prop',
        'reconnect-child-node',
      ];

      test('directives reconnect on reconnection', async () => {
        container.appendChild(host);
        await nextFrame();
        assertRendering(host);
        container.removeChild(host);
        log.length = 0;
        container.appendChild(host);
        assertRendering(host);
        assert.deepEqual(log, reconnected);
      });

      test.skip(`directives reconnect on reconnection (after a frame) (${SIGNAL_WATCHER})`, async () => {
        container.appendChild(host);
        await nextFrame();
        assertRendering(host);
        container.removeChild(host);
        await nextFrame();
        log.length = 0;
        container.appendChild(host);
        await nextFrame();
        assertRendering(host);
        assert.deepEqual(log, reconnected);
      });

      test('directives reconnect and render on reconnection with pending render', async () => {
        container.appendChild(host);
        await nextFrame();
        assertRendering(host);
        container.removeChild(host);
        log.length = 0;
        host.requestUpdate();
        host.child.requestUpdate();
        container.appendChild(host);
        assertRendering(host);
        assert.deepEqual(log, reconnected);
        log.length = 0;
        await nextFrame();
        assertRendering(host);
        assert.deepEqual(log, [
          'render-host-attr-true',
          'render-host-prop-true',
          'render-host-node-true',
          'render-child-attr-true',
          'render-child-prop-true',
          'render-child-node-true',
        ]);
      });

      test.skip(`directives render with isConnected: false if first render is while element is disconnected (${SIGNAL_WATCHER})`, async () => {
        container.appendChild(host);
        container.remove();
        await nextFrame();
        assertRendering(host);
        // Host directives render in an initially disconnected state. Child
        // directives did not render: by the time the host rendered, the child
        // was not connected and is still pending.
        assert.deepEqual(log, [
          'render-host-attr-false',
          'render-host-prop-false',
          'render-host-node-false',
        ]);
        log.length = 0;
        document.body.appendChild(container);
        assertRendering(host);
        // Directive reconnection happens synchronous to connectedCallback
        assert.deepEqual(log, ['reconnect-host-attr', 'reconnect-host-prop', 'reconnect-host-node']);
        log.length = 0;
        // The initial render of the child happens a microtask after the host
        // reconnects, at which point its directives run in the connected state
        await nextFrame();
        assert.deepEqual(log, ['render-child-attr-true', 'render-child-prop-true', 'render-child-node-true']);
      });

      // WebJs: the part of the skipped test above that the reconnect re-render
      // does not touch, through the synchronous reconnection.
      test('directives a disconnected host renders start disconnected and reconnect with it', async () => {
        container.appendChild(host);
        container.remove();
        await nextFrame();
        assertRendering(host);
        assert.deepEqual(log, [
          'render-host-attr-false',
          'render-host-prop-false',
          'render-host-node-false',
        ]);
        log.length = 0;
        document.body.appendChild(container);
        assertRendering(host);
        assert.deepEqual(log, ['reconnect-host-attr', 'reconnect-host-prop', 'reconnect-host-node']);
      });
    });
  });

  test('bind refs between elements', async () => {
    class RefChild extends WebComponent {
      static shadow = true;
      static properties = { bool: {}, ref: {} };
      cb = () => {};
      constructor() {
        super();
        this.bool = false;
        // default ref, should be unused
        this.ref = createRef();
      }
      render() {
        return html` <span>
          ${this.bool
            ? html`<div id="true" ${ref(this.ref)} ${ref(this.cb)}></div>`
            : html`<div id="false" ${ref(this.ref)} ${ref(this.cb)}></div>`}
        </span>`;
      }
      get trueDiv() { return this.shadowRoot.querySelector('#true'); }
      get falseDiv() { return this.shadowRoot.querySelector('#false'); }
    }
    customElements.define('ref-child', RefChild);

    class RefHost extends WebComponent {
      static shadow = true;
      static properties = { bool: { type: Boolean } };
      elRef = createRef();
      el = undefined;
      count = 0;
      elCallback = (el) => {
        this.count++;
        this.el = el;
      };
      constructor() { super(); this.bool = false; }
      render() {
        return html`<ref-child
          .bool=${this.bool}
          .ref=${this.elRef}
          .cb=${this.elCallback}
        ></ref-child>`;
      }
      get child() { return this.shadowRoot.querySelector('ref-child'); }
    }
    customElements.define('x-host', RefHost);

    const host = container.appendChild(new RefHost());
    await host.updateComplete;
    await host.child.updateComplete;
    assert.equal(host.el, host.child.falseDiv);
    assert.equal(host.elRef.value, host.child.falseDiv);
    assert.equal(host.count, 1);

    host.requestUpdate();
    await host.updateComplete;
    assert.equal(host.el, host.child.falseDiv);
    assert.equal(host.elRef.value, host.child.falseDiv);
    assert.equal(host.count, 1);

    host.child.requestUpdate();
    await host.child.updateComplete;
    assert.equal(host.el, host.child.falseDiv);
    assert.equal(host.elRef.value, host.child.falseDiv);
    assert.equal(host.count, 1);

    host.bool = true;
    await host.updateComplete;
    await host.child.updateComplete;
    assert.equal(host.el, host.child.trueDiv);
    assert.equal(host.elRef.value, host.child.trueDiv);
    assert.equal(host.count, 3);
  });

  test('directive as controller can be added/removed via connect/disconnect', async () => {
    const log = [];
    const controllerDirective = directive(
      class extends AsyncDirective {
        render() {
          log.push(`render-${this.host.x}`);
          return nothing;
        }
        ensureHost() {
          if (this.host === undefined) {
            this.host = this.part.options.host;
            this.host.addController(this);
          }
        }
        hostUpdate() { log.push(`hostUpdate-${this.host?.x}`); }
        hostUpdated() { log.push(`hostUpdated-${this.host.x}`); }
        update(part) {
          if (this.part === undefined) this.part = part;
          this.ensureHost();
          this.render();
        }
        disconnected() {
          this.host?.removeController(this);
          this.host = undefined;
        }
        reconnected() { this.ensureHost(); }
      },
    );

    class Host extends WebComponent {
      static shadow = true;
      static properties = { bool: {}, x: {} };
      constructor() {
        super();
        this.bool = true;
        this.x = 0;
      }
      render() {
        return html` ${this.bool ? html`<div ${controllerDirective()}></div>` : nothing}`;
      }
    }
    customElements.define('controller-host', Host);

    const host = container.appendChild(new Host());
    await host.updateComplete;
    assert.deepEqual(log, [`render-${host.x}`, `hostUpdated-${host.x}`]);
    log.length = 0;
    host.x = 1;
    await host.updateComplete;
    assert.deepEqual(log, [`hostUpdate-${host.x}`, `render-${host.x}`, `hostUpdated-${host.x}`]);
    log.length = 0;
    // disconnects directive
    host.bool = false;
    await host.updateComplete;
    assert.deepEqual(log, [`hostUpdate-${host.x}`]);
    log.length = 0;
    // reconnects directive
    host.bool = true;
    await host.updateComplete;
    assert.deepEqual(log, [`render-${host.x}`, `hostUpdated-${host.x}`]);
    // disconnects directive
    log.length = 0;
    host.bool = false;
    await host.updateComplete;
    assert.deepEqual(log, [`hostUpdate-${host.x}`]);
    log.length = 0;
    // render while directive is disconnected
    host.x = 2;
    await host.updateComplete;
    assert.deepEqual(log, []);
    // reconnects directive
    host.bool = true;
    await host.updateComplete;
    assert.deepEqual(log, [`render-${host.x}`, `hostUpdated-${host.x}`]);
  });
});
