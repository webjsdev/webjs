/**
 * Context protocol: the `@lit/context` contract under `@webjsdev/core/context`.
 *
 * Runs in Node against a tiny bubbling tree (each mock node has a parent and
 * stops at `stopPropagation()`), so the provider / consumer logic is pinned
 * without a DOM. The real-DOM twin is `browser/context-root.test.js`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createContext,
  ContextRequestEvent,
  ContextProviderEvent,
  ContextProvider,
  ContextConsumer,
  ContextRoot,
} from '../../src/context.js';

class MockNode {
  constructor(parent = null) {
    this.parent = parent;
    this.listeners = new Map();
    this.controllers = [];
    this.updates = 0;
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  dispatchEvent(e) {
    for (let n = this; n; n = n.parent) {
      for (const fn of [...(n.listeners.get(e.type) ?? [])]) fn(e);
      if (e.cancelBubble) break;
    }
    return true;
  }
  addController(c) { this.controllers.push(c); }
  requestUpdate() { this.updates++; }
}

/** Connect every controller on `node`, the way a host's connectedCallback does. */
function connect(node) {
  for (const c of node.controllers) c.hostConnected?.();
}
function disconnect(node) {
  for (const c of node.controllers) c.hostDisconnected?.();
}

test('createContext returns the key itself, so the key is the identity', () => {
  assert.equal(createContext('theme'), 'theme');
  assert.equal(createContext('theme'), createContext('theme'));
  const sym = Symbol('theme');
  assert.equal(createContext(sym), sym);
});

test('ContextRequestEvent: (context, contextTarget, callback, subscribe = false)', () => {
  const target = new MockNode();
  const cb = () => {};
  const e = new ContextRequestEvent('ctx', target, cb);
  assert.equal(e.type, 'context-request');
  assert.equal(e.bubbles, true);
  assert.equal(e.composed, true);
  assert.equal(e.context, 'ctx');
  assert.equal(e.contextTarget, target);
  assert.equal(e.callback, cb);
  assert.equal(e.subscribe, false);
  assert.equal(new ContextRequestEvent('ctx', target, cb, true).subscribe, true);
});

test('ContextProviderEvent carries the context and the provider host', () => {
  const host = new MockNode();
  const e = new ContextProviderEvent('ctx', host);
  assert.equal(e.type, 'context-provider');
  assert.equal(e.bubbles && e.composed, true);
  assert.equal(e.contextTarget, host);
});

test('a string key created in two modules matches: provider and consumer meet', () => {
  const root = new MockNode();
  const child = new MockNode(root);
  new ContextProvider(root, { context: createContext('theme'), initialValue: 'dark' });
  const consumer = new ContextConsumer(child, { context: createContext('theme') });
  connect(child);
  assert.equal(consumer.value, 'dark');
  assert.equal(child.updates, 1);
});

test('the provider listens from construction, before its host connects', () => {
  const root = new MockNode();
  const child = new MockNode(root);
  new ContextProvider(root, { context: 'k', initialValue: 1 });
  const consumer = new ContextConsumer(child, { context: 'k' });
  connect(child);
  assert.equal(consumer.value, 1);
});

test('positional forms: ContextProvider(host, context, value), ContextConsumer(host, context, callback, subscribe)', () => {
  const root = new MockNode();
  const child = new MockNode(root);
  const provider = new ContextProvider(root, 'k', 'a');
  const seen = [];
  const consumer = new ContextConsumer(child, 'k', (v) => seen.push(v), true);
  connect(child);
  provider.setValue('b');
  assert.equal(consumer.value, 'b');
  assert.deepEqual(seen, ['a', 'b']);
});

test('subscribe defaults to false: a one-time read that ignores later changes', () => {
  const root = new MockNode();
  const child = new MockNode(root);
  const provider = new ContextProvider(root, { context: 'k', initialValue: 1 });
  const consumer = new ContextConsumer(child, { context: 'k' });
  connect(child);
  provider.setValue(2);
  assert.equal(consumer.value, 1);
  assert.equal(provider.subscriptions.size, 0);
});

test('subscribe: true follows setValue, and setValue with the same value is a no-op', () => {
  const root = new MockNode();
  const child = new MockNode(root);
  const provider = new ContextProvider(root, { context: 'k', initialValue: 1 });
  const consumer = new ContextConsumer(child, { context: 'k', subscribe: true });
  connect(child);
  provider.setValue(2);
  assert.equal(consumer.value, 2);
  const before = child.updates;
  provider.setValue(2);
  assert.equal(child.updates, before);
  provider.setValue(2, true);
  assert.equal(child.updates, before + 1, 'force notifies anyway');
  provider.value = 3;
  assert.equal(consumer.value, 3, 'the value setter notifies too');
});

test('the callback option runs once for a one-time read and on every change when subscribed', () => {
  const root = new MockNode();
  const once = new MockNode(root);
  const sub = new MockNode(root);
  const provider = new ContextProvider(root, { context: 'k', initialValue: 'a' });
  const onceSeen = [];
  const subSeen = [];
  new ContextConsumer(once, { context: 'k', callback: (v) => onceSeen.push(v) });
  new ContextConsumer(sub, { context: 'k', callback: (v) => subSeen.push(v), subscribe: true });
  connect(once);
  connect(sub);
  provider.setValue('b');
  assert.deepEqual(onceSeen, ['a']);
  assert.deepEqual(subSeen, ['a', 'b']);
});

test('the nearest provider answers and stops the event', () => {
  const outer = new MockNode();
  const inner = new MockNode(outer);
  const child = new MockNode(inner);
  new ContextProvider(outer, { context: 'k', initialValue: 'outer' });
  new ContextProvider(inner, { context: 'k', initialValue: 'inner' });
  const consumer = new ContextConsumer(child, { context: 'k' });
  connect(child);
  assert.equal(consumer.value, 'inner');
});

test('a provider ignores requests from its own host, which reads from an ancestor', () => {
  const outer = new MockNode();
  const self = new MockNode(outer);
  new ContextProvider(outer, { context: 'k', initialValue: 'from-ancestor' });
  new ContextProvider(self, { context: 'k', initialValue: 'own' });
  const consumer = new ContextConsumer(self, { context: 'k' });
  consumer.hostConnected();
  assert.equal(consumer.value, 'from-ancestor');
});

test('a provider ignores a different context', () => {
  const root = new MockNode();
  const child = new MockNode(root);
  new ContextProvider(root, { context: 'a', initialValue: 1 });
  const consumer = new ContextConsumer(child, { context: 'b' });
  connect(child);
  assert.equal(consumer.value, undefined);
});

test('hostDisconnected unsubscribes a subscribed consumer', () => {
  const root = new MockNode();
  const child = new MockNode(root);
  const provider = new ContextProvider(root, { context: 'k', initialValue: 1 });
  const consumer = new ContextConsumer(child, { context: 'k', subscribe: true });
  connect(child);
  assert.equal(provider.subscriptions.size, 1);
  disconnect(child);
  assert.equal(provider.subscriptions.size, 0);
  provider.setValue(2);
  assert.equal(consumer.value, 1);
});

test('a provider connecting between an outer provider and a subscriber takes the subscriber over', () => {
  const outer = new MockNode();
  const middle = new MockNode(outer);
  const child = new MockNode(middle);
  const outerProvider = new ContextProvider(outer, { context: 'k', initialValue: 'outer' });
  const consumer = new ContextConsumer(child, { context: 'k', subscribe: true });
  connect(child);
  assert.equal(consumer.value, 'outer');
  const innerProvider = new ContextProvider(middle, { context: 'k', initialValue: 'inner' });
  connect(middle);
  assert.equal(consumer.value, 'inner');
  assert.equal(outerProvider.subscriptions.size, 0, 'the outer provider dropped it');
  assert.equal(innerProvider.subscriptions.size, 1);
  outerProvider.setValue('outer-2');
  assert.equal(consumer.value, 'inner');
});

test('ContextRoot replays a subscribing request once a provider connects', () => {
  const root = new MockNode();
  const providerHost = new MockNode(root);
  const child = new MockNode(providerHost);
  new ContextRoot().attach(root);
  const consumer = new ContextConsumer(child, { context: 'k', subscribe: true });
  connect(child);
  assert.equal(consumer.value, undefined);
  const provider = new ContextProvider(providerHost, { context: 'k', initialValue: 'late' });
  connect(providerHost);
  assert.equal(consumer.value, 'late');
  provider.setValue('later');
  assert.equal(consumer.value, 'later');
});

test('ContextRoot ignores a one-time request, and detach stops it', () => {
  const root = new MockNode();
  const providerHost = new MockNode(root);
  const child = new MockNode(providerHost);
  const ctxRoot = new ContextRoot();
  ctxRoot.attach(root);
  const once = new ContextConsumer(child, { context: 'k' });
  connect(child);
  new ContextProvider(providerHost, { context: 'k', initialValue: 'v' });
  connect(providerHost);
  assert.equal(once.value, undefined);
  ctxRoot.detach(root);
  assert.equal(root.listeners.get('context-request').size, 0);
});
