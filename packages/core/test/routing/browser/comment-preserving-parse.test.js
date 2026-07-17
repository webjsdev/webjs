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
 * (so: every full page AND every X-Webjs-Have reduced response). These assert the
 * invariant at the layer that actually broke, and are written against the parse
 * itself so they fail on ANY browser that strips, not just Chromium.
 *
 * Counterfactual: revert `parseHTML`'s document branch to a bare
 * `Document.parseHTMLUnsafe(html)` and the marker cases go red on a stripping
 * browser (verified on Chromium 150).
 */
import { _parseHTML } from '../../../src/router-client.js';

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

suite('Client router: the nav parse preserves comment markers (#1007)', () => {
  test('preserves the wj:children layout markers in a full document', () => {
    const doc = _parseHTML(DOC('<!--wj:children:/-->\n<main>page</main>\n<!--/wj:children-->'));
    assert.ok(doc, 'parse returned a document');
    assert.deepEqual(comments(doc.body), ['wj:children:/', '/wj:children']);
  });

  test('preserves the webjs-hydrate marker as a component first child', () => {
    // __isHydrating() reads firstChild and requires this comment. Stripped, it
    // sends connectedCallback down captureAuthoredChildren, which is #1006.
    const doc = _parseHTML(DOC('<copy-cmd data-wj-host><!--webjs-hydrate--><span>x</span></copy-cmd>'));
    const el = doc.querySelector('copy-cmd');
    assert.equal(el.firstChild.nodeType, 8, 'first child is a comment');
    assert.equal(el.firstChild.data, 'webjs-hydrate');
  });

  test('preserves markers in a REDUCED response (the X-Webjs-Have shape)', () => {
    // A reduced response is a full doctype'd document with the outer-layout
    // chrome omitted, so it takes the same document branch as a full page. This
    // is the exact payload shape that swept the navbar on webjs.dev.
    const doc = _parseHTML(
      DOC('<!--wj:children:/-->\n<style>i{color:red}</style>\n<main>home</main>\n<footer>f</footer>\n<!--/wj:children-->'),
    );
    assert.deepEqual(comments(doc.body), ['wj:children:/', '/wj:children']);
    assert.ok(doc.body.querySelector('main'), 'content survives too');
  });

  test('preserves markers in a body-context FRAGMENT response (#936 path)', () => {
    const doc = _parseHTML('<!--wj:children:/docs-->\n<main>d</main>\n<!--/wj:children-->');
    assert.deepEqual(comments(doc.body), ['wj:children:/docs', '/wj:children']);
  });

  test('still attaches Declarative Shadow DOM while preserving comments', () => {
    // Why parseHTMLUnsafe was chosen originally: it processes DSD in one pass.
    // The comment-preserving path must not regress that, or a `static shadow`
    // component soft-navigated in loses its root.
    const doc = _parseHTML(
      DOC('<!--wj:children:/-->\n<x-shadow><template shadowrootmode="open"><p>inside</p></template></x-shadow>\n<!--/wj:children-->'),
    );
    assert.deepEqual(comments(doc.body), ['wj:children:/', '/wj:children'], 'markers survive');
    const host = doc.querySelector('x-shadow');
    assert.ok(host.shadowRoot, 'DSD attached');
    assert.equal(host.shadowRoot.querySelector('p').textContent, 'inside');
  });

  test('does not inherit a lossy Document.parseHTMLUnsafe', () => {
    // Guard the guard. If this browser strips, prove parseHTML routed AROUND it
    // instead of inheriting the loss; if it does not strip, this still asserts
    // the native fast path stayed correct.
    const SRC = '<!doctype html><html><body><!--c--><i></i></body></html>';
    let nativeLossless = false;
    try {
      nativeLossless = Document.parseHTMLUnsafe(SRC)?.body?.firstChild?.nodeType === 8;
    } catch { /* treat as lossy */ }
    const doc = _parseHTML(SRC);
    assert.equal(doc.body.firstChild.nodeType, 8, `parseHTML kept the comment (native lossless=${nativeLossless})`);
  });
});
