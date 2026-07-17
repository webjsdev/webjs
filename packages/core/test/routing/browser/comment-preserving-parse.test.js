/**
 * Browser tests: the client router's HTML parse must PRESERVE comments (#1007).
 *
 * The whole partial-swap mechanism rides on comment markers
 * (`<!--wj:children:<path>-->` pairs), and hydration rides on another
 * (`<!--webjs-hydrate-->`). If the parse that turns a navigation response into a
 * Document drops comments, the router finds no shared layout slot and falls to
 * the DESTRUCTIVE full-body swap that wipes the outer layout (the site header /
 * navbar), and `__isHydrating()` goes false so a slotted light-DOM component
 * re-captures its own rendered output as authored children (#1006).
 *
 * Chromium 150 strips every comment from `Document.parseHTMLUnsafe`, which is
 * exactly the API `parseHTML` used for any response starting with `<!doctype>`
 * (so: every full page AND every X-Webjs-Have reduced response).
 *
 * These tests SIMULATE the stripping parser rather than depending on the
 * runner's browser being an affected version. That is deliberate and is the
 * whole point: this repo's web-test-runner pins Chromium 148, which is LOSSLESS,
 * so a test that merely asserted "markers survive" would pass here whether or
 * not the fix exists, and CI would never catch a regression. It is also why CI
 * never caught the original bug. By stubbing a lossy `parseHTMLUnsafe` we assert
 * the behaviour that actually matters (parseHTML must not INHERIT the loss) on
 * every browser, today and after the browser is fixed.
 *
 * Counterfactual: revert `parseHTML`'s document branch to a bare
 * `Document.parseHTMLUnsafe(html)` and the simulated-stripping cases go red on
 * all three browsers.
 */
import { _parseHTML, _resetParseProbe } from '../../../src/router-client.js';

import { assert } from '../../../../../test/browser-assert.js';

const DOC = (body) => `<!doctype html>\n<html lang="en">\n<head></head>\n<body>\n${body}\n</body>\n</html>`;

/** Every comment in a subtree, in document order. */
function comments(root) {
  const doc = root.ownerDocument || root;
  const out = [];
  const walk = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  let n;
  while ((n = walk.nextNode())) out.push(n.data.trim());
  return out;
}

/**
 * Run `fn` with `Document.parseHTMLUnsafe` replaced by a comment-stripping
 * version, reproducing Chromium 150's behaviour on any browser.
 */
function withStrippingParseHTMLUnsafe(fn) {
  const orig = Document.parseHTMLUnsafe;
  Document.parseHTMLUnsafe = (html) => {
    const doc = orig.call(Document, html);
    const walk = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
    const doomed = [];
    let n;
    while ((n = walk.nextNode())) doomed.push(n);
    for (const c of doomed) c.remove();
    return doc;
  };
  _resetParseProbe();
  try {
    return fn();
  } finally {
    Document.parseHTMLUnsafe = orig;
    _resetParseProbe();
  }
}

suite('Client router: the nav parse preserves comment markers (#1007)', () => {
  test('the stripping stub really does strip (the simulation is honest)', () => {
    // Guard the guard: if the stub silently stopped stripping, every test below
    // would pass vacuously, which is exactly the failure this file exists to
    // avoid. Assert the simulated browser is genuinely lossy.
    withStrippingParseHTMLUnsafe(() => {
      const doc = Document.parseHTMLUnsafe('<!doctype html><html><body><!--gone--><i></i></body></html>');
      assert.equal(doc.body.firstChild.nodeName, 'I', 'stub stripped the comment');
    });
  });

  test('preserves the wj:children layout markers on a stripping browser', () => {
    withStrippingParseHTMLUnsafe(() => {
      const doc = _parseHTML(DOC('<!--wj:children:/-->\n<main>page</main>\n<!--/wj:children-->'));
      assert.ok(doc, 'parse returned a document');
      assert.deepEqual(comments(doc.body), ['wj:children:/', '/wj:children']);
    });
  });

  test('preserves the webjs-hydrate marker as a component first child', () => {
    // __isHydrating() reads firstChild and requires this comment. Stripped, it
    // sends connectedCallback down captureAuthoredChildren, which is #1006.
    withStrippingParseHTMLUnsafe(() => {
      const doc = _parseHTML(DOC('<copy-cmd data-wj-host><!--webjs-hydrate--><span>x</span></copy-cmd>'));
      const el = doc.querySelector('copy-cmd');
      assert.equal(el.firstChild.nodeType, 8, 'first child is a comment');
      assert.equal(el.firstChild.data, 'webjs-hydrate');
    });
  });

  test('preserves markers in a REDUCED response (the X-Webjs-Have shape)', () => {
    // A reduced response is a full doctype'd document with the outer-layout
    // chrome omitted, so it takes the same document branch as a full page. This
    // is the exact payload shape that swept the navbar on webjs.dev.
    withStrippingParseHTMLUnsafe(() => {
      const doc = _parseHTML(
        DOC('<!--wj:children:/-->\n<style>i{color:red}</style>\n<main>home</main>\n<footer>f</footer>\n<!--/wj:children-->'),
      );
      assert.deepEqual(comments(doc.body), ['wj:children:/', '/wj:children']);
      assert.ok(doc.body.querySelector('main'), 'content survives too');
    });
  });

  test('still attaches Declarative Shadow DOM while preserving comments', () => {
    // Why parseHTMLUnsafe was chosen originally: it processes DSD in one pass.
    // The comment-preserving path must not regress that, or a `static shadow`
    // component soft-navigated in loses its root.
    withStrippingParseHTMLUnsafe(() => {
      const doc = _parseHTML(
        DOC('<!--wj:children:/-->\n<x-shadow><template shadowrootmode="open"><p>inside</p></template></x-shadow>\n<!--/wj:children-->'),
      );
      assert.deepEqual(comments(doc.body), ['wj:children:/', '/wj:children'], 'markers survive');
      const host = doc.querySelector('x-shadow');
      assert.ok(host.shadowRoot, 'DSD attached');
      assert.equal(host.shadowRoot.querySelector('p').textContent, 'inside');
    });
  });

  test('preserves markers in a body-context FRAGMENT response (#936 path)', () => {
    // The fragment branch never used parseHTMLUnsafe, so it was accidentally
    // immune. Pin it so a future refactor cannot route it through the lossy API.
    withStrippingParseHTMLUnsafe(() => {
      const doc = _parseHTML('<!--wj:children:/docs-->\n<main>d</main>\n<!--/wj:children-->');
      assert.deepEqual(comments(doc.body), ['wj:children:/docs', '/wj:children']);
    });
  });

  // The fallback must be lossless for NON-comment content too, not just markers.
  // Asserting only "markers survive" is what let a real content-corrupting bug
  // through review once: `setHTMLUnsafe(innerHTML)` looks like a free way to get
  // DSD out of an already-parsed tree, but Chromium omits the spec's
  // LF-compensation on fragment serialization, so the round-trip silently ate a
  // leading newline in <pre>/<textarea>. In a <textarea> that is form-data
  // corruption: a soft nav would submit different bytes than a hard refresh.
  //
  // So compare the fallback against the browser's own single-pass parse and
  // require equality. This is the class of guard CI CAN run (Chromium 148 shares
  // the serializer defect even though it does not strip comments).
  suite('the comment-preserving fallback is lossless for content', () => {
    const cases = [
      ['textarea leading newline', '<textarea id="t">\n\nfoo</textarea>'],
      ['pre leading newline', '<pre id="t">\n\ncode</pre>'],
      ['textarea with only a newline', '<textarea id="t">\n</textarea>'],
      ['escaped markup in pre', '<pre id="t">&lt;div&gt;&amp;amp;</pre>'],
      ['script raw text', '<script id="t" type="application/json">{"a":"&lt;b&gt;"}</script>'],
      ['attribute quoting', '<div id="t" data-x=\'a"b\' data-y="c&amp;d">z</div>'],
      ['rich prop attribute', '<my-el id="t" data-webjs-prop-v=\'{"n":[1,2],"s":"a\\u000ab"}\'></my-el>'],
      ['noscript', '<noscript id="t"><img src="x.png"></noscript>'],
    ];

    for (const [name, body] of cases) {
      test(name, () => {
        const html = DOC(body);
        // The browser's own single-pass parse is the reference: it is what a hard
        // refresh produces, and a soft nav must not diverge from it.
        const reference = new DOMParser().parseFromString(html, 'text/html');
        const actual = withStrippingParseHTMLUnsafe(() => _parseHTML(html));
        const ref = reference.querySelector('#t');
        const act = actual.querySelector('#t');
        assert.ok(act, 'element survived the fallback parse');
        assert.equal(act.textContent, ref.textContent, 'textContent identical to a single-pass parse');
        assert.equal(act.outerHTML, ref.outerHTML, 'serialization identical to a single-pass parse');
        if (ref.tagName === 'TEXTAREA') {
          assert.equal(act.value, ref.value, 'textarea value identical (form data must not shift)');
        }
      });
    }
  });

  test('attaches NESTED Declarative Shadow DOM', () => {
    // The manual attach recurses; a shadow root inside a shadow root must attach
    // too, or a nested `static shadow` component loses its root on soft nav.
    withStrippingParseHTMLUnsafe(() => {
      const doc = _parseHTML(
        DOC('<x-outer><template shadowrootmode="open"><p>o</p><x-inner><template shadowrootmode="open"><b>i</b></template></x-inner></template></x-outer>'),
      );
      const outer = doc.querySelector('x-outer');
      assert.ok(outer.shadowRoot, 'outer shadow attached');
      const inner = outer.shadowRoot.querySelector('x-inner');
      assert.ok(inner.shadowRoot, 'nested shadow attached');
      assert.equal(inner.shadowRoot.querySelector('b').textContent, 'i');
    });
  });

  test('leaves a DSD template alone when the host cannot take a shadow root', () => {
    // attachShadow throws on e.g. a <div>? No: it throws on elements not on the
    // valid-host list. Whatever the engine rejects, the parse must still return a
    // usable document with markers rather than throwing out of parseHTML.
    withStrippingParseHTMLUnsafe(() => {
      const doc = _parseHTML(DOC('<!--wj:children:/--><input><span><template shadowrootmode="open"><i>x</i></template></span><!--/wj:children-->'));
      assert.deepEqual(comments(doc.body), ['wj:children:/', '/wj:children'], 'markers still intact');
      assert.ok(doc.body.querySelector('span'), 'document still usable');
    });
  });

  test('uses the native fast path when the browser is lossless', () => {
    // The probe must not permanently exile a correct browser onto the fallback.
    // On a lossless browser parseHTML should still round-trip markers, and this
    // is the path CI's Chromium 148 / Firefox / WebKit actually take.
    _resetParseProbe();
    const doc = _parseHTML(DOC('<!--wj:children:/-->\n<main>x</main>\n<!--/wj:children-->'));
    assert.deepEqual(comments(doc.body), ['wj:children:/', '/wj:children']);
  });
});
