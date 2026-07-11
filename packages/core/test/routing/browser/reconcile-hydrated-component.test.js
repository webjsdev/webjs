/**
 * Real-browser regression for #906: the client-router reconciler must not
 * recurse INTO a hydrated component's rendered subtree.
 *
 * The bug: a light-DOM component renders into its own host via the client
 * renderer, which stashes the live template instance (lit-html parts holding
 * DIRECT references to the rendered nodes) on the host under
 * `Symbol.for('webjs.instance')`. On a same-layout soft navigation the router
 * positionally/keyed-matches the live component to the incoming SSR one and
 * calls `diffElementInPlace`, which used to recurse into the children and
 * import/remove/reorder the very nodes the parts point at. After that, the
 * component's next reactive update (a click -> `count++` -> re-render) writes
 * into DETACHED nodes, so nothing reaches the screen: the button looks dead.
 *
 * MUST run in a real browser: the corruption only exists once the element is
 * actually upgraded and has rendered through real lit-html parts, which
 * linkedom does not model. The counterfactual is clean: revert the
 * `isHydratedComponent` guard in `router-client.js` and this test goes red
 * (the post-reconcile click no longer updates the DOM).
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { _diffElementInPlace, _reconcileChildren } from '../../../src/router-client.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

let counter = 0;
function defineLikeButton() {
  const tag = `rc-like-button-${counter++}`;
  class RcLikeButton extends WebComponent({ count: Number }) {
    render() {
      return html`<button @click=${() => this.count++}>heart ${this.count}</button>`;
    }
  }
  customElements.define(tag, RcLikeButton);
  return tag;
}

suite('Client router: reconcile does not corrupt a hydrated component (#906)', () => {
  test('click still increments after the component is reconciled in place', async () => {
    const tag = defineLikeButton();

    // Hydrate a live component: upgrade it and let it render (this is what
    // stashes the live instance + parts on the host).
    const live = document.createElement(tag);
    live.setAttribute('count', '2');
    document.body.appendChild(live);
    await live.updateComplete;
    assert.equal(live.querySelector('button').textContent, 'heart 2', 'first paint');

    // Sanity: the live instance symbol is present (this is what the guard reads).
    assert.ok(live[Symbol.for('webjs.instance')] != null, 'component has a live render instance');

    // Simulate the soft-nav reconcile: an incoming SSR copy of the same
    // component in its initial state, matched against the live one.
    const incoming = document.createElement(tag);
    incoming.setAttribute('count', '2');
    incoming.innerHTML = '<button>heart 2</button>';
    _diffElementInPlace(live, incoming);

    // THE ASSERTION THAT FAILS WITHOUT THE FIX: clicking after the reconcile
    // must still drive the reactive update all the way to the DOM.
    live.querySelector('button').click();
    await live.updateComplete;
    assert.equal(live.querySelector('button').textContent, 'heart 3',
      'click after reconcile must still increment the rendered count');

    live.remove();
  });

  test('reconcile leaves the live component subtree untouched (identity + content)', async () => {
    const tag = defineLikeButton();
    const live = document.createElement(tag);
    live.setAttribute('count', '0');
    document.body.appendChild(live);
    await live.updateComplete;

    // Drive the component's own state forward (user clicked to 5).
    for (let i = 0; i < 5; i++) live.querySelector('button').click();
    await live.updateComplete;
    const liveButton = live.querySelector('button');
    assert.equal(liveButton.textContent, 'heart 5', 'live client state');

    // Incoming SSR still carries the initial state.
    const incoming = document.createElement(tag);
    incoming.setAttribute('count', '0');
    incoming.innerHTML = '<button>heart 0</button>';
    _diffElementInPlace(live, incoming);

    // The router preserved the live subtree: same node identity, live content.
    assert.equal(live.querySelector('button'), liveButton, 'button kept its identity');
    assert.equal(live.querySelector('button').textContent, 'heart 5',
      'live client state was not morphed back to the SSR initial state');

    live.remove();
  });

  test('a hydrated component nested under a reconciled parent survives (#906)', async () => {
    // The common shape: the component sits inside a page/children-slot region
    // that the router reconciles. reconcileChildren -> diffElementInPlace on
    // the component must still leave its internals alone.
    const tag = defineLikeButton();
    const parent = document.createElement('div');
    const live = document.createElement(tag);
    live.setAttribute('count', '1');
    parent.appendChild(live);
    document.body.appendChild(parent);
    await live.updateComplete;

    const src = document.createElement('div');
    const incoming = document.createElement(tag);
    incoming.setAttribute('count', '1');
    incoming.innerHTML = '<button>heart 1</button>';
    src.appendChild(incoming);

    _reconcileChildren(parent, src);

    // Same component instance kept, and it is still interactive.
    const stillLive = parent.querySelector(tag);
    assert.equal(stillLive, live, 'the component instance was reused, not recreated');
    stillLive.querySelector('button').click();
    await stillLive.updateComplete;
    assert.equal(stillLive.querySelector('button').textContent, 'heart 2',
      'nested component still interactive after parent reconcile');

    parent.remove();
  });
});
