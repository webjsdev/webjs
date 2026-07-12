/**
 * Reproducer for the slot-projection cycle bug:
 *
 *     HierarchyRequestError: Failed to execute 'appendChild' on 'Node':
 *     The new child element contains the parent.
 *
 * Two scenarios are known to trigger it (both surfaced when I tried to
 * land integration tests for signals + slot interaction):
 *
 *   1. A parent custom element's render conditionally outputs a slot
 *      host with a nested child. Flipping the condition re-renders
 *      the parent, which swaps in a NEW slot-host element containing
 *      a child as authored content. Projection on the new slot host
 *      then throws.
 *
 *   2. A slot host's own render swaps between two different shapes
 *      around the slot (e.g. compact `<section><slot></slot></section>`
 *      vs expanded `<section><header>...</header><slot></slot></section>`).
 *      Authored children stay alive on the host; projection should
 *      re-target the new slot. It throws instead.
 *
 * Both cases are valid webjs use, both currently fail. This file is
 * the failing reference; flip the wrapper test back to `test(...)`
 * once the bug is fixed.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { signal } from '../../../src/signal.js';

import { assert } from '../../../../../test/browser-assert.js';

suite('slot projection cycle (regression)', () => {
  let nextTag = 0;
  const newTag = (base) => `${base}-cycle-${++nextTag}`;

  test('parent re-render swaps in a new slot host with nested authored child', async () => {
    const showChild = signal(false);
    const Shell = newTag('cycle-shell');
    const Child = newTag('cycle-child');
    const Parent = newTag('cycle-parent');

    class ShellEl extends WebComponent {
      render() { return html`<section><slot></slot></section>`; }
    }
    customElements.define(Shell, ShellEl);

    class ChildEl extends WebComponent {
      render() { return html`<i>child</i>`; }
    }
    customElements.define(Child, ChildEl);

    // Static tag literals at the JS-template level. The Parent class
    // is generated once, after the inner classes are defined, so we
    // can splice the tag names into a Function constructor without
    // dynamic interpolation inside the `html` template.
    const ParentFactory = new Function(
      'html', 'WebComponent', 'showChild',
      `class ParentEl extends WebComponent {
         render() {
           return showChild.get()
             ? html\`<${Shell}><${Child}></${Child}></${Shell}>\`
             : html\`<${Shell}></${Shell}>\`;
         }
       }
       return ParentEl;`
    );
    const ParentEl = ParentFactory(html, WebComponent, showChild);
    customElements.define(Parent, ParentEl);

    const root = document.createElement(Parent);
    document.body.appendChild(root);
    await root.updateComplete;
    assert.equal(root.querySelectorAll('i').length, 0);

    showChild.set(true);
    await Promise.resolve(); await Promise.resolve();
    await root.updateComplete;
    await Promise.resolve(); await Promise.resolve();
    assert.equal(root.querySelectorAll('i').length, 1, 'child renders through projection');

    showChild.set(false);
    await Promise.resolve(); await Promise.resolve();
    await root.updateComplete;
    await Promise.resolve(); await Promise.resolve();
    assert.equal(root.querySelectorAll('i').length, 0, 'child gone when signal flips back');

    root.remove();
  });

  test('slot host re-renders with a different wrapper shape around its slot', async () => {
    const expanded = signal(false);
    const T = newTag('cycle-wrap');
    class ShellEl extends WebComponent {
      render() {
        return expanded.get()
          ? html`<section class="expanded"><header>BIG</header><slot></slot></section>`
          : html`<section class="compact"><slot></slot></section>`;
      }
    }
    customElements.define(T, ShellEl);

    const shell = document.createElement(T);
    const child = document.createElement('p');
    child.id = 'projected-child';
    child.textContent = 'authored';
    shell.appendChild(child);
    document.body.appendChild(shell);
    await shell.updateComplete;
    const childRef = shell.querySelector('#projected-child');
    assert.ok(childRef, 'child projected on first render');
    assert.ok(shell.querySelector('section.compact'));

    expanded.set(true);
    await Promise.resolve(); await Promise.resolve();
    await shell.updateComplete;
    await Promise.resolve(); await Promise.resolve();
    assert.ok(shell.querySelector('section.expanded'));
    assert.ok(shell.querySelector('header'));
    const childRef2 = shell.querySelector('#projected-child');
    assert.ok(childRef2, 'child still present after shape change');
    assert.ok(childRef2 === childRef, 'DOM identity preserved across the host re-render');

    expanded.set(false);
    await Promise.resolve(); await Promise.resolve();
    await shell.updateComplete;
    await Promise.resolve(); await Promise.resolve();
    assert.ok(shell.querySelector('section.compact'));
    assert.equal(shell.querySelector('header'), null);
    assert.ok(shell.querySelector('#projected-child') === childRef, 'identity survives round-trip');

    shell.remove();
  });
});
