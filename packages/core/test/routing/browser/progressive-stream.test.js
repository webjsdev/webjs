/**
 * Progressive soft-nav streaming, DOM side (#473), real browser via WTR.
 *
 * applyStreamedResolve swaps a live boundary's fallback for the resolved
 * content and upgrades custom elements inside; streamBoundariesProgressively
 * applies each boundary as it streams and stops when superseded.
 */
import {
  _applyStreamedResolve,
  _streamBoundariesProgressively,
} from '../../../src/router-client.js';
import { WebComponent } from '../../../src/component.js';
import { html } from '../../../src/html.js';

const { suite, test } = window.Mocha ? Mocha : { suite, test };
import { assert } from '../../../../../test/browser-assert.js';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

let host;
function container() {
  if (host) host.remove();
  host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

class ResolvedWidget extends WebComponent({ label: String }) {
  constructor() { super(); this.label = ''; }
  render() { return html`<span class="widget">${this.label}</span>`; }
}
ResolvedWidget.register('resolved-widget');

/** A reader-like object that yields the given encoded chunks, one per read(). */
function fakeReader(chunks) {
  const enc = new TextEncoder();
  let i = 0;
  let cancelled = false;
  return {
    cancelled: () => cancelled,
    async read() {
      await tick(5);
      if (cancelled || i >= chunks.length) return { value: undefined, done: true };
      return { value: enc.encode(chunks[i++]), done: false };
    },
    cancel() { cancelled = true; return Promise.resolve(); },
  };
}

suite('progressive streaming (DOM)', () => {
  test('applyStreamedResolve replaces the boundary with the streamed content and upgrades it', async () => {
    container().innerHTML = `<webjs-suspense id="s1"><i class="fb">loading</i></webjs-suspense>`;
    _applyStreamedResolve('s1', '<resolved-widget label="done"><!--webjs-hydrate--></resolved-widget>');
    // The transient boundary wrapper is removed (matching the initial-load path).
    assert.ok(!host.querySelector('#s1'), 'the boundary element was replaced (no wrapper left)');
    assert.ok(!host.querySelector('.fb'), 'fallback removed');
    const widget = host.querySelector('resolved-widget');
    assert.ok(widget, 'streamed component present in the host');
    if (widget.updateComplete) await widget.updateComplete;   // upgrade renders on a microtask
    await tick(0);
    assert.ok(widget.querySelector('.widget'), 'streamed component upgraded and rendered');
    assert.equal(widget.querySelector('.widget').textContent, 'done');
  });

  test('streamBoundariesProgressively applies boundaries as they arrive', async () => {
    container().innerHTML =
      `<webjs-suspense id="a"><i>la</i></webjs-suspense><webjs-suspense id="b"><i>lb</i></webjs-suspense>`;
    const reader = fakeReader([
      '<template data-webjs-resolve="a"><p class="ra">A</p></template><script>x</script>',
      '<template data-webjs-resolve="b"><p class="rb">B</p></template><script>x</script>',
    ]);
    await _streamBoundariesProgressively(reader, new TextDecoder(), '', () => true);
    // Each boundary is replaced by its content (the wrapper is removed).
    assert.ok(host.querySelector('.ra'), 'boundary a resolved');
    assert.ok(host.querySelector('.rb'), 'boundary b resolved');
    assert.ok(!host.querySelector('#a') && !host.querySelector('#b'), 'both boundary wrappers removed');
    assert.equal(host.querySelector('.ra').textContent, 'A');
  });

  test('a superseded stream stops applying and cancels the reader', async () => {
    container().innerHTML =
      `<webjs-suspense id="c"><i>lc</i></webjs-suspense><webjs-suspense id="d"><i>ld</i></webjs-suspense>`;
    const reader = fakeReader([
      '<template data-webjs-resolve="c"><p class="rc">C</p></template>',
      '<template data-webjs-resolve="d"><p class="rd">D</p></template>',
    ]);
    let current = true;
    const p = _streamBoundariesProgressively(reader, new TextDecoder(), '', () => current);
    await tick(8);            // let the first boundary apply
    current = false;         // supersede
    await p;
    assert.ok(host.querySelector('.rc'), 'the first boundary applied before supersession');
    assert.ok(host.querySelector('#d') && !host.querySelector('.rd'), 'the second boundary did NOT apply after supersession (its fallback wrapper remains)');
    assert.ok(reader.cancelled(), 'the reader was cancelled');
  });
});
