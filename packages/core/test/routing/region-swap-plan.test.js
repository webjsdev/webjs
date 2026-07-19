/**
 * Unit tests for the two-tier region swap PLAN (Pillar 2, #1013).
 *
 * planRegionSwap(here, there) reads the live + incoming region maps and returns
 * the swap verdict that gives exact Next.js remount-vs-preserve parity:
 *   - a dynamic-param change remounts (replace) at the SHALLOWEST changed region
 *   - a page change under a shared static layout replaces the deepest shared one
 *   - a searchParams-only nav morphs the page region (state preserved)
 * This is the pure decision core; the DOM mutation is a separate step.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

let _collectRegions, _planRegionSwap;

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
  ({ _collectRegions, _planRegionSwap } = await import('../../src/router-client.js'));
});

/** Build a region map from [segment, routeKey] pairs (nested prefix chain). */
function regions(pairs) {
  const inner = pairs.map(([seg, key]) => `<wj-region segment="${seg}" route-key="${key}">`).join('')
    + pairs.map(() => '</wj-region>').join('');
  const { document: doc } = parseHTML(`<!doctype html><html><body>${inner}</body></html>`);
  return _collectRegions(doc.body);
}

test('searchParams-only nav morphs the page region (state preserved)', () => {
  // /blog/a?x=1 -> /blog/a?x=2 : every route-key identical, page region is leaf.
  const here = regions([['/', '/'], ['/blog', '/blog'], ['/blog/[slug]', '/blog/a']]);
  const there = regions([['/', '/'], ['/blog', '/blog'], ['/blog/[slug]', '/blog/a']]);
  const plan = _planRegionSwap(here, there);
  assert.equal(plan.mode, 'morph');
  assert.equal(plan.segment, '/blog/[slug]');
});

test('dynamic page-param change remounts the page region only', () => {
  // /blog/a -> /blog/b : shallowest changed region is the page; layouts preserved.
  const here = regions([['/', '/'], ['/blog', '/blog'], ['/blog/[slug]', '/blog/a']]);
  const there = regions([['/', '/'], ['/blog', '/blog'], ['/blog/[slug]', '/blog/b']]);
  const plan = _planRegionSwap(here, there);
  assert.equal(plan.mode, 'replace');
  assert.equal(plan.segment, '/blog/[slug]');
});

test('dynamic LAYOUT-param change remounts at the shallow layout, not the page', () => {
  // /a/settings -> /b/settings : the [org] layout param changed, so the boundary
  // is the shallow [org] region (its whole subtree, incl. the page, remounts).
  const here = regions([['/', '/'], ['/[org]', '/a'], ['/[org]/settings', '/a/settings']]);
  const there = regions([['/', '/'], ['/[org]', '/b'], ['/[org]/settings', '/b/settings']]);
  const plan = _planRegionSwap(here, there);
  assert.equal(plan.mode, 'replace');
  assert.equal(plan.segment, '/[org]'); // shallowest changed, NOT the deeper page
});

test('page change under a shared static layout replaces the shared layout region', () => {
  // /about -> /contact : root layout shared+unchanged, page segments differ
  // (not shared), so replace the deepest shared region (root) wholesale.
  const here = regions([['/', '/'], ['/about', '/about']]);
  const there = regions([['/', '/'], ['/contact', '/contact']]);
  const plan = _planRegionSwap(here, there);
  assert.equal(plan.mode, 'replace');
  assert.equal(plan.segment, '/');
});

test('the root layout region is never the remount boundary on a deeper change', () => {
  // A deep change must not sweep the root layout: root stays preserved.
  const here = regions([['/', '/'], ['/dash', '/dash'], ['/dash/[tab]', '/dash/a']]);
  const there = regions([['/', '/'], ['/dash', '/dash'], ['/dash/[tab]', '/dash/b']]);
  const plan = _planRegionSwap(here, there);
  assert.notEqual(plan.segment, '/');
  assert.equal(plan.segment, '/dash/[tab]');
});

test('no shared region yields null (caller degrades to a full load)', () => {
  const here = regions([['/x', '/x']]);
  const there = regions([['/y', '/y']]);
  assert.equal(_planRegionSwap(here, there), null);
});
