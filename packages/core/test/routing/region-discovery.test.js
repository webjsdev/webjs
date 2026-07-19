/**
 * Unit tests for structural region discovery (Pillar 1, #1013).
 *
 * `collectRegions` replaces the wj:children comment-marker walk
 * (`collectChildrenSlots`): it finds `<wj-region segment route-key>` boundary
 * ELEMENTS. Because a real element delimits the subtree, there is no LIFO
 * pairing and no orphaned-close class of bug: a missing region is just absent
 * from the Map. The returned map's keys are segment paths, so the existing
 * `longestSharedPath` picks the deepest shared region unchanged.
 *
 * The router-client auto-enables on import, so DOM globals are set up first.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

let _collectRegions, _longestSharedPath;

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
  globalThis.CSS = globalThis.CSS || {
    escape(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, (m) => `\\${m}`); },
  };
  if (typeof globalThis.sessionStorage === 'undefined') {
    const store = new Map();
    globalThis.sessionStorage = /** @type any */ ({
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
      clear: () => { store.clear(); },
    });
  }
  ({ _collectRegions, _longestSharedPath } = await import('../../src/router-client.js'));
});

/** Parse an HTML body string into a detached container with querySelectorAll. */
function body(html) {
  const { document: doc } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return doc.body;
}

test('collects nested regions keyed by segment, carrying route-key', () => {
  const root = body(`
    <wj-region segment="/" route-key="/">
      <header>chrome</header>
      <wj-region segment="/blog" route-key="/blog">
        <wj-region segment="/blog/[slug]" route-key="/blog/a">
          <article>post a</article>
        </wj-region>
      </wj-region>
    </wj-region>
  `);
  const regions = _collectRegions(root);
  assert.deepEqual([...regions.keys()], ['/', '/blog', '/blog/[slug]']);
  assert.equal(regions.get('/').routeKey, '/');
  assert.equal(regions.get('/blog/[slug]').routeKey, '/blog/a');
  assert.equal(regions.get('/blog/[slug]').el.tagName.toLowerCase(), 'wj-region');
});

test('route-key falls back to segment when the attribute is absent', () => {
  const regions = _collectRegions(body('<wj-region segment="/docs"><p>x</p></wj-region>'));
  assert.equal(regions.get('/docs').routeKey, '/docs');
});

test('a wj-region without a segment attribute is ignored', () => {
  const regions = _collectRegions(body('<wj-region><p>x</p></wj-region><wj-region segment="/ok"></wj-region>'));
  assert.deepEqual([...regions.keys()], ['/ok']);
});

test('first wins on a duplicate segment (pathological self-include)', () => {
  const regions = _collectRegions(body(
    '<wj-region segment="/a" route-key="/a/1"><wj-region segment="/a" route-key="/a/2"></wj-region></wj-region>',
  ));
  assert.equal(regions.size, 1);
  assert.equal(regions.get('/a').routeKey, '/a/1');
});

test('longestSharedPath picks the deepest region present on both sides', () => {
  const here = _collectRegions(body(
    '<wj-region segment="/"><wj-region segment="/blog"><wj-region segment="/blog/[slug]" route-key="/blog/a"></wj-region></wj-region></wj-region>',
  ));
  const there = _collectRegions(body(
    '<wj-region segment="/"><wj-region segment="/blog"><wj-region segment="/blog/[slug]" route-key="/blog/b"></wj-region></wj-region></wj-region>',
  ));
  assert.equal(_longestSharedPath(here, there), '/blog/[slug]');
  // route-key differs at that region (a vs b) -> the swap tier will REPLACE
  // (page remount), which the swap logic reads from the two maps' route-keys.
  assert.notEqual(here.get('/blog/[slug]').routeKey, there.get('/blog/[slug]').routeKey);
});

test('empty / detached roots yield an empty map, never throw', () => {
  assert.equal(_collectRegions(body('<main>no regions</main>')).size, 0);
  assert.equal(_collectRegions(null).size, 0);
});
