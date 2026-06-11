/**
 * Client side of <webjs-suspense> (#471), real browser via WTR.
 *
 * The SSR swap script replaces the boundary's innerHTML with the streamed
 * children; the custom elements inside then upgrade natively. This test drives
 * that post-swap shape directly (no server) and asserts the wrapper is
 * layout-neutral and the streamed child hydrates.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import '../../../src/webjs-suspense.js';

const { suite, test } = window.Mocha ? Mocha : { suite, test };
const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
};
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

let host;
function container() {
  if (host) host.remove();
  host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

class StreamedCard extends WebComponent {
  static properties = { label: { type: String } };
  constructor() { super(); this.label = ''; }
  render() { return html`<p class="card">${this.label}</p>`; }
}
StreamedCard.register('streamed-card');

suite('<webjs-suspense> client', () => {
  test('the boundary element is layout-neutral (display: contents)', async () => {
    container().innerHTML = `<webjs-suspense id="s1"><i>loading</i></webjs-suspense>`;
    await tick(0);
    const el = host.querySelector('webjs-suspense');
    assert.ok(el, 'element present');
    assert.equal(getComputedStyle(el).display, 'contents', 'wrapper is display:contents');
  });

  test('the boundary is REPLACED by the streamed children, which upgrade (matches the real swap)', async () => {
    container().innerHTML = `<webjs-suspense id="s2"><i class="fb">loading</i></webjs-suspense>`;
    await tick(0);
    const boundary = host.querySelector('#s2');
    assert.ok(boundary.querySelector('.fb'), 'fallback visible first');
    // The real SSR swap (the inline script + __webjsResolve) and the soft-nav
    // applyStreamedResolve both REPLACE the boundary with the streamed content
    // (the transient wrapper is removed). Mirror that here.
    const tpl = document.createElement('template');
    tpl.innerHTML = `<streamed-card label="hello"><!--webjs-hydrate--></streamed-card>`;
    boundary.replaceWith(tpl.content);
    await tick(0);
    assert.ok(!host.querySelector('#s2'), 'the boundary wrapper was removed');
    const card = host.querySelector('streamed-card');
    assert.ok(card, 'streamed custom element present in the host');
    if (card.updateComplete) await card.updateComplete;
    await tick(0);
    assert.ok(card.querySelector('.card'), 'the streamed component upgraded and rendered');
    assert.equal(card.querySelector('.card').textContent, 'hello');
    assert.ok(!host.querySelector('.fb'), 'the fallback was replaced');
  });
});
