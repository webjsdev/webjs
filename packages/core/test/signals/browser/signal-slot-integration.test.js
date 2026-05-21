/**
 * Integration tests for signals + light-DOM slot projection. Covers
 * the combinations that the individual signal-hydration and slot
 * suites don't exercise directly.
 *
 *   - Signal inside a NAMED slot's content
 *   - Signal-driven conditional that toggles whether a child is
 *     slotted at all
 *   - watch() directive inside a slotted child while the host
 *     component is also reading another signal
 *   - Signal + slot fallback content (no children authored,
 *     fallback is shown; signal change does not disturb fallback)
 *   - Signal-driven host that re-renders the slot shape while
 *     authored children stay alive in state
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { signal, computed } from '../../../src/signal.js';
import { watch } from '../../../src/directives.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

suite('signal + light-DOM slot integration', () => {
  let nextTag = 0;
  const newTag = (base) => `${base}-sigslot-${++nextTag}`;

  test('signal-driven content inside a NAMED slot survives host re-render', async () => {
    const heading = signal('First');
    const Child = newTag('sig-named-child');
    const Shell = newTag('sig-named-shell');

    class ChildEl extends WebComponent {
      render() { return html`<h1>${heading.get()}</h1>`; }
    }
    customElements.define(Child, ChildEl);

    class ShellEl extends WebComponent {
      static properties = { tick: { type: Number } };
      constructor() { super(); this.tick = 0; }
      render() {
        return html`<section data-tick=${this.tick}>
          <header><slot name="title"></slot></header>
          <main><slot></slot></main>
        </section>`;
      }
    }
    customElements.define(Shell, ShellEl);

    const shell = document.createElement(Shell);
    const titled = document.createElement(Child);
    titled.setAttribute('slot', 'title');
    const body = document.createElement(Child);
    shell.append(titled, body);
    document.body.appendChild(shell);
    await shell.updateComplete;

    const titleSlot = shell.querySelector('header slot[name="title"]');
    const defaultSlot = shell.querySelector('main slot:not([name])');
    assert.ok(titleSlot, 'named slot rendered');
    assert.ok(defaultSlot, 'default slot rendered');
    assert.equal(shell.querySelectorAll('h1').length, 2);

    // Mutate the signal: both slotted children re-render.
    heading.set('Second');
    await Promise.resolve(); await Promise.resolve();
    const headings = [...shell.querySelectorAll('h1')].map(h => h.textContent);
    assert.equal(headings[0], 'Second');
    assert.equal(headings[1], 'Second');

    // Force a host re-render via the reactive property.
    shell.tick = 1;
    await shell.updateComplete;
    assert.equal(shell.querySelector('section').getAttribute('data-tick'), '1');
    // Slotted children should still be in their slots with the
    // up-to-date heading value.
    const after = [...shell.querySelectorAll('h1')].map(h => h.textContent);
    assert.equal(after.length, 2);
    assert.equal(after[0], 'Second');
    assert.equal(after[1], 'Second');

    shell.remove();
  });

  test('signal-driven conditional toggles whether a child is slotted at all', async () => {
    // Parent re-renders so its inner shell custom element appears
    // with or without an authored child between its tags. Before the
    // slot-projection cycle fix, the parent's replaceChildren was
    // captured by the shell's MutationObserver as authored content,
    // and projection then tried to nest the shell inside its own
    // <slot>. The fix filters framework-driven records, so this case
    // now reads cleanly.
    const showChild = signal(false);

    class IntShellEl extends WebComponent {
      render() { return html`<section class="int-shell"><slot></slot></section>`; }
    }
    customElements.define('intg-shell', IntShellEl);

    class IntChildEl extends WebComponent {
      render() { return html`<i class="int-child">child rendered</i>`; }
    }
    customElements.define('intg-child', IntChildEl);

    class IntParentEl extends WebComponent {
      render() {
        return showChild.get()
          ? html`<intg-shell><intg-child></intg-child></intg-shell>`
          : html`<intg-shell></intg-shell>`;
      }
    }
    customElements.define('intg-parent', IntParentEl);

    const root = document.createElement('intg-parent');
    document.body.appendChild(root);
    await root.updateComplete;
    assert.equal(root.querySelectorAll('intg-child').length, 0, 'child not authored initially');

    showChild.set(true);
    await Promise.resolve(); await Promise.resolve();
    await root.updateComplete;
    await Promise.resolve(); await Promise.resolve();
    assert.equal(root.querySelectorAll('intg-child').length, 1, 'child appears');
    assert.equal(root.querySelectorAll('i.int-child').length, 1, 'child renders through projection');

    showChild.set(false);
    await Promise.resolve(); await Promise.resolve();
    await root.updateComplete;
    await Promise.resolve(); await Promise.resolve();
    assert.equal(root.querySelectorAll('intg-child').length, 0, 'child gone when signal flips back');

    root.remove();
  });

  test('signal-driven content swap inside a slot host re-renders, projection preserves identity', async () => {
    // A slot host whose own render reads a signal but keeps the slot
    // shape stable. Signal change re-renders the host; authored
    // children stay alive in state and re-project into the same slot.
    const counter = signal(0);
    const T = newTag('sig-cond');
    class ShellElCond extends WebComponent {
      render() {
        return html`<section data-counter=${counter.get()}>
          <slot></slot>
        </section>`;
      }
    }
    customElements.define(T, ShellElCond);

    const shell = document.createElement(T);
    const child = document.createElement('p');
    child.id = 'projected-child';
    child.textContent = 'authored';
    shell.appendChild(child);
    document.body.appendChild(shell);
    await shell.updateComplete;
    const childRef = shell.querySelector('#projected-child');
    assert.ok(childRef, 'child projected on first render');
    assert.equal(shell.querySelector('section').getAttribute('data-counter'), '0');

    counter.set(1);
    await Promise.resolve(); await Promise.resolve();
    await shell.updateComplete;
    assert.equal(shell.querySelector('section').getAttribute('data-counter'), '1');
    const childRef2 = shell.querySelector('#projected-child');
    assert.ok(childRef2, 'child still present after signal-driven re-render');
    assert.ok(childRef2 === childRef, 'DOM identity preserved');

    counter.set(2);
    await Promise.resolve(); await Promise.resolve();
    await shell.updateComplete;
    assert.equal(shell.querySelector('section').getAttribute('data-counter'), '2');
    assert.ok(shell.querySelector('#projected-child') === childRef, 'identity survives two re-renders');

    shell.remove();
  });

  test('watch() directive in slotted child + parent reading its own signal', async () => {
    const childCount = signal(0);
    const parentMode = signal('idle');

    const Child = newTag('sig-watch-child');
    const Parent = newTag('sig-watch-parent');

    class ChildEl extends WebComponent {
      render() {
        // Fine-grained binding: watch() updates the hole without
        // re-running this render.
        return html`<span data-role="count">${watch(childCount)}</span>`;
      }
    }
    customElements.define(Child, ChildEl);

    class ParentEl extends WebComponent {
      render() {
        // Parent reads parentMode via .get() (host re-renders on change).
        return html`<section data-mode=${parentMode.get()}>
          <slot></slot>
        </section>`;
      }
    }
    customElements.define(Parent, ParentEl);

    const parent = document.createElement(Parent);
    const child = document.createElement(Child);
    parent.appendChild(child);
    document.body.appendChild(parent);
    await parent.updateComplete;

    assert.equal(parent.querySelector('section').getAttribute('data-mode'), 'idle');
    assert.equal(parent.querySelector('[data-role="count"]').textContent, '0');

    // Mutate childCount: only the child's watch hole updates, parent
    // does NOT re-render (data-mode stays 'idle' even though we don't
    // re-run parent's render).
    childCount.set(7);
    await Promise.resolve(); await Promise.resolve();
    assert.equal(parent.querySelector('[data-role="count"]').textContent, '7');
    assert.equal(parent.querySelector('section').getAttribute('data-mode'), 'idle');

    // Mutate parentMode: parent re-renders. Slotted child stays alive
    // through projection (DOM identity preserved); its watch binding
    // continues to track childCount.
    const beforeChild = parent.querySelector('[data-role="count"]');
    parentMode.set('busy');
    await parent.updateComplete;
    await Promise.resolve();
    const afterChild = parent.querySelector('[data-role="count"]');
    assert.equal(parent.querySelector('section').getAttribute('data-mode'), 'busy');
    assert.ok(afterChild, 'child still present after parent re-render');
    assert.equal(afterChild.textContent, '7');

    // childCount changes after the parent re-render still work
    // (watch directive's subscription survived).
    childCount.set(42);
    await Promise.resolve(); await Promise.resolve();
    assert.equal(parent.querySelector('[data-role="count"]').textContent, '42');

    parent.remove();
  });

  test('signal change does not disturb slot fallback content', async () => {
    const tick = signal(0);
    const Shell = newTag('sig-fallback-shell');

    class ShellEl extends WebComponent {
      render() {
        return html`<div data-tick=${tick.get()}>
          <slot><em>default-fallback</em></slot>
        </div>`;
      }
    }
    customElements.define(Shell, ShellEl);

    // Mount with NO authored children -> fallback shows.
    const shell = document.createElement(Shell);
    document.body.appendChild(shell);
    await shell.updateComplete;
    assert.equal(shell.querySelector('em').textContent, 'default-fallback');

    // Tick the signal; host re-renders. Fallback content should
    // re-materialise (the renderer keeps a fresh fallback fragment
    // per instance).
    tick.set(1);
    await Promise.resolve(); await Promise.resolve();
    await shell.updateComplete;
    assert.equal(shell.querySelector('div').getAttribute('data-tick'), '1');
    assert.ok(shell.querySelector('em'), 'fallback present after re-render');
    assert.equal(shell.querySelector('em').textContent, 'default-fallback');

    shell.remove();
  });

  test('signal re-render of host preserves projected child identity', async () => {
    const tick = signal(0);
    const Parent = newTag('sig-id-parent');

    class ParentEl extends WebComponent {
      render() {
        return html`<section data-tick=${tick.get()}>
          <slot></slot>
        </section>`;
      }
    }
    customElements.define(Parent, ParentEl);

    const parent = document.createElement(Parent);
    const child = document.createElement('p');
    child.textContent = 'i-am-stable';
    child.setAttribute('id', 'stable');
    parent.appendChild(child);
    document.body.appendChild(parent);
    await parent.updateComplete;
    const ref = parent.querySelector('#stable');
    assert.ok(ref);

    // Force parent re-render through the signal.
    tick.set(1);
    await Promise.resolve(); await Promise.resolve();
    await parent.updateComplete;
    assert.equal(parent.querySelector('section').getAttribute('data-tick'), '1');
    const ref2 = parent.querySelector('#stable');
    assert.ok(ref2 === ref, 'projected child DOM identity preserved across host re-render');

    parent.remove();
  });
});
