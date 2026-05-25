import { test } from 'node:test';
import assert from 'node:assert/strict';

import { importMapTag, setVendorEntries, buildImportMap } from '../../src/importmap.js';

test('importMapTag: emits a bare script tag when no nonce is provided', () => {
  setVendorEntries({});
  const tag = importMapTag();
  assert.match(tag, /^<script type="importmap">/);
  assert.ok(!tag.includes('nonce='));
});

test('importMapTag: emits nonce attribute when provided', () => {
  setVendorEntries({});
  const tag = importMapTag({ nonce: 'abc123' });
  assert.match(tag, /^<script type="importmap" nonce="abc123">/);
});

test('importMapTag: HTML-escapes embedded quotes in nonce', () => {
  // Defensive: a malformed nonce shouldn't break tag structure even
  // though CSP-generated nonces are base64 and never contain quotes.
  setVendorEntries({});
  const tag = importMapTag({ nonce: 'a"b' });
  assert.ok(tag.includes('nonce="a&quot;b"'));
});

test('buildImportMap: framework entries always present', () => {
  setVendorEntries({});
  const map = buildImportMap();
  assert.equal(map.imports['@webjsdev/core'], '/__webjs/core/index.js');
  assert.equal(map.imports['@webjsdev/core/directives'], '/__webjs/core/src/directives.js');
});

test('buildImportMap: vendor entries merge alongside framework entries', () => {
  setVendorEntries({ 'dayjs': 'https://ga.jspm.io/npm:dayjs@1.11.20/dayjs.min.js' });
  const map = buildImportMap();
  assert.equal(map.imports['dayjs'], 'https://ga.jspm.io/npm:dayjs@1.11.20/dayjs.min.js');
  assert.equal(map.imports['@webjsdev/core'], '/__webjs/core/index.js');
  setVendorEntries({}); // reset for other tests
});
