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

  test('an interactive component that projects slotted content still clicks after reconcile', async () => {
    // A light-DOM interactive component with a <slot> keeps its live instance
    // symbol on the HOST, so the guard fires and the router leaves its subtree
    // alone. The primary guarantee (interactivity survives) must hold for a
    // slotted component too. Known trade-off (see #906 follow-up): the router
    // no longer re-projects page-authored slotted content of a REUSED
    // interactive component across a soft nav; that is a separate slot-aware
    // reconcile concern, and the pre-fix behaviour here was worse (dead click).
    const tag = `rc-slotted-${counter++}`;
    class RcSlotted extends WebComponent({ on: Boolean }) {
      constructor() { super(); this.on = false; }
      render() {
        return html`<button @click=${() => { this.on = !this.on; }}>t</button><div><slot></slot></div>`;
      }
    }
    customElements.define(tag, RcSlotted);

    const live = document.createElement(tag);
    live.innerHTML = 'SLOTTED';
    document.body.appendChild(live);
    await live.updateComplete;
    assert.ok(live.querySelector('button'), 'renders a button + slot');

    const incoming = document.createElement(tag);
    incoming.innerHTML = 'SLOTTED';
    _diffElementInPlace(live, incoming);

    // Interactivity survives the reconcile: the reactive toggle still updates.
    live.querySelector('button').click();
    await live.updateComplete;
    assert.equal(live.on, true, 'reactive state still updates after reconcile');
    assert.ok(live.querySelector('button'), 'button still present and live');

    live.remove();
  });

  test('a reused interactive component re-projects changed slotted content on soft nav (#908)', async () => {
    // The #908 acceptance bar: a light-DOM interactive component that projects
    // page-authored <slot> content is REUSED (not recreated) across a soft nav
    // that supplies DIFFERENT slotted content. The router must update the
    // projected content AND keep the component interactive. Both assertions
    // together are the bar: the pre-fix behaviour (blanket-skip the subtree)
    // kept interactivity but left the STALE slotted content on screen.
    const tag = `rc-slot-reproject-${counter++}`;
    class RcSlotReproject extends WebComponent({ on: Boolean }) {
      constructor() { super(); this.on = false; }
      render() {
        return html`<button @click=${() => { this.on = !this.on; }}>t</button><div><slot></slot></div>`;
      }
    }
    customElements.define(tag, RcSlotReproject);

    const live = document.createElement(tag);
    live.innerHTML = 'FIRST';
    document.body.appendChild(live);
    await live.updateComplete;
    // Wait a microtask for the slot runtime's batched projection to settle.
    await Promise.resolve();
    assert.equal(live.querySelector('slot').textContent, 'FIRST', 'initial projection');

    // The incoming SSR copy mirrors what render-server emits for a light-DOM
    // slot: `<slot data-webjs-light data-projection="actual">` carrying the
    // NEW page-authored content.
    const incoming = document.createElement(tag);
    incoming.innerHTML =
      '<button>t</button><div><slot data-webjs-light data-projection="actual">SECOND</slot></div>';
    _diffElementInPlace(live, incoming);

    // 1. The projected slotted content updated to the incoming page's content.
    assert.equal(live.querySelector('slot').textContent, 'SECOND',
      'reused component must re-project the incoming slotted content');

    // 2. Interactivity is intact after the reproject (no #906 regression).
    live.querySelector('button').click();
    await live.updateComplete;
    assert.equal(live.on, true, 'reactive state still updates after reproject');

    // 3. A subsequent component re-render must NOT revert to the old content
    //    (the slot runtime's assignment bookkeeping stayed in sync).
    live.on = false;
    await live.updateComplete;
    await Promise.resolve();
    assert.equal(live.querySelector('slot').textContent, 'SECOND',
      're-render must keep the re-projected content, not revert to FIRST');

    live.remove();
  });

  test('re-projects element-bearing slotted content and keeps a nested component live (#908)', async () => {
    // The corruption-risk surface: the slotted content is not plain text but an
    // ELEMENT list including a NESTED hydrated component. Both children are
    // keyed, so reconcileChildren reuses them by identity and only the changed
    // sibling text is updated. The point of this test is the nested path: the
    // reproject must update the sibling AND leave the nested component's own
    // render-owned subtree alone (no #906 regression through the nested path).
    // The real slot-level add/remove path is covered by the next test.
    const innerTag = `rc-inner-${counter++}`;
    class RcInner extends WebComponent({ count: Number }) {
      render() {
        return html`<button @click=${() => this.count++}>n ${this.count}</button>`;
      }
    }
    customElements.define(innerTag, RcInner);

    const outerTag = `rc-outer-${counter++}`;
    class RcOuter extends WebComponent({ on: Boolean }) {
      constructor() { super(); this.on = false; }
      render() {
        return html`<button @click=${() => { this.on = !this.on; }}>o</button><div><slot></slot></div>`;
      }
    }
    customElements.define(outerTag, RcOuter);

    const live = document.createElement(outerTag);
    live.innerHTML =
      `<${innerTag} data-key="i" count="1"></${innerTag}><span data-key="s">OLD</span>`;
    document.body.appendChild(live);
    await live.updateComplete;
    await Promise.resolve();
    const liveInner = live.querySelector(innerTag);
    await liveInner.updateComplete;
    // Drive the nested component's client state forward.
    liveInner.querySelector('button').click();
    await liveInner.updateComplete;
    assert.equal(liveInner.querySelector('button').textContent, 'n 2', 'nested first paint + click');
    assert.equal(live.querySelector('span').textContent, 'OLD', 'initial sibling content');

    // Incoming SSR: same nested component (keyed), CHANGED sibling text.
    const incoming = document.createElement(outerTag);
    incoming.innerHTML =
      `<button>o</button><div><slot data-webjs-light data-projection="actual">` +
      `<${innerTag} data-key="i" count="1"></${innerTag}><span data-key="s">NEW</span></slot></div>`;
    _diffElementInPlace(live, incoming);

    // 1. The changed element sibling re-projected (red without the fix).
    assert.equal(live.querySelector('span').textContent, 'NEW',
      'element-bearing slotted content must re-project the changed sibling');

    // 2. The nested hydrated component kept its identity and live client state
    //    (its render-owned subtree was never reconciled: no #906 regression).
    assert.equal(live.querySelector(innerTag), liveInner, 'nested component reused, not recreated');
    assert.equal(liveInner.querySelector('button').textContent, 'n 2',
      'nested client state (n 2) survived, not morphed back to the SSR count=1');

    // 3. The nested component is still interactive after the reproject.
    liveInner.querySelector('button').click();
    await liveInner.updateComplete;
    assert.equal(liveInner.querySelector('button').textContent, 'n 3',
      'nested component still interactive after the parent reproject');

    live.remove();
  });

  test('re-projects named and default slots independently, first-wins (#908)', async () => {
    // Named + default slots must re-project by NAME without cross-contaminating.
    const tag = `rc-named-${counter++}`;
    class RcNamed extends WebComponent({ on: Boolean }) {
      constructor() { super(); this.on = false; }
      render() {
        return html`<button @click=${() => { this.on = !this.on; }}>b</button>
          <header><slot name="title"></slot></header><main><slot></slot></main>`;
      }
    }
    customElements.define(tag, RcNamed);

    const live = document.createElement(tag);
    live.innerHTML = '<h1 slot="title">OLD TITLE</h1><p>OLD BODY</p>';
    document.body.appendChild(live);
    await live.updateComplete;
    await Promise.resolve();
    assert.equal(live.querySelector('slot[name="title"]').textContent, 'OLD TITLE', 'title slot');
    assert.equal(live.querySelector('main slot').textContent, 'OLD BODY', 'default slot');

    const incoming = document.createElement(tag);
    incoming.innerHTML =
      '<button>b</button>' +
      '<header><slot data-webjs-light data-projection="actual" name="title"><h1 slot="title">NEW TITLE</h1></slot></header>' +
      '<main><slot data-webjs-light data-projection="actual"><p>NEW BODY</p></slot></main>';
    _diffElementInPlace(live, incoming);

    assert.equal(live.querySelector('slot[name="title"]').textContent, 'NEW TITLE',
      'named title slot re-projected');
    assert.equal(live.querySelector('main slot').textContent, 'NEW BODY',
      'default slot re-projected independently, no cross-contamination');

    // Interactivity intact.
    live.querySelector('button').click();
    await live.updateComplete;
    assert.equal(live.on, true, 'reactive state still updates after named-slot reproject');

    live.remove();
  });

  test('re-projects a real slot add/remove and does not stale-revert on re-render (#908)', async () => {
    // This drives the exact path the fix adds bookkeeping for: keyed items that
    // are genuinely ADDED and REMOVED at the slot level (not just reused), so
    // reconcileChildren removes an old node and inserts a new one. The host's
    // async childObserver fires for those mutations; the fix keeps
    // assignedByName/lastSnapshot in sync SYNCHRONOUSLY, so a later component
    // re-render's projection pass must materialise the NEW set, not stale-revert
    // to the old one.
    const tag = `rc-list-${counter++}`;
    class RcList extends WebComponent({ on: Boolean }) {
      constructor() { super(); this.on = false; }
      render() {
        return html`<button @click=${() => { this.on = !this.on; }}>b</button><ul><slot></slot></ul>`;
      }
    }
    customElements.define(tag, RcList);

    const live = document.createElement(tag);
    live.innerHTML = '<li data-key="a">A</li><li data-key="b">B</li>';
    document.body.appendChild(live);
    await live.updateComplete;
    await Promise.resolve();
    assert.equal(live.querySelector('slot').textContent, 'AB', 'initial list projection');

    // Incoming removes A, keeps B, adds C: a genuine slot-level add + remove.
    const incoming = document.createElement(tag);
    incoming.innerHTML =
      '<button>b</button><ul><slot data-webjs-light data-projection="actual">' +
      '<li data-key="b">B</li><li data-key="c">C</li></slot></ul>';
    _diffElementInPlace(live, incoming);

    assert.equal(live.querySelector('slot').textContent, 'BC',
      'slot add/remove re-projected (A removed, C added)');

    // The async childObserver has since fired; a re-render must keep BC, proving
    // assignedByName was synced to the new set (not the stale [A,B]).
    await Promise.resolve();
    live.querySelector('button').click();
    await live.updateComplete;
    await Promise.resolve();
    assert.equal(live.querySelector('slot').textContent, 'BC',
      're-render after a slot add/remove must not stale-revert to the old items');

    live.remove();
  });

  test('re-projects an actual->fallback transition: incoming removed the content (#912)', async () => {
    // The live component projects page-authored content; the incoming nav
    // supplies NONE, so its slot shows fallback. The reused component must flip
    // back to its own compiled fallback (render-owned, restored through the slot
    // runtime, NOT a raw reconcile) rather than keep the stale content.
    const tag = `rc-af-${counter++}`;
    class RcAf extends WebComponent({ on: Boolean }) {
      constructor() { super(); this.on = false; }
      render() {
        return html`<button @click=${() => { this.on = !this.on; }}>b</button><div><slot>FALLBACK</slot></div>`;
      }
    }
    customElements.define(tag, RcAf);

    const live = document.createElement(tag);
    live.innerHTML = 'REAL';
    document.body.appendChild(live);
    await live.updateComplete;
    await Promise.resolve();
    assert.equal(live.querySelector('slot').textContent, 'REAL', 'initial actual projection');
    assert.equal(live.querySelector('slot').getAttribute('data-projection'), 'actual', 'starts actual');

    // Incoming SSR shows the slot as fallback (page authored no content).
    const incoming = document.createElement(tag);
    incoming.innerHTML =
      '<button>b</button><div><slot data-webjs-light data-projection="fallback">FALLBACK</slot></div>';
    _diffElementInPlace(live, incoming);
    await Promise.resolve();

    assert.equal(live.querySelector('slot').textContent, 'FALLBACK',
      'removed content must flip back to the compiled fallback');
    assert.equal(live.querySelector('slot').getAttribute('data-projection'), 'fallback',
      'slot marked fallback after the transition');

    live.querySelector('button').click();
    await live.updateComplete;
    assert.equal(live.on, true, 'reactive state still updates after actual->fallback');

    live.remove();
  });

  test('re-projects a fallback->actual transition: incoming added content (#912)', async () => {
    // The live component shows its fallback (page authored nothing); the incoming
    // nav supplies content. The reused component must project the new page-authored
    // content in place of its fallback.
    const tag = `rc-fa-${counter++}`;
    class RcFa extends WebComponent({ on: Boolean }) {
      constructor() { super(); this.on = false; }
      render() {
        return html`<button @click=${() => { this.on = !this.on; }}>b</button><div><slot>FALLBACK</slot></div>`;
      }
    }
    customElements.define(tag, RcFa);

    const live = document.createElement(tag);
    // No authored children: the slot shows its fallback.
    document.body.appendChild(live);
    await live.updateComplete;
    await Promise.resolve();
    assert.equal(live.querySelector('slot').textContent, 'FALLBACK', 'initial fallback projection');
    assert.equal(live.querySelector('slot').getAttribute('data-projection'), 'fallback', 'starts fallback');

    // Incoming SSR supplies actual content.
    const incoming = document.createElement(tag);
    incoming.innerHTML =
      '<button>b</button><div><slot data-webjs-light data-projection="actual">ADDED</slot></div>';
    _diffElementInPlace(live, incoming);
    await Promise.resolve();

    assert.equal(live.querySelector('slot').textContent, 'ADDED',
      'added content must project in place of the fallback');
    assert.equal(live.querySelector('slot').getAttribute('data-projection'), 'actual',
      'slot marked actual after the transition');

    live.querySelector('button').click();
    await live.updateComplete;
    assert.equal(live.on, true, 'reactive state still updates after fallback->actual');

    live.remove();
  });

  test('a boundary transition must not clobber a nested child component sharing a slot name (#912)', async () => {
    // The corruption risk: the outer component projects an actual->fallback
    // transition on its OWN default slot while a nested light-DOM child (also
    // using a default slot) sits elsewhere in the outer's rendered tree. The
    // transition must touch ONLY the outer's own slot, never the nested child's
    // same-named slot (a whole-host projection would push the child to fallback
    // and detach its render-owned nodes: #906, one level down).
    // A fixed child tag (defined once) so the host can reference it STATICALLY
    // in its render template (an html tag position cannot be a `${}` hole).
    const childTag = 'rc-clobber-child';
    if (!customElements.get(childTag)) {
      class RcChild extends WebComponent({ n: Number }) {
        constructor() { super(); this.n = 0; }
        render() {
          return html`<button @click=${() => this.n++}>c ${this.n}</button><em><slot>childfb</slot></em>`;
        }
      }
      customElements.define(childTag, RcChild);
    }

    const outerTag = `rc-host-${counter++}`;
    // The outer renders its OWN default slot AND embeds a nested child (which has
    // its own default, same-named slot) as a sibling in its render output.
    class RcHost extends WebComponent({ on: Boolean }) {
      constructor() { super(); this.on = false; }
      render() {
        return html`<button @click=${() => { this.on = !this.on; }}>h</button>
          <section><slot>hostfb</slot></section>
          <rc-clobber-child><span>KEEP</span></rc-clobber-child>`;
      }
    }
    customElements.define(outerTag, RcHost);

    const live = document.createElement(outerTag);
    live.innerHTML = 'HOSTREAL';
    document.body.appendChild(live);
    await live.updateComplete;
    await Promise.resolve();
    const liveChild = live.querySelector(childTag);
    await liveChild.updateComplete;
    await Promise.resolve();
    // Drive the nested child's own state so a clobber-to-fallback would be visible.
    liveChild.querySelector('button').click();
    await liveChild.updateComplete;
    assert.equal(live.querySelector('section slot').textContent, 'HOSTREAL', 'outer own slot actual');
    assert.equal(liveChild.querySelector('em slot').textContent, 'KEEP', 'child slot projects its content');
    assert.equal(liveChild.querySelector('button').textContent, 'c 1', 'child client state');

    // Incoming removes the OUTER's slotted content (its own slot -> fallback).
    // The nested child is unchanged (same key/position, same projected content).
    const incoming = document.createElement(outerTag);
    incoming.innerHTML =
      '<button>h</button>' +
      '<section><slot data-webjs-light data-projection="fallback">hostfb</slot></section>' +
      `<${childTag}><span>KEEP</span></${childTag}>`;
    _diffElementInPlace(live, incoming);
    await Promise.resolve();

    // Outer's own slot flipped to fallback.
    assert.equal(live.querySelector('section slot').textContent, 'hostfb',
      'outer own slot flipped to its fallback');

    // The nested child was NOT touched: still the SAME element, still projecting
    // its content (not clobbered to childfb), still interactive.
    assert.equal(live.querySelector(childTag), liveChild, 'nested child reused, not recreated');
    assert.equal(liveChild.querySelector('em slot').textContent, 'KEEP',
      'nested child slot must NOT be clobbered by the outer transition');
    assert.equal(liveChild.querySelector('em slot').getAttribute('data-projection'), 'actual',
      'nested child slot must stay actual');
    liveChild.querySelector('button').click();
    await liveChild.updateComplete;
    assert.equal(liveChild.querySelector('button').textContent, 'c 2',
      'nested child still interactive (its render-owned nodes were never detached)');

    live.remove();
  });
});
