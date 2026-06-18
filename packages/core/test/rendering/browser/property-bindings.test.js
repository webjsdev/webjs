/**
 * Real-browser hydration of SSR-emitted data-webjs-prop-* attributes.
 * Runs via WTR + Playwright in actual Chromium so we catch real DOM
 * semantics (attribute case normalization, custom-element upgrade
 * timing, MutationObserver behaviour) that linkedom doesn't replicate.
 *
 * Companion to test/client-property-bindings.test.js (linkedom unit
 * tests for the same hydration logic).
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { stringify } from '../../../src/serialize.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
  deepEqual: (a, b, msg) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error(msg || `deepEqual failed: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
    }
  },
  isArray: (v, msg) => { if (!Array.isArray(v)) throw new Error(msg || `Expected array, got ${typeof v}`); },
};

// Each test owns a uniquely-tagged component so registrations do not
// collide across tests in the same suite. customElements.define throws
// on re-registration in real browsers (unlike linkedom).

suite('SSR property-binding hydration in a real browser', () => {

  test('simple Array prop: SSR markup, browser upgrades, property applied, attribute stripped', async () => {
    class PostListProbe extends WebComponent({ posts: Array }) {
      constructor() { super(); this.posts = []; }
      render() { return html`<ul>${this.posts.map((p) => html`<li>${p.title}</li>`)}</ul>`; }
    }
    customElements.define('br-post-list-1', PostListProbe);

    const data = [{ title: 'one' }, { title: 'two' }, { title: 'three' }];
    const encoded = await stringify(data);

    // Construct the element WITH the attribute already set, before
    // upgrade triggers connectedCallback. Mirrors the SSR-then-parse
    // sequence the browser sees from network HTML.
    const host = document.createElement('div');
    // setAttribute with quoted JSON works in real DOM (unlike linkedom).
    host.innerHTML = `<br-post-list-1 data-webjs-prop-posts='${encoded.replace(/'/g, '&#39;')}'></br-post-list-1>`;
    document.body.appendChild(host);

    // Upgrade is synchronous in modern Chromium after define + connection.
    const el = host.querySelector('br-post-list-1');
    assert.ok(el, 'element exists');
    assert.isArray(el.posts, 'posts is the decoded Array');
    assert.equal(el.posts.length, 3);
    assert.equal(el.posts[1].title, 'two');
    assert.ok(!el.hasAttribute('data-webjs-prop-posts'), 'attribute stripped post-hydration');

    host.remove();
  });

  test('rich types: Date and BigInt survive the wire serializer in a real browser', async () => {
    class RichProbe extends WebComponent({ when: Object, big: Object }) {
      constructor() { super(); this.when = null; this.big = null; }
      render() { return html`<p>x</p>`; }
    }
    customElements.define('br-rich-probe-1', RichProbe);

    const when = new Date('2025-08-12T00:00:00Z');
    const big = BigInt('9007199254740993');
    const whenAttr = (await stringify(when)).replace(/'/g, '&#39;');
    const bigAttr = (await stringify(big)).replace(/'/g, '&#39;');

    const host = document.createElement('div');
    host.innerHTML =
      `<br-rich-probe-1 ` +
      `data-webjs-prop-when='${whenAttr}' ` +
      `data-webjs-prop-big='${bigAttr}'></br-rich-probe-1>`;
    document.body.appendChild(host);

    const el = host.querySelector('br-rich-probe-1');
    assert.ok(el.when instanceof Date, 'Date round-tripped as a real Date');
    assert.equal(el.when.getUTCFullYear(), 2025);
    assert.equal(typeof el.big, 'bigint', 'BigInt round-tripped as a real bigint');
    assert.equal(el.big.toString(), '9007199254740993');
    assert.ok(!el.hasAttribute('data-webjs-prop-when'));
    assert.ok(!el.hasAttribute('data-webjs-prop-big'));

    host.remove();
  });

  test('kebab-case attribute maps back to camelCase property in a real browser', async () => {
    class CamelProbe extends WebComponent({ itemCount: Number }) {
      constructor() { super(); this.itemCount = 0; }
      render() { return html`<p>${this.itemCount}</p>`; }
    }
    customElements.define('br-camel-probe-1', CamelProbe);

    const host = document.createElement('div');
    host.innerHTML = `<br-camel-probe-1 data-webjs-prop-item-count="42"></br-camel-probe-1>`;
    document.body.appendChild(host);

    const el = host.querySelector('br-camel-probe-1');
    assert.equal(el.itemCount, 42);
    assert.ok(!el.hasAttribute('data-webjs-prop-item-count'));

    host.remove();
  });

  test('multiple props on one element: all decoded, all stripped', async () => {
    class MultiProbe extends WebComponent({
      a: Number,
      b: String,
      c: Object,
    }) {
      constructor() { super(); this.a = 0; this.b = ''; this.c = null; }
      render() { return html`<p>${this.a}|${this.b}|${this.c && this.c.k}</p>`; }
    }
    customElements.define('br-multi-probe-1', MultiProbe);

    const cAttr = (await stringify({ k: 'value' })).replace(/'/g, '&#39;');
    const host = document.createElement('div');
    host.innerHTML =
      `<br-multi-probe-1 ` +
      `data-webjs-prop-a="1" data-webjs-prop-b='"hi"' data-webjs-prop-c='${cAttr}'>` +
      `</br-multi-probe-1>`;
    document.body.appendChild(host);

    const el = host.querySelector('br-multi-probe-1');
    assert.equal(el.a, 1);
    assert.equal(el.b, 'hi');
    assert.equal(el.c.k, 'value');
    assert.ok(!el.hasAttribute('data-webjs-prop-a'));
    assert.ok(!el.hasAttribute('data-webjs-prop-b'));
    assert.ok(!el.hasAttribute('data-webjs-prop-c'));

    host.remove();
  });

  test('upgrade order: element exists in DOM BEFORE customElements.define is called', async () => {
    // Realistic SSR-then-late-script scenario: browser parses HTML and
    // creates the element as HTMLUnknownElement. The component module
    // loads asynchronously and calls customElements.define, which
    // upgrades existing elements. connectedCallback fires after the
    // upgrade. Hydration must still apply the prop attribute.
    const host = document.createElement('div');
    host.innerHTML = `<br-late-define-1 data-webjs-prop-val="99"></br-late-define-1>`;
    document.body.appendChild(host);

    // Element is currently HTMLUnknownElement, attribute is present.
    const before = host.querySelector('br-late-define-1');
    assert.ok(before.hasAttribute('data-webjs-prop-val'));

    // Late definition. Triggers upgrade.
    class LateProbe extends WebComponent({ val: Number }) {
      constructor() { super(); this.val = 0; }
      render() { return html`<p>${this.val}</p>`; }
    }
    customElements.define('br-late-define-1', LateProbe);

    // Wait for upgrade + connectedCallback. customElements.upgrade is
    // synchronous in modern Chromium, but allow a microtask just in case.
    await Promise.resolve();

    const after = host.querySelector('br-late-define-1');
    assert.equal(after.val, 99, 'late-defined element still hydrated correctly');
    assert.ok(!after.hasAttribute('data-webjs-prop-val'), 'attribute stripped after upgrade');

    host.remove();
  });

  test('two siblings of the same custom-element class: each hydrates independently', async () => {
    class SiblingProbe extends WebComponent({ label: String }) {
      constructor() { super(); this.label = ''; }
      render() { return html`<p>${this.label}</p>`; }
    }
    customElements.define('br-sibling-probe-1', SiblingProbe);

    const host = document.createElement('div');
    host.innerHTML =
      `<br-sibling-probe-1 data-webjs-prop-label='"first"'></br-sibling-probe-1>` +
      `<br-sibling-probe-1 data-webjs-prop-label='"second"'></br-sibling-probe-1>`;
    document.body.appendChild(host);

    const both = host.querySelectorAll('br-sibling-probe-1');
    assert.equal(both.length, 2);
    assert.equal(both[0].label, 'first');
    assert.equal(both[1].label, 'second');
    assert.ok(!both[0].hasAttribute('data-webjs-prop-label'));
    assert.ok(!both[1].hasAttribute('data-webjs-prop-label'));

    host.remove();
  });

  test('property is preserved after element is moved in the DOM (no re-hydration)', async () => {
    class MoveProbe extends WebComponent({ val: Number }) {
      constructor() { super(); this.val = 0; }
      render() { return html`<p>${this.val}</p>`; }
    }
    customElements.define('br-move-probe-1', MoveProbe);

    const sourceHost = document.createElement('div');
    sourceHost.innerHTML = `<br-move-probe-1 data-webjs-prop-val="7"></br-move-probe-1>`;
    document.body.appendChild(sourceHost);

    const el = sourceHost.querySelector('br-move-probe-1');
    assert.equal(el.val, 7);
    // User code mutates the live value after hydration completed.
    el.val = 88;

    // Move the element to a different parent. Triggers disconnect + reconnect.
    const targetHost = document.createElement('section');
    document.body.appendChild(targetHost);
    targetHost.appendChild(el);

    // Second connectedCallback fires. The hydration guard must keep the
    // live value (88), not re-read a stripped attribute or revert.
    assert.equal(el.val, 88, 'live value survives reconnect; no re-hydration');

    sourceHost.remove();
    targetHost.remove();
  });
});
