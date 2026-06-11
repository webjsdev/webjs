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

class ResolvedWidget extends WebComponent {
  static properties = { label: { type: String } };
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
  test('applyStreamedResolve replaces the fallback and upgrades a streamed component', async () => {
    container().innerHTML = `<webjs-suspense id="s1"><i class="fb">loading</i></webjs-suspense>`;
    _applyStreamedResolve('s1', '<resolved-widget label="done"><!--webjs-hydrate--></resolved-widget>');
    const boundary = host.querySelector('#s1');
    assert.ok(!boundary.querySelector('.fb'), 'fallback removed');
    const widget = boundary.querySelector('resolved-widget');
    assert.ok(widget, 'streamed component present');
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
    assert.ok(host.querySelector('#a .ra'), 'boundary a resolved');
    assert.ok(host.querySelector('#b .rb'), 'boundary b resolved');
    assert.equal(host.querySelector('#a').textContent, 'A');
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
    assert.ok(host.querySelector('#c .rc'), 'the first boundary applied before supersession');
    assert.ok(!host.querySelector('#d .rd'), 'the second boundary did NOT apply after supersession');
    assert.ok(reader.cancelled(), 'the reader was cancelled');
  });
});
