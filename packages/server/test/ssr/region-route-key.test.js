/**
 * Unit tests for the region route-key derivation (Pillar 1, #1013).
 *
 * The client router's structural rebuild replaces comment layout markers with
 * `<wj-region segment="..." route-key="...">` elements and picks its swap tier
 * by comparing a region's OLD vs NEW route-key: changed -> wholesale replace
 * (Next page-remount parity), same -> bounded same-route morph (state kept, the
 * searchParams-only-nav case). These are the pure server-side building blocks
 * that emit `segment` (the pattern) and `route-key` (the resolved path).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _pageSegmentPath, _regionRouteKey, _wrapWithChildrenMarker } from '../../src/ssr.js';

test('pageSegmentPath derives the page own segment (full route pattern)', () => {
  assert.equal(_pageSegmentPath('/x/app/page.ts'), '/');
  assert.equal(_pageSegmentPath('/x/app/blog/[slug]/page.tsx'), '/blog/[slug]');
  assert.equal(_pageSegmentPath('/x/app/files/[...rest]/page.js'), '/files/[...rest]');
  assert.equal(_pageSegmentPath('/x/app/(marketing)/about/page.ts'), '/(marketing)/about');
});

test('regionRouteKey: static segments have a constant key', () => {
  assert.equal(_regionRouteKey('/', {}), '/');
  assert.equal(_regionRouteKey('/docs', {}), '/docs');
  assert.equal(_regionRouteKey('/docs/components', {}), '/docs/components');
});

test('regionRouteKey: dynamic [param] is substituted', () => {
  assert.equal(_regionRouteKey('/blog/[slug]', { slug: 'a' }), '/blog/a');
  assert.equal(_regionRouteKey('/blog/[slug]', { slug: 'b' }), '/blog/b');
  assert.equal(_regionRouteKey('/[org]/[repo]', { org: 'webjsdev', repo: 'webjs' }), '/webjsdev/webjs');
});

test('regionRouteKey: route groups are dropped (not in the URL)', () => {
  assert.equal(_regionRouteKey('/(marketing)/about', {}), '/about');
  assert.equal(_regionRouteKey('/(marketing)', {}), '/');
  assert.equal(_regionRouteKey('/(shop)/[id]', { id: '7' }), '/7');
});

test('regionRouteKey: catch-all value is already slash-joined', () => {
  assert.equal(_regionRouteKey('/files/[...rest]', { rest: 'a/b/c' }), '/files/a/b/c');
  assert.equal(_regionRouteKey('/files/[...rest]', { rest: 'a' }), '/files/a');
});

test('regionRouteKey: optional catch-all collapses when empty', () => {
  assert.equal(_regionRouteKey('/shop/[[...slug]]', {}), '/shop');
  assert.equal(_regionRouteKey('/shop/[[...slug]]', { slug: '' }), '/shop');
  assert.equal(_regionRouteKey('/shop/[[...slug]]', { slug: 'x/y' }), '/shop/x/y');
});

test('regionRouteKey: Next remount-vs-preserve semantics by construction', () => {
  // /blog/a -> /blog/b : the page region key changes (remount), the '/' layout
  // region key is constant (preserved). This is the whole two-tier decision.
  const pageA = _regionRouteKey('/blog/[slug]', { slug: 'a' });
  const pageB = _regionRouteKey('/blog/[slug]', { slug: 'b' });
  assert.notEqual(pageA, pageB); // page remounts on a param change
  assert.equal(_regionRouteKey('/', { slug: 'a' }), _regionRouteKey('/', { slug: 'b' })); // layout preserved

  // /blog/a -> /blog/a?x=1 : params are identical (searchParams excluded by
  // construction), so every region key is unchanged -> morph, state preserved.
  assert.equal(pageA, _regionRouteKey('/blog/[slug]', { slug: 'a' }));
});

test('regionRouteKey: param values are encoded so a comment can never be terminated', () => {
  // The route-key rides inside the boundary COMMENT and params are
  // user-controlled: '-->' in a value must not close the comment early.
  // encodeURIComponent removes '<', '>', ':' (comment + delimiter safety).
  assert.equal(_regionRouteKey('/blog/[slug]', { slug: 'a-->b' }), '/blog/a--%3Eb');
  assert.equal(_regionRouteKey('/blog/[slug]', { slug: 'a:b' }), '/blog/a%3Ab');
  // Catch-all values are encoded per piece: literal '/' separators survive.
  assert.equal(_regionRouteKey('/files/[...rest]', { rest: 'a/b-->c' }), '/files/a/b--%3Ec');
});

test('wrapWithChildrenMarker: emits the keyed boundary pair (segment + route-key open, segment close)', () => {
  const r = _wrapWithChildrenMarker('CHILD', '/blog/[slug]', { slug: 'a' });
  assert.equal(r._$webjs, 'template');
  assert.equal(r.strings[0], '<!--wj:children:/blog/[slug]:/blog/a-->');
  assert.equal(r.strings[1], '<!--/wj:children:/blog/[slug]-->');
  assert.deepEqual(r.values, ['CHILD']);
});

test('wrapWithChildrenMarker: a static segment has a constant route-key', () => {
  const r = _wrapWithChildrenMarker('X', '/', {});
  assert.equal(r.strings[0], '<!--wj:children:/:/-->');
  assert.equal(r.strings[1], '<!--/wj:children:/-->');
});
