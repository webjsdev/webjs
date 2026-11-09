/**
 * `staticPageRoutes` lists the URL of every static page route in a table. The
 * website's `/llms.txt` builds its page list from it, so a normalization bug
 * that dropped every route would empty that index silently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { staticPageRoutes } from '../../src/router.js';

test('the root route is /', () => {
  assert.deepEqual(staticPageRoutes({ pages: [{ routeDir: '.' }] }), ['/']);
  assert.deepEqual(staticPageRoutes({ pages: [{ routeDir: '' }] }), ['/']);
});

test('a dynamic page is excluded (listing it would mean inventing params)', () => {
  const table = { pages: [
    { routeDir: 'blog', paramNames: [] },
    { routeDir: 'blog/[slug]', paramNames: ['slug'] },
    { routeDir: 'docs/[...rest]', paramNames: ['rest'] },
  ] };
  assert.deepEqual(staticPageRoutes(table), ['/blog']);
});

test('route groups and _private segments drop out of the URL', () => {
  const table = { pages: [
    { routeDir: '(marketing)/about' },
    { routeDir: 'shop/_internal/cart' },
    { routeDir: '(a)/(b)' },
  ] };
  assert.deepEqual(staticPageRoutes(table), ['/', '/about', '/shop/cart']);
});

test('output is sorted and deduped', () => {
  // Two route dirs can normalize to the same URL (a group wrapper plus the
  // bare path).
  const table = { pages: [
    { routeDir: 'z' }, { routeDir: 'a' }, { routeDir: '(g)/a' },
  ] };
  assert.deepEqual(staticPageRoutes(table), ['/a', '/z']);
});

test('a missing or empty page list yields an empty list, never a throw', () => {
  assert.deepEqual(staticPageRoutes({}), []);
  assert.deepEqual(staticPageRoutes({ pages: [] }), []);
  assert.deepEqual(staticPageRoutes(undefined), []);
});
