/**
 * Lit's default `render()` returns `noChange`, so a component that never
 * overrides it leaves its children alone. A light-DOM WebJs component with no
 * `render()` used to have its children captured into the slot record and then
 * wiped by an empty commit.
 */
import { WebComponent } from '../../../src/component.js';
import { noChange } from '../../../src/sentinels.js';
import { assert } from '../../../../../test/browser-assert.js';

let n = 0;
const tag = () => `renderless-el-${++n}`;

suite('render-less light-DOM component', () => {
  test('the default render() returns noChange', () => {
    class E extends WebComponent {}
    E.register(tag());
    assert.equal(new E().render(), noChange);
  });

  test('authored children survive a client mount and a later update', async () => {
    class E extends WebComponent {
      firstUpdated() { this.querySelector('button')?.setAttribute('data-ready', ''); }
    }
    const t = tag();
    E.register(t);
    const host = document.createElement('div');
    document.body.append(host);
    host.innerHTML = `<${t}><button>Go</button><span>text</span></${t}>`;
    const el = /** @type {any} */ (host.firstElementChild);
    const button = el.querySelector('button');
    await el.updateComplete;
    assert.equal(el.querySelector('button'), button, 'same node, not re-created');
    assert.ok(button.hasAttribute('data-ready'));
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(el.querySelector('span').textContent, 'text');
    assert.equal(el.renderRoot, el);
    host.remove();
  });
});
