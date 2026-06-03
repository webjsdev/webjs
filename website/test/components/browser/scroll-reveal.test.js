/**
 * Browser tests for the <scroll-reveal> element covering the reveal
 * mechanism and its progressive-enhancement contract.
 *
 * The key invariant is that the hidden state lives under a `reveal-ready`
 * class the component adds, so without the component every [data-reveal]
 * stays visible. Sections in view at connect are revealed synchronously, and
 * the class is dropped again on disconnect so content is never left hidden.
 */
import '../../../components/scroll-reveal.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const revealReady = () => document.documentElement.classList.contains('reveal-ready');

suite('scroll-reveal', () => {
  let host;
  setup(() => {
    document.documentElement.classList.remove('reveal-ready');
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  teardown(() => {
    host.remove();
    document.documentElement.classList.remove('reveal-ready');
  });

  const mount = async (innerHTML) => {
    host.innerHTML = innerHTML + '<scroll-reveal></scroll-reveal>';
    const sr = host.querySelector('scroll-reveal');
    await sr.updateComplete;
    return sr;
  };

  test('progressive enhancement: no reveal-ready exists before the component connects', () => {
    host.innerHTML = '<section data-reveal id="pe">visible by default</section>';
    assert.ok(!revealReady(), 'content is not gated on JS until the observer exists');
  });

  test('connecting adds reveal-ready and reveals in-view sections synchronously', async () => {
    await mount('<section data-reveal id="a">A</section>');
    assert.ok(revealReady(), 'reveal-ready is added so the hidden state can apply');
    assert.ok(
      document.getElementById('a').classList.contains('is-revealed'),
      'a section already in view is revealed in the same frame (no flash)',
    );
  });

  test('disconnecting drops reveal-ready so nothing is left hidden', async () => {
    const sr = await mount('<section data-reveal>X</section>');
    assert.ok(revealReady(), 'reveal-ready present while connected');
    sr.remove();
    assert.ok(!revealReady(), 'reveal-ready removed on disconnect');
  });

  test('does nothing when there is no [data-reveal] to observe', async () => {
    await mount('<section id="plain">no reveal here</section>');
    assert.ok(!revealReady(), 'reveal-ready is not added when there is nothing to reveal');
  });
});
