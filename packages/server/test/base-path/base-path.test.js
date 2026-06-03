/**
 * Unit tests for the sub-path deployment helpers (issue #256):
 * normalizeBasePath / readBasePath / withBasePath / stripBasePath in
 * base-path.js.
 *
 * The headline invariant is that an empty base path (the default) makes
 * every helper a pure no-op, so an unconfigured app is byte-identical to
 * before the feature. The normalizer also rejects unsafe / malformed
 * values to '' so a typo or hostile config fails safe rather than
 * poisoning every emitted URL.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeBasePath,
  readBasePath,
  withBasePath,
  stripBasePath,
} from '../../src/base-path.js';

test('normalizeBasePath: empty / undefined / "/" -> ""', () => {
  assert.equal(normalizeBasePath(''), '');
  assert.equal(normalizeBasePath('/'), '');
  assert.equal(normalizeBasePath(undefined), '');
  assert.equal(normalizeBasePath(null), '');
  assert.equal(normalizeBasePath(42), '');
  assert.equal(normalizeBasePath('   '), '');
});

test('normalizeBasePath: "app", "/app", "/app/" all -> "/app"', () => {
  assert.equal(normalizeBasePath('app'), '/app');
  assert.equal(normalizeBasePath('/app'), '/app');
  assert.equal(normalizeBasePath('/app/'), '/app');
  assert.equal(normalizeBasePath('app/'), '/app');
  assert.equal(normalizeBasePath('  /app/  '), '/app');
});

test('normalizeBasePath: a nested "/foo/bar" is preserved', () => {
  assert.equal(normalizeBasePath('/foo/bar'), '/foo/bar');
  assert.equal(normalizeBasePath('foo/bar/'), '/foo/bar');
});

test('normalizeBasePath: rejects unsafe / malformed values to ""', () => {
  assert.equal(normalizeBasePath('../etc'), '', 'path traversal');
  assert.equal(normalizeBasePath('/a/../b'), '', 'interior traversal');
  assert.equal(normalizeBasePath('https://evil.com'), '', 'protocol');
  assert.equal(normalizeBasePath('//evil.com'), '', 'network-path reference');
  assert.equal(normalizeBasePath('/a b'), '', 'whitespace');
  assert.equal(normalizeBasePath('/a\\b'), '', 'backslash');
});

test('readBasePath: reads + normalizes webjs.basePath, defaults to ""', () => {
  assert.equal(readBasePath({ webjs: { basePath: '/app/' } }), '/app');
  assert.equal(readBasePath({ webjs: { basePath: 'app' } }), '/app');
  assert.equal(readBasePath({ webjs: {} }), '');
  assert.equal(readBasePath({}), '');
  assert.equal(readBasePath(null), '');
  assert.equal(readBasePath({ webjs: { basePath: '../x' } }), '', 'unsafe -> ""');
});

test('withBasePath: empty base path is a pure no-op', () => {
  assert.equal(withBasePath('/__webjs/core/index.js', ''), '/__webjs/core/index.js');
  assert.equal(withBasePath('/about', ''), '/about');
  assert.equal(withBasePath('https://cdn/x.js', ''), 'https://cdn/x.js');
});

test('withBasePath: prefixes same-origin absolute paths only', () => {
  assert.equal(withBasePath('/__webjs/core/index.js', '/app'), '/app/__webjs/core/index.js');
  assert.equal(withBasePath('/about', '/app'), '/app/about');
  // Cross-origin and protocol-relative URLs are left untouched (vendor CDN).
  assert.equal(withBasePath('https://cdn/x.js', '/app'), 'https://cdn/x.js');
  assert.equal(withBasePath('//cdn/x.js', '/app'), '//cdn/x.js');
  // A relative URL is left untouched.
  assert.equal(withBasePath('about', '/app'), 'about');
});

test('stripBasePath: empty base path is a pure pass-through', () => {
  assert.equal(stripBasePath('/about', ''), '/about');
  assert.equal(stripBasePath('/', ''), '/');
  assert.equal(stripBasePath('/__webjs/core/index.js', ''), '/__webjs/core/index.js');
});

test('stripBasePath: maps <base> and <base>/ to root, strips the prefix', () => {
  assert.equal(stripBasePath('/app', '/app'), '/');
  assert.equal(stripBasePath('/app/', '/app'), '/');
  assert.equal(stripBasePath('/app/about', '/app'), '/about');
  assert.equal(
    stripBasePath('/app/__webjs/core/index.js', '/app'),
    '/__webjs/core/index.js',
  );
  assert.equal(stripBasePath('/foo/bar/x', '/foo/bar'), '/x');
});

test('stripBasePath: a path NOT under the base path returns null', () => {
  // A shared prefix that is not a real segment boundary is not under it.
  assert.equal(stripBasePath('/application', '/app'), null);
  assert.equal(stripBasePath('/other', '/app'), null);
  assert.equal(stripBasePath('/', '/app'), null);
});
