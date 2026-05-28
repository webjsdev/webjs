import { test } from 'node:test';
import assert from 'node:assert/strict';

import { importMapTag, setVendorEntries, buildImportMap } from '../../src/importmap.js';

test('importMapTag: emits a bare script tag when no nonce is provided', async () => {
  await setVendorEntries({});
  const tag = importMapTag();
  assert.match(tag, /^<script type="importmap" data-webjs-build="[0-9a-f]{64}">/);
  assert.ok(!tag.includes('nonce='));
});

test('importMapTag: emits nonce attribute when provided', async () => {
  await setVendorEntries({});
  const tag = importMapTag({ nonce: 'abc123' });
  assert.match(tag, /^<script type="importmap" nonce="abc123" data-webjs-build="[0-9a-f]{64}">/);
});

test('importMapTag: HTML-escapes embedded quotes in nonce', async () => {
  // Defensive: a malformed nonce shouldn't break tag structure even
  // though CSP-generated nonces are base64 and never contain quotes.
  await setVendorEntries({});
  const tag = importMapTag({ nonce: 'a"b' });
  assert.ok(tag.includes('nonce="a&quot;b"'));
});

test('buildImportMap: framework entries always present', async () => {
  await setVendorEntries({});
  const map = buildImportMap();
  assert.equal(map.imports['@webjsdev/core'], '/__webjs/core/index.js');
  assert.equal(map.imports['@webjsdev/core/directives'], '/__webjs/core/src/directives.js');
});

test('buildImportMap: vendor entries merge alongside framework entries', async () => {
  await setVendorEntries({ 'dayjs': 'https://ga.jspm.io/npm:dayjs@1.11.20/dayjs.min.js' });
  const map = buildImportMap();
  assert.equal(map.imports['dayjs'], 'https://ga.jspm.io/npm:dayjs@1.11.20/dayjs.min.js');
  assert.equal(map.imports['@webjsdev/core'], '/__webjs/core/index.js');
  await setVendorEntries({}); // reset for other tests
});

test('importMapTag: escapes `</script>` in vendor URL (defense-in-depth XSS guard)', async () => {
  // Pathological vendor entry: a URL containing a script-close
  // sequence. Without defensive escaping, JSON.stringify emits
  // </script> literally and closes the importmap tag, letting
  // injected content after it execute as fresh HTML / scripts.
  await setVendorEntries({
    'evil': 'https://attacker.example/x.js?</script><img onerror=alert(1) src=x>',
  });
  const tag = importMapTag();
  // The script element body must NOT contain a closing </script>
  // sequence before the framework's intended closer.
  // Per jsonForScriptTag the </ becomes <\/.
  assert.ok(!/<\/script>\s*<(?:img|script)/i.test(tag),
    `unescaped </script> in tag: ${tag}`);
  assert.match(tag, /<\\\/script/, 'closing tag sequence escaped to <\\/script');
  await setVendorEntries({});
});

test('buildImportMap: emits keys in sorted order (stable across boots/renames)', async () => {
  // Regression: the client router's importmap-mismatch hard-reload
  // compares textContent. Filesystem-iteration order (which drives
  // scanner output) can change between deploys (e.g. after a file
  // rename), so logically-identical importmaps must serialize
  // identically. Otherwise the user gets a spurious full reload on
  // every nav until the order stabilizes.
  await setVendorEntries(
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
  await setVendorEntries({ 'b': 'https://x/b.js', 'a': 'https://x/a.js' });
  const json1 = JSON.stringify(buildImportMap());
  await setVendorEntries({ 'a': 'https://x/a.js', 'b': 'https://x/b.js' });
  const json2 = JSON.stringify(buildImportMap());
  assert.equal(json1, json2,
    'same content in different insertion order must produce byte-identical JSON');
  await setVendorEntries({}); // reset
});

test('importMapTag: escapes U+2028 / U+2029 line separators in URLs', async () => {
  // U+2028 / U+2029 are legal in JSON strings but historically
  // terminated JS strings, which would break the importmap parser.
  const u2028 = String.fromCharCode(0x2028);
  const u2029 = String.fromCharCode(0x2029);
  await setVendorEntries({
    'a': `https://cdn.example/a${u2028}.js`,
    'b': `https://cdn.example/b${u2029}.js`,
  });
  const tag = importMapTag();
  assert.ok(!tag.includes(u2028), 'raw U+2028 must not survive');
  assert.ok(!tag.includes(u2029), 'raw U+2029 must not survive');
  assert.ok(tag.includes('\\u2028'), 'U+2028 must be escape-encoded');
  assert.ok(tag.includes('\\u2029'), 'U+2029 must be escape-encoded');
  await setVendorEntries({});
});

test('importMapHash: changes when vendor entries change, stable when they do not', async () => {
  const { importMapHash } = await import('../../src/importmap.js');
  await setVendorEntries({});
  const h1 = importMapHash();
  // Same input → same hash (cache returns identical value).
  assert.equal(importMapHash(), h1);
  await setVendorEntries({ a: 'https://cdn.example/a.js' });
  const h2 = importMapHash();
  assert.notEqual(h2, h1, 'adding a vendor entry must change the hash');
  // Resetting to the prior state recomputes back to the same hash
  // (deterministic, no hidden state).
  await setVendorEntries({});
  assert.equal(importMapHash(), h1, 'reverting must restore the original hash');
});

test('importMapHash: integrity change alone changes the hash', async () => {
  const { importMapHash } = await import('../../src/importmap.js');
  await setVendorEntries({ a: 'https://cdn.example/a.js' });
  const without = importMapHash();
  await setVendorEntries(
    { a: 'https://cdn.example/a.js' },
    { 'https://cdn.example/a.js': 'sha384-abcd' },
  );
  const withInt = importMapHash();
  assert.notEqual(withInt, without, 'adding integrity must invalidate the hash');
  await setVendorEntries({});
});

test('importMapTag: escapes `<!--` to defeat HTML script-data-escaped state transition', async () => {
  // The HTML5 tokenizer transitions to "script-data-escaped" when it
  // sees `<!--` inside a <script> body. From there a subsequent
  // `<script>` (any casing) hits "script-data-double-escaped" where
  // a later `</script>` no longer terminates the host element until
  // a matching `-->` arrives. Without escaping, a vendor URL
  // carrying `<!--<script>...</script>` could survive the `</` escape
  // and still break out.
  await setVendorEntries({
    'evil': 'https://cdn.example/<!--<script>alert(1)</script>--><img src=x>.js',
  });
  const tag = importMapTag();
  assert.ok(!tag.includes('<!--'), 'raw <!-- must not survive');
  assert.ok(!tag.includes('-->'), 'raw --> must not survive');
  assert.ok(tag.includes('<\\!--'), '<!-- must be escape-encoded');
  assert.ok(tag.includes('--\\>'), '--> must be escape-encoded');
  await setVendorEntries({});
});

test('importMapHash: empty string before any setVendorEntries call', async () => {
  // Documents the embed/test edge case. Module-fresh imports start
  // with an empty hash; the client router treats an empty
  // X-Webjs-Build as "version unknown" and skips the drift check.
  // We can't reset the singleton; the existing tests have already
  // called setVendorEntries earlier, so reimport via a fresh URL.
  const url = new URL('../../src/importmap.js', import.meta.url).href +
    `?fresh=${Date.now()}-${Math.random()}`;
  const fresh = await import(url);
  assert.equal(fresh.importMapHash(), '',
    'importMapHash() must return empty string until setVendorEntries runs');
});

test('importMapHash: hash available synchronously after await setVendorEntries', async () => {
  // The precompute design contract: setVendorEntries computes the
  // hash inside its body before returning, so the SSR hot path can
  // read it synchronously without ever crossing a Promise boundary.
  const { setVendorEntries, importMapHash } = await import('../../src/importmap.js');
  await setVendorEntries({ 'lib-x': 'https://cdn/lib-x.js' });
  const h = importMapHash();
  assert.match(h, /^[0-9a-f]{64}$/,
    'hash must be a 64-char SHA-256 hex string immediately after await');
  await setVendorEntries({});
});

/* ---------- setCoreDistMode: dist vs src URL routing ---------- */

test('setCoreDistMode(false): @webjsdev/core/* maps to /__webjs/core/src/*', async () => {
  const { setCoreDistMode, buildImportMap } = await import('../../src/importmap.js');
  await setVendorEntries({});
  await setCoreDistMode(false);
  const map = buildImportMap();
  assert.equal(map.imports['@webjsdev/core'], '/__webjs/core/index.js');
  assert.equal(map.imports['@webjsdev/core/directives'], '/__webjs/core/src/directives.js');
  assert.equal(map.imports['@webjsdev/core/client-router'], '/__webjs/core/src/router-client.js');
  assert.equal(map.imports['@webjsdev/core/'], '/__webjs/core/src/');
});

test('setCoreDistMode(true): @webjsdev/core/* maps to /__webjs/core/dist/webjs-core-*', async () => {
  const { setCoreDistMode, buildImportMap } = await import('../../src/importmap.js');
  await setVendorEntries({});
  await setCoreDistMode(true);
  const map = buildImportMap();
  assert.equal(map.imports['@webjsdev/core'], '/__webjs/core/dist/webjs-core.js');
  assert.equal(map.imports['@webjsdev/core/directives'], '/__webjs/core/dist/webjs-core-directives.js');
  assert.equal(map.imports['@webjsdev/core/client-router'], '/__webjs/core/dist/webjs-core-client-router.js');
  // Catch-all prefix stays on src/ in BOTH modes so the unbundled
  // subpaths (./client, ./server, ./component, ./registry,
  // ./signals) still resolve.
  assert.equal(map.imports['@webjsdev/core/'], '/__webjs/core/src/');
  // Reset to false so other tests aren't surprised by the toggle.
  await setCoreDistMode(false);
});

test('setCoreDistMode: toggling invalidates importMapHash', async () => {
  const { setCoreDistMode, importMapHash } = await import('../../src/importmap.js');
  await setVendorEntries({ 'a': 'https://cdn/a.js' });
  await setCoreDistMode(false);
  const h1 = importMapHash();
  await setCoreDistMode(true);
  const h2 = importMapHash();
  await setCoreDistMode(false);
  const h3 = importMapHash();
  assert.notEqual(h1, h2, 'switching to dist must change the hash');
  assert.equal(h1, h3, 'switching back must restore the original hash');
  await setVendorEntries({});
});
