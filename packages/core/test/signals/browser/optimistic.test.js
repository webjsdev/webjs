/**
 * Browser test for `optimistic(signal, value, action)` driving a real
 * WebComponent (#246). The acceptance's explicit ask: a server failure reverts
 * the optimistic UI. We render a component that reads a signal, flip it
 * optimistically, and assert the DOM updates instantly, then reverts when the
 * action rejects or returns a `{ success: false }` envelope.
 */
import { html } from '../../../src/html.js';
import { WebComponent, prop } from '../../../src/component.js';
import { signal } from '../../../src/signal.js';
import { optimistic } from '../../../src/optimistic.js';

import { assert } from '../../../../../test/browser-assert.js';
const tick = () => new Promise((r) => setTimeout(r, 0));

suite('optimistic() + WebComponent UI (#246)', () => {
  let nextTag = 0;
  const newTag = () => `opt-card-${++nextTag}`;

  test('optimistic value renders instantly; a thrown action reverts the DOM', async () => {
    const liked = signal(false);
    const T = newTag();
    class C extends WebComponent {
      render() { return html`<span>${liked.get() ? 'liked' : 'not'}</span>`; }
    }
    customElements.define(T, C);
    const el = document.createElement(T);
    document.body.appendChild(el);
    try {
      await el.updateComplete;
      assert.equal(el.querySelector('span').textContent, 'not', 'initial DOM');

      // Optimistically flip; the action will reject (server failure).
      let deferredReject;
      const p = optimistic(liked, true, () => new Promise((_, reject) => { deferredReject = reject; }));

      // Before the action settles the optimistic UI is already on.
      await el.updateComplete;
      assert.equal(el.querySelector('span').textContent, 'liked', 'optimistic UI shown instantly');

      // The server fails: reject the action.
      deferredReject(new Error('500'));
      await p.catch(() => {});
      await el.updateComplete;
      assert.equal(el.querySelector('span').textContent, 'not', 'DOM reverted after server failure');
    } finally {
      el.remove();
    }
  });

  test('a { success: false } envelope reverts the DOM and returns the result', async () => {
    const liked = signal(false);
    const T = newTag();
    class C extends WebComponent {
      render() { return html`<span>${liked.get() ? 'liked' : 'not'}</span>`; }
    }
    customElements.define(T, C);
    const el = document.createElement(T);
    document.body.appendChild(el);
    try {
      await el.updateComplete;
      const result = await optimistic(liked, true, async () => {
        await tick();
        return { success: false, error: 'rate limited' };
      });
      await el.updateComplete;
      assert.equal(el.querySelector('span').textContent, 'not', 'DOM reverted on failure envelope');
      assert.equal(result.error, 'rate limited', 'the failure result is returned to the caller');
    } finally {
      el.remove();
    }
  });

  test('a successful action keeps the optimistic UI', async () => {
    const liked = signal(false);
    const T = newTag();
    class C extends WebComponent({
      todos: prop(Array),
    }) {
      constructor() {
        super();
        this.todos = [];
        this.optTodos = optimistic(this, {
          source: () => this.todos,
          update: (state, title) => [...state, { title, pending: true }],
        });
      }
      render() {
        return html`<ul>${this.optTodos.value.map(t => html`<li class=${t.pending ? 'pending' : ''}>${t.title}</li>`)}</ul>`;
      }
    }
    customElements.define(T, C);
    const el = document.createElement(T);
    document.body.appendChild(el);
    try {
      await el.updateComplete;
      assert.equal(el.querySelectorAll('li').length, 0, 'initial empty list');

      el.optTodos.add('hello');
      await el.updateComplete;
      const items = el.querySelectorAll('li');
      assert.equal(items.length, 1, 'optimistic item rendered');
      assert.ok(items[0].classList.contains('pending'), 'pending class applied');
    } finally {
      el.remove();
    }
  });
});
