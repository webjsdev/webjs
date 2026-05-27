import { test } from 'node:test';
import assert from 'node:assert/strict';

import { importMapTag, setVendorEntries, buildImportMap } from '../../src/importmap.js';

test('importMapTag: emits a bare script tag when no nonce is provided', () => {
  setVendorEntries({});
  const tag = importMapTag();
  assert.match(tag, /^<script type="importmap" data-webjs-build="[0-9a-f]{64}">/);
  assert.ok(!tag.includes('nonce='));
});

test('importMapTag: emits nonce attribute when provided', () => {
  setVendorEntries({});
  const tag = importMapTag({ nonce: 'abc123' });
  assert.match(tag, /^<script type="importmap" nonce="abc123" data-webjs-build="[0-9a-f]{64}">/);
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

test('importMapTag: escapes `</script>` in vendor URL (defense-in-depth XSS guard)', () => {
  // Pathological vendor entry: a URL containing a script-close
  // sequence. Without defensive escaping, JSON.stringify emits
  // </script> literally and closes the importmap tag, letting
  // injected content after it execute as fresh HTML / scripts.
  setVendorEntries({
    'evil': 'https://attacker.example/x.js?</script><img onerror=alert(1) src=x>',
  });
  const tag = importMapTag();
  // The script element body must NOT contain a closing </script>
  // sequence before the framework's intended closer.
  // Per jsonForScriptTag the </ becomes <\/.
  assert.ok(!/<\/script>\s*<(?:img|script)/i.test(tag),
    `unescaped </script> in tag: ${tag}`);
  assert.match(tag, /<\\\/script/, 'closing tag sequence escaped to <\\/script');
  setVendorEntries({});
});

test('buildImportMap: emits keys in sorted order (stable across boots/renames)', () => {
  // Regression: the client router's importmap-mismatch hard-reload
  // compares textContent. Filesystem-iteration order (which drives
  // scanner output) can change between deploys (e.g. after a file
  // rename), so logically-identical importmaps must serialize
  // identically. Otherwise the user gets a spurious full reload on
  // every nav until the order stabilizes.
  setVendorEntries(
    { 'z-pkg': 'https://x/z.js', 'a-pkg': 'https://x/a.js', 'm-pkg': 'https://x/m.js' },
    { 'https://x/z.js': 'sha384-zzz', 'https://x/a.js': 'sha384-aaa' },
  );
  const out = buildImportMap();
  const importKeys = Object.keys(out.imports);
  assert.deepEqual(importKeys, [...importKeys].sort(),
    `imports keys must be sorted; got: ${importKeys.join(',')}`);
  const intKeys = Object.keys(out.integrity);
  assert.deepEqual(intKeys, [...intKeys].sort(),
    `integrity keys must be sorted; got: ${intKeys.join(',')}`);
  // Verifying byte-identical output across two different insertion orders:
  setVendorEntries({ 'b': 'https://x/b.js', 'a': 'https://x/a.js' });
  const json1 = JSON.stringify(buildImportMap());
  setVendorEntries({ 'a': 'https://x/a.js', 'b': 'https://x/b.js' });
  const json2 = JSON.stringify(buildImportMap());
  assert.equal(json1, json2,
    'same content in different insertion order must produce byte-identical JSON');
  setVendorEntries({}); // reset
});

test('importMapTag: escapes U+2028 / U+2029 line separators in URLs', () => {
  // U+2028 / U+2029 are legal in JSON strings but historically
  // terminated JS strings, which would break the importmap parser.
  const u2028 = String.fromCharCode(0x2028);
  const u2029 = String.fromCharCode(0x2029);
  setVendorEntries({
    'a': `https://cdn.example/a${u2028}.js`,
    'b': `https://cdn.example/b${u2029}.js`,
  });
  const tag = importMapTag();
  assert.ok(!tag.includes(u2028), 'raw U+2028 must not survive');
  assert.ok(!tag.includes(u2029), 'raw U+2029 must not survive');
  assert.ok(tag.includes('\\u2028'), 'U+2028 must be escape-encoded');
  assert.ok(tag.includes('\\u2029'), 'U+2029 must be escape-encoded');
  setVendorEntries({});
});

test('importMapTag: escapes `<!--` to defeat HTML script-data-escaped state transition', () => {
  // The HTML5 tokenizer transitions to "script-data-escaped" when it
  // sees `<!--` inside a <script> body. From there a subsequent
  // `<script>` (any casing) hits "script-data-double-escaped" where
  // a later `</script>` no longer terminates the host element until
  // a matching `-->` arrives. Without escaping, a vendor URL
  // carrying `<!--<script>...</script>` could survive the `</` escape
  // and still break out.
  setVendorEntries({
    'evil': 'https://cdn.example/<!--<script>alert(1)</script>--><img src=x>.js',
  });
  const tag = importMapTag();
  assert.ok(!tag.includes('<!--'), 'raw <!-- must not survive');
  assert.ok(!tag.includes('-->'), 'raw --> must not survive');
  assert.ok(tag.includes('<\\!--'), '<!-- must be escape-encoded');
  assert.ok(tag.includes('--\\>'), '--> must be escape-encoded');
  setVendorEntries({});
});
