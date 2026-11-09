/**
 * Context protocol in a real DOM: Lit-shaped providers and consumers on
 * WebComponents, a string key matching across "modules", a consumer inside a
 * shadow root, a nearer provider taking a subscriber over, and `ContextRoot`
 * replaying a request whose provider upgraded late.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import {
  createContext,
  ContextProvider,
  ContextConsumer,
  ContextRoot,
} from '../../../src/context.js';

import { assert } from '../../../../../test/browser-assert.js';

let _uid = 0;
const uniqTag = (p) => `${p}-${Date.now().toString(36)}-${++_uid}`;

/** A provider element for `key`, with its provider exposed as `.provider`. */
function defineProvider(key, initialValue) {
  class P extends WebComponent {
    provider = new ContextProvider(this, { context: createContext(key), initialValue });
    render() { return html`<slot></slot>`; }
  }
  const tag = uniqTag('ctx-provider');
  P.register(tag);
  return tag;
}

/** A consumer element for `key`. */
function defineConsumer(key, { subscribe = false, shadow = false } = {}) {
  class C extends WebComponent {
    static shadow = shadow;
    consumer = new ContextConsumer(this, { context: createContext(key), subscribe });
    render() { return html`<span>${this.consumer.value ?? 'none'}</span>`; }
  }
  const tag = uniqTag('ctx-consumer');
  C.register(tag);
  return tag;
}

const text = (el) => (el.shadowRoot ?? el).querySelector('span').textContent;

suite('Context protocol in the DOM (Lit parity)', () => {
  let container;
  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  teardown(() => container.remove());

  test('a string key defined twice still matches, and subscribe follows setValue', async () => {
    const key = `theme-${++_uid}`;
    const p = defineProvider(key, 'light');
    const c = defineConsumer(key, { subscribe: true });
    container.innerHTML = `<${p}><${c}></${c}></${p}>`;
    const provider = container.firstElementChild;
    // Light-DOM slot capture places the child on the provider's first render.
    await provider.updateComplete;
    const consumer = provider.querySelector(c);
    await consumer.updateComplete;
    assert.equal(text(consumer), 'light');
    provider.provider.setValue('dark');
    await consumer.updateComplete;
    assert.equal(text(consumer), 'dark');
  });

  test('the default one-time read ignores later changes', async () => {
    const key = `once-${++_uid}`;
    const p = defineProvider(key, 1);
    const c = defineConsumer(key);
    container.innerHTML = `<${p}><${c}></${c}></${p}>`;
    const provider = container.firstElementChild;
    // Light-DOM slot capture places the child on the provider's first render.
    await provider.updateComplete;
    const consumer = provider.querySelector(c);
    await consumer.updateComplete;
    provider.provider.setValue(2);
    await consumer.updateComplete;
    assert.equal(text(consumer), '1');
  });

  test('a request from inside a shadow root reaches the provider (composed)', async () => {
    const key = Symbol('shadow-key');
    const p = defineProvider(key, 'through-shadow');
    const c = defineConsumer(key, { subscribe: true, shadow: true });
    class Wrapper extends WebComponent {
      static shadow = true;
      render() { return html`<div></div>`; }
    }
    const w = uniqTag('ctx-wrap');
    Wrapper.register(w);
    container.innerHTML = `<${p}><${w}></${w}></${p}>`;
    await container.firstElementChild.updateComplete;
    const wrapper = container.querySelector(w);
    await wrapper.updateComplete;
    const consumer = document.createElement(c);
    wrapper.shadowRoot.querySelector('div').appendChild(consumer);
    await consumer.updateComplete;
    assert.equal(text(consumer), 'through-shadow');
  });

  test('ContextRoot replays a subscribing request once a late provider upgrades', async () => {
    const key = `late-${++_uid}`;
    const ctxRoot = new ContextRoot();
    ctxRoot.attach(container);
    const c = defineConsumer(key, { subscribe: true });
    const p = uniqTag('ctx-late');
    // The provider's tag is not defined yet, so its element stays un-upgraded
    // while the consumer connects and asks.
    container.innerHTML = `<${p}><${c}></${c}></${p}>`;
    const consumer = container.querySelector(c);
    await consumer.updateComplete;
    assert.equal(text(consumer), 'none');
    // Shadow DOM, so upgrading the provider never re-parents the consumer
    // (a light-DOM slot capture would reconnect it, and the fresh request
    // would reach the provider without ContextRoot's help).
    class Late extends WebComponent {
      static shadow = true;
      provider = new ContextProvider(this, { context: key, initialValue: 'arrived' });
      render() { return html`<slot></slot>`; }
    }
    Late.register(p);
    await container.querySelector(p).updateComplete;
    await consumer.updateComplete;
    assert.equal(text(consumer), 'arrived');
    ctxRoot.detach(container);
  });
});
