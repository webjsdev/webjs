/**
 * Tests for the sitemap helpers (issue #276): `sitemap(entries)` ->
 * `<urlset>` XML and `sitemapIndex(sitemaps)` -> `<sitemapindex>` XML.
 *
 * The unit tests assert structure + well-formedness without a dependency:
 * node ships no XML parser, so well-formedness is checked structurally
 * (declaration present, tags balanced, element order, escaped content). The
 * security-critical case (an unescaped `&` / `<` in a url breaking the XML or
 * injecting) is the headline assertion. The integration test drives the helper
 * output through createRequestHandler to prove `app/sitemap.js` returning
 * `sitemap([...])` is served at /sitemap.xml as application/xml.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sitemap, sitemapIndex } from '../../src/sitemap.js';
import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITEMAP_SRC = resolve(__dirname, '../../src/sitemap.js');
const SITEMAP_URL = pathToFileURL(SITEMAP_SRC).toString();

/* ----------------------------- helpers ----------------------------- */

/** A minimal balance check: every opening tag has a matching close, no parser. */
function tagsBalanced(xml) {
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w:.-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    const [, closing, name, attrs, selfClose] = m;
    if (name === '?xml') continue; // declaration
    if (selfClose || attrs.endsWith('/')) continue;
    if (closing) {
      if (stack.pop() !== name) return false;
    } else {
      stack.push(name);
    }
  }
  return stack.length === 0;
}

/* ----------------------------- basic urlset ----------------------------- */

test('sitemap() emits an XML declaration + a urlset with one <url> per entry', () => {
  const xml = sitemap([
    { url: 'https://example.com/', lastModified: '2026-01-01', changeFrequency: 'daily', priority: 1 },
    { url: 'https://example.com/about', priority: 0.8 },
    { url: 'https://example.com/contact' },
  ]);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.equal((xml.match(/<url>/g) || []).length, 3);
  assert.equal((xml.match(/<\/url>/g) || []).length, 3);
  // first entry carries all four elements, in spec order
  assert.match(xml, /<loc>https:\/\/example\.com\/<\/loc>\s*<lastmod>2026-01-01<\/lastmod>\s*<changefreq>daily<\/changefreq>\s*<priority>1\.0<\/priority>/);
  // priority is formatted to one decimal
  assert.match(xml, /<priority>0\.8<\/priority>/);
  assert.ok(tagsBalanced(xml), 'tags must be balanced (well-formed)');
});

/* -------------------- XML escaping (security-critical) -------------------- */

test('sitemap() XML-escapes the loc so a url with & < > " \' cannot break out', () => {
  const xml = sitemap([
    { url: 'https://x.com/?a=1&b=2&c=<script>alert("x")</script>&d=\'q\'' },
  ]);
  // ASSERTION (the breakout test): the loc text contains no raw `<` and no raw
  // `&` other than the entity-introducing ampersands, and the literal
  // `<script>` does not survive.
  const loc = xml.match(/<loc>([\s\S]*?)<\/loc>/)[1];
  assert.ok(!loc.includes('<script>'), 'literal <script> must not survive in the loc');
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(loc), 'no raw & survives (only XML entities)');
  assert.ok(!/<(?!\/?)/.test(loc) && !loc.includes('<'), 'no raw < survives in the loc');
  assert.match(loc, /&amp;b=2&amp;c=&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;&amp;d=&apos;q&apos;/);
  assert.ok(tagsBalanced(xml), 'escaped output is still well-formed');
});

/* ----------------------------- lastModified ----------------------------- */

test('sitemap() formats a Date as ISO and passes a string through', () => {
  const d = new Date('2026-06-01T12:00:00.000Z');
  const xml = sitemap([
    { url: 'https://example.com/a', lastModified: d },
    { url: 'https://example.com/b', lastModified: '2026-06-02' },
  ]);
  assert.match(xml, /<loc>https:\/\/example\.com\/a<\/loc>\s*<lastmod>2026-06-01T12:00:00\.000Z<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/example\.com\/b<\/loc>\s*<lastmod>2026-06-02<\/lastmod>/);
});

/* ----------------------------- validation / skip ----------------------------- */

test('sitemap() skips a urlless entry and drops out-of-range priority / invalid changefreq', () => {
  const xml = sitemap([
    { url: 'https://example.com/good', priority: 5, changeFrequency: 'often' },
    { lastModified: '2026-01-01' },               // no url -> skipped
    { url: '' },                                  // empty url -> skipped
    { url: 42 },                                  // non-string url -> skipped
  ]);
  // exactly one <url> (only the valid entry)
  assert.equal((xml.match(/<url>/g) || []).length, 1);
  assert.match(xml, /<loc>https:\/\/example\.com\/good<\/loc>/);
  // the out-of-range priority (5) is dropped, the invalid changefreq dropped,
  // but the <url> still emits
  assert.ok(!xml.includes('<priority>'), 'out-of-range priority dropped');
  assert.ok(!xml.includes('<changefreq>'), 'invalid changefreq dropped');
  assert.ok(tagsBalanced(xml));
});

test('sitemap() with no entries is an empty but well-formed urlset', () => {
  const xml = sitemap([]);
  assert.match(xml, /<urlset[^>]*>\s*<\/urlset>/);
  assert.ok(tagsBalanced(xml));
  // a non-array argument is tolerated (treated as empty)
  assert.ok(tagsBalanced(sitemap(undefined)));
});

/* ----------------------------- sitemapIndex ----------------------------- */

test('sitemapIndex() emits a <sitemapindex> with one <sitemap><loc> per entry, escaped + lastmod', () => {
  const xml = sitemapIndex([
    { url: 'https://example.com/sitemaps/posts.xml', lastModified: new Date('2026-06-01T00:00:00.000Z') },
    { url: 'https://example.com/sitemaps/a&b.xml' },
    { url: '' }, // skipped
  ]);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.match(xml, /<sitemapindex xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.equal((xml.match(/<sitemap>/g) || []).length, 2, 'only the two valid entries');
  assert.match(xml, /<loc>https:\/\/example\.com\/sitemaps\/posts\.xml<\/loc>\s*<lastmod>2026-06-01T00:00:00\.000Z<\/lastmod>/);
  // the & in the second child url is escaped
  assert.match(xml, /<loc>https:\/\/example\.com\/sitemaps\/a&amp;b\.xml<\/loc>/);
  assert.ok(!/&(?!amp;)/.test(xml.match(/a&amp;b/)[0]), 'no raw & survives in the index loc');
  assert.ok(tagsBalanced(xml));
});

/* -------- integration: helper output reaches /sitemap.xml as XML -------- */

test('app/sitemap.js returning sitemap([...]) is served at /sitemap.xml as application/xml', async () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-sitemap-'));
  try {
    const appDir = mkdtempSync(join(tmpRoot, 'app-'));
    writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'sitemap-app' }));
    mkdirSync(join(appDir, 'app'), { recursive: true });
    // The fixture imports the helper by its absolute file URL (the workspace
    // resolution of @webjsdev/server is not guaranteed inside a tmp app).
    writeFileSync(join(appDir, 'app', 'sitemap.js'),
      `import { sitemap } from ${JSON.stringify(SITEMAP_URL)};\n` +
      `export default function () {\n` +
      `  return sitemap([\n` +
      `    { url: 'https://example.com/', changeFrequency: 'daily', priority: 1 },\n` +
      `    { url: 'https://example.com/a?x=1&y=2' },\n` +
      `  ]);\n` +
      `}\n`
    );
    const app = await createRequestHandler({ appDir, dev: true });
    const resp = await app.handle(new Request('http://x/sitemap.xml'));
    assert.equal(resp.status, 200);
    assert.match(resp.headers.get('content-type') || '', /application\/xml/);
    const body = await resp.text();
    assert.ok(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.match(body, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    assert.equal((body.match(/<url>/g) || []).length, 2);
    // the & from the helper call is escaped end-to-end through the served body
    assert.match(body, /<loc>https:\/\/example\.com\/a\?x=1&amp;y=2<\/loc>/);
    assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(body), 'served XML has no raw &');
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});
