/**
 * Which calls a component's render-scoped action signal binds (#1514, #492).
 *
 * The generated RPC stub reads activeActionSignal() synchronously and ties its
 * fetch to it. Only the synchronous part of the component's OWN render() may
 * see that signal. A child that the parent's render creates runs its
 * connectedCallback during the parent's DOM commit, and an action it starts
 * there must not be cancelled by the parent's next render.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { signal } from '../../../src/signal.js';
import { activeActionSignal, setActiveActionSignal } from '../../../src/action-abort-client.js';

const { suite, test } = window.Mocha ? Mocha : { suite, test };
import { assert } from '../../../../../test/browser-assert.js';

let host;
function container() {
  if (host) host.remove();
  host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

suite('render-scoped action signal', () => {
  test('a child\'s connectedCallback action survives the parent\'s next render (#1514)', async () => {
    /** @type {(AbortSignal|undefined)[]} */
    const childSignals = [];
    class Child extends WebComponent {
      connectedCallback() {
        super.connectedCallback();
        childSignals.push(activeActionSignal()); // what the RPC stub would bind
      }
      render() { return html`<span>child</span>`; }
    }
    Child.register('rs-child-a');
    const count = signal(0);
    class Parent extends WebComponent {
      render() {
        const c = count.get();
        // From the second render on, this render's commit creates the child.
        return html`<p>${c}</p>${c === 0 ? '' : html`<rs-child-a></rs-child-a>`}`;
      }
    }
    Parent.register('rs-parent-a');
    const el = document.createElement('rs-parent-a');
    container().appendChild(el);
    await el.updateComplete;

    count.set(1); // this render creates the child
    await el.updateComplete;
    await tick(0);
    assert.equal(childSignals.length, 1, 'the child connected once');
    const bound = childSignals[0];

    count.set(2); // the parent re-renders; the child is reused
    await el.updateComplete;
    await tick(0);
    assert.ok(!bound || !bound.aborted, 'the parent\'s re-render did not abort the child\'s action');
    assert.equal(bound, undefined, 'a connectedCallback call is not bound to any render');
  });

  test('render() still binds its own signal and a superseding render aborts it (#492)', async () => {
    const tag = 'rs-own-b';
    /** @type {(AbortSignal|undefined)[]} */
    const seen = [];
    const v = signal(0);
    class C extends WebComponent {
      render() {
        seen.push(activeActionSignal());
        return html`<p>${v.get()}</p>`;
      }
    }
    C.register(tag);
    const el = document.createElement(tag);
    container().appendChild(el);
    await el.updateComplete;
    v.set(1);
    await el.updateComplete;
    assert.ok(seen[0], 'the first render bound a signal');
    assert.equal(seen[0].aborted, true, 'the next render aborted the previous render\'s signal');
    assert.ok(seen[1] && !seen[1].aborted, 'the current render\'s signal is live');
    assert.equal(activeActionSignal(), undefined, 'nothing stays bound after the render');
  });

  test('a render nested inside an outer binding restores it rather than clearing it', async () => {
    const tag = 'rs-nested-c';
    class C extends WebComponent {
      render() { return html`<p>x</p>`; }
    }
    C.register(tag);
    const outer = new AbortController();
    setActiveActionSignal(outer.signal);
    try {
      const el = document.createElement(tag);
      container().appendChild(el);
      // Drive one render synchronously inside the outer binding, the shape a
      // render nested in another component's synchronous work takes.
      el._performRender();
      assert.equal(activeActionSignal(), outer.signal, 'the outer signal is restored after a nested render');
    } finally {
      setActiveActionSignal(null);
    }
  });
});
