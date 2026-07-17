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

  test('uses the native fast path when the browser is lossless', () => {
    // The probe must not permanently exile a correct browser onto the fallback.
    // On a lossless browser parseHTML should still round-trip markers, and this
    // is the path CI's Chromium 148 / Firefox / WebKit actually take.
    _resetParseProbe();
    const doc = _parseHTML(DOC('<!--wj:children:/-->\n<main>x</main>\n<!--/wj:children-->'));
    assert.deepEqual(comments(doc.body), ['wj:children:/', '/wj:children']);
  });
});
