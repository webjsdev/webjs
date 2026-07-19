/**
 * Unit tests for applyRegionContent (Pillar 2 DOM mutation, #1013).
 *
 * Given a swap plan it mutates ONLY the live <wj-region>'s children:
 *   - 'replace' does a wholesale replaceChildren (Next remount): new nodes,
 *     old identity gone, except data-webjs-permanent nodes regrafted by identity.
 *   - 'morph' reuses keyed/positional live nodes (state preserved), the
 *     bounded same-route swap for a searchParams-only nav.
 * The region element itself and everything above it is never touched.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

let _applyRegionContent;

before(async () => {
  const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>');
  globalThis.document = window.document;
  globalThis.window = window;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Element = window.Element;
  globalThis.Node = window.Node;
  globalThis.Comment = window.Comment;
  globalThis.Text = window.Text;
  globalThis.MutationObserver = window.MutationObserver;
  globalThis.customElements = window.customElements;
  globalThis.CustomEvent = window.CustomEvent;
  globalThis.DOMParser = window.DOMParser;
  globalThis.CSS = globalThis.CSS || { escape: (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (m) => `\\${m}`) };
  if (typeof globalThis.sessionStorage === 'undefined') {
    const store = new Map();
    globalThis.sessionStorage = /** @type any */ ({
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); }, clear: () => store.clear(),
    });
  }
  ({ _applyRegionContent } = await import('../../src/router-client.js'));
});

/** Make a detached <wj-region> element with the given inner HTML. */
function region(inner) {
  const { document: doc } = parseHTML(`<!doctype html><html><body><wj-region segment="/x">${inner}</wj-region></body></html>`);
  // Adopt into the global document so importNode / replaceChildren operate there.
  const el = doc.body.firstChild;
  return document.importNode(el, true);
}

test('replace swaps children wholesale (remount, no old identity kept)', () => {
  const live = region('<article id="a">old</article>');
  const oldNode = live.firstChild;
  const incoming = region('<article id="b">new</article>');
  _applyRegionContent({ mode: 'replace', live, incoming });
  assert.equal(live.children.length, 1);
  assert.equal(live.firstElementChild.id, 'b');
  assert.equal(live.textContent.trim(), 'new');
  assert.notEqual(live.firstChild, oldNode); // remounted, not reused
});

test('replace regrafts a data-webjs-permanent node by identity', () => {
  const live = region('<div data-webjs-permanent id="player">LIVE-PLAYER</div><p>old</p>');
  const permanent = live.querySelector('#player');
  const incoming = region('<div data-webjs-permanent id="player">INCOMING-PLAYER</div><p>new</p>');
  _applyRegionContent({ mode: 'replace', live, incoming });
  // The live permanent node object survives (identity), not the incoming copy.
  assert.equal(live.querySelector('#player'), permanent);
  assert.equal(live.querySelector('#player').textContent, 'LIVE-PLAYER');
  assert.equal(live.querySelector('p').textContent, 'new'); // non-permanent updated
});

test('morph reuses a keyed live node (state-preservation path)', () => {
  const live = region('<li data-key="1">a</li><li data-key="2">b</li>');
  const keptNode = live.querySelector('[data-key="1"]');
  const incoming = region('<li data-key="1">a-updated</li><li data-key="2">b</li>');
  _applyRegionContent({ mode: 'morph', live, incoming });
  // Same node object reused for key "1" (identity kept), text updated.
  assert.equal(live.querySelector('[data-key="1"]'), keptNode);
  assert.equal(live.querySelector('[data-key="1"]').textContent, 'a-updated');
});

test('mutates only the region children, never the region element itself', () => {
  const live = region('<span>x</span>');
  const el = live;
  _applyRegionContent({ mode: 'replace', live, incoming: region('<span>y</span>') });
  assert.equal(live, el); // same region element object
  assert.equal(live.getAttribute('segment'), '/x'); // untouched
});
