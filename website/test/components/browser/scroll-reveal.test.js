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

  test('an out-of-view section is observed, then revealed when it intersects', async () => {
    const realIO = window.IntersectionObserver;
    let cb, opts;
    const observed = new Set();
    const unobserved = new Set();
    window.IntersectionObserver = class {
      constructor(c, o) { cb = c; opts = o; }
      observe(el) { observed.add(el); }
      unobserve(el) { unobserved.add(el); }
      disconnect() {}
    };
    try {
      // A tall spacer pushes the section below the viewport so it takes the
      // IntersectionObserver branch instead of the synchronous in-view one.
      host.innerHTML = '<div style="height:3000px"></div><section data-reveal id="io">io</section><scroll-reveal></scroll-reveal>';
      await host.querySelector('scroll-reveal').updateComplete;
      const el = document.getElementById('io');
      assert.ok(observed.has(el), 'the out-of-view section is observed, not revealed synchronously');
      assert.ok(!el.classList.contains('is-revealed'), 'it is not revealed before it intersects');
      assert.ok(opts && typeof opts.threshold === 'number', 'the observer is configured with a threshold');
      // The reveal trigger margin materially changes WHEN a section counts as
      // in-view (the negative bottom pulls the trigger up). Assert it so a
      // regression that dropped or changed it is caught.
      assert.equal(opts.rootMargin, '0px 0px -8% 0px', 'the observer keeps the bottom-margin reveal trigger');
      cb([{ target: el, isIntersecting: true }]);
      assert.ok(el.classList.contains('is-revealed'), 'it is revealed when it intersects');
      assert.ok(unobserved.has(el), 'it is unobserved once revealed');
    } finally { window.IntersectionObserver = realIO; }
  });

  test('a non-intersecting entry keeps the section hidden (counterfactual)', async () => {
    const realIO = window.IntersectionObserver;
    let cb;
    window.IntersectionObserver = class { constructor(c) { cb = c; } observe() {} unobserve() {} disconnect() {} };
    try {
      host.innerHTML = '<div style="height:3000px"></div><section data-reveal id="io2">io2</section><scroll-reveal></scroll-reveal>';
      await host.querySelector('scroll-reveal').updateComplete;
      cb([{ target: document.getElementById('io2'), isIntersecting: false }]);
      assert.ok(!document.getElementById('io2').classList.contains('is-revealed'), 'stays hidden when not intersecting');
    } finally { window.IntersectionObserver = realIO; }
  });

  test('tears down when reduced motion is turned on mid-session', async () => {
    const realMM = window.matchMedia;
    let reduced = false;
    let changeHandler = null;
    window.matchMedia = (q) => ({
      get matches() { return /reduce/.test(q) && reduced; },
      media: q, onchange: null,
      addEventListener(_t, h) { changeHandler = h; },
      removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
    });
    try {
      await mount('<section data-reveal id="ms">ms</section>');
      assert.ok(revealReady(), 'reveal-ready is added while motion is allowed');
      // Flip the OS preference to reduced and fire the media-query change.
      reduced = true;
      if (changeHandler) changeHandler();
      assert.ok(!revealReady(), 'reveal-ready is dropped when reduced motion turns on');
    } finally { window.matchMedia = realMM; }
  });

  test('under prefers-reduced-motion nothing is gated (no reveal-ready, content stays visible)', async () => {
    const realMM = window.matchMedia;
    window.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
    try {
      host.innerHTML = '<section data-reveal id="rm">rm</section><scroll-reveal></scroll-reveal>';
      await host.querySelector('scroll-reveal').updateComplete;
      assert.ok(!revealReady(), 'reveal-ready is not added under reduced motion');
      assert.ok(!document.getElementById('rm').classList.contains('is-revealed'), 'the section is left untouched and visible');
    } finally { window.matchMedia = realMM; }
  });
});
