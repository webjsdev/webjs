/**
 * Search and share metadata (#1564): Next-shaped Open Graph / Twitter tags,
 * the SITE_URL-derived canonical and og defaults, auto-linked share images,
 * metadata routes that receive a context and serialize Next's sitemap array /
 * robots object, the `pages()` listing, and the status codes a crawler sees.
 */
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import { robots } from '../../src/sitemap.js';
import { applySeoDefaults, openGraphPairs, twitterPairs, setMetadataImageRoutes } from '../../src/ssr/seo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_URL = pathToFileURL(resolve(__dirname, '../../../core/src/html.js')).toString();
const SERVER_URL = pathToFileURL(resolve(__dirname, '../../index.js')).toString();
const CORE_URL = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();

let tmpRoot;
const savedSiteUrl = process.env.SITE_URL;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-seo-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });
afterEach(() => {
  if (savedSiteUrl === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = savedSiteUrl;
  setMetadataImageRoutes([]);
});

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

const page = (body, extra = '') =>
  `import { html } from ${JSON.stringify(HTML_URL)};\n${extra}\nexport default function P() { return html\`${body}\`; }\n`;

const id = (u) => String(u);

/* ------------ serialization ------------ */

test('openGraphPairs: Next shape emits valid og properties', () => {
  const pairs = openGraphPairs({
    siteName: 'Shop',
    images: ['/a.png', { url: '/b.png', width: 1200, height: 630, alt: 'B' }],
    type: 'article',
    publishedTime: new Date('2026-01-02T00:00:00Z'),
    tags: ['x', 'y'],
  }, id);
  assert.deepEqual(pairs, [
    ['og:site_name', 'Shop'],
    ['og:image', '/a.png'],
    ['og:image', '/b.png'],
    ['og:image:width', '1200'],
    ['og:image:height', '630'],
    ['og:image:alt', 'B'],
    ['og:type', 'article'],
    ['article:published_time', '2026-01-02T00:00:00.000Z'],
    ['article:tag', 'x'],
    ['article:tag', 'y'],
  ]);
});

test('openGraphPairs: raw og keys still pass through', () => {
  assert.deepEqual(openGraphPairs({ image: '/a.png', site_name: 'S', 'image:width': '10' }, id), [
    ['og:image', '/a.png'], ['og:site_name', 'S'], ['og:image:width', '10'],
  ]);
});

test('twitterPairs: images become twitter:image with alt', () => {
  assert.deepEqual(twitterPairs({ card: 'summary', images: [{ url: '/t.png', alt: 'T' }], siteId: '9' }, id), [
    ['twitter:card', 'summary'], ['twitter:image', '/t.png'], ['twitter:image:alt', 'T'], ['twitter:site:id', '9'],
  ]);
});

test('robots(): serializes the Next robots shape', () => {
  assert.equal(
    robots({ rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }, { userAgent: 'BadBot', disallow: '/' }], sitemap: 'https://a.test/sitemap.xml' }),
    'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nUser-agent: BadBot\nDisallow: /\n\nSitemap: https://a.test/sitemap.xml\n',
  );
  assert.equal(robots(), 'User-agent: *\nAllow: /\n');
  // A newline in a data-derived value cannot add a rule.
  assert.equal(robots({ rules: { disallow: '/x\nAllow: /secret' } }), 'User-agent: *\nDisallow: /xAllow: /secret\n');
});

/* ------------ defaults ------------ */

test('applySeoDefaults: SITE_URL gives canonical, og:url and og defaults', () => {
  process.env.SITE_URL = 'https://shop.test/';
  const m = applySeoDefaults({ title: 'Menu', description: 'Food' }, { url: 'http://internal:3000/menu?page=2' });
  assert.equal(m.metadataBase, 'https://shop.test');
  assert.equal(m.alternates.canonical, '/menu');
  assert.deepEqual(m.openGraph, { title: 'Menu', description: 'Food', url: '/menu', type: 'website' });
  assert.equal(m.twitter.card, 'summary');
});

test('applySeoDefaults: explicit values win and canonical null opts out', () => {
  process.env.SITE_URL = 'https://shop.test';
  const m = applySeoDefaults({
    title: 'T', alternates: { canonical: null }, openGraph: { title: 'OG', type: 'article' }, twitter: { card: 'summary' },
  }, { url: 'http://x/a' });
  assert.equal(m.alternates.canonical, undefined);
  assert.equal(m.openGraph.title, 'OG');
  assert.equal(m.openGraph.type, 'article');
  assert.equal(m.openGraph.url, undefined);
  assert.equal(m.twitter.card, 'summary');
});

test('applySeoDefaults: no canonical from the request host without a site URL', () => {
  delete process.env.SITE_URL;
  const m = applySeoDefaults({ title: 'T' }, { url: 'http://evil.test/a' });
  assert.equal(m.alternates, undefined);
  assert.equal(m.openGraph.url, undefined);
});

test('applySeoDefaults: a page with no metadata gets nothing added', () => {
  delete process.env.SITE_URL;
  assert.deepEqual(applySeoDefaults({}, { url: 'http://x/' }), {});
});

test('applySeoDefaults: nearest opengraph-image route becomes og:image', () => {
  setMetadataImageRoutes([
    { stem: 'opengraph-image', urlPath: '/opengraph-image' },
    { stem: 'opengraph-image', urlPath: '/blog/opengraph-image' },
  ]);
  assert.deepEqual(applySeoDefaults({ title: 'a' }, { url: 'http://x/blog/post' }).openGraph.images, ['/blog/opengraph-image']);
  assert.deepEqual(applySeoDefaults({ title: 'a' }, { url: 'http://x/about' }).openGraph.images, ['/opengraph-image']);
  assert.equal(applySeoDefaults({ title: 'a' }, { url: 'http://x/about' }).twitter.card, 'summary_large_image');
  // A declared image is kept.
  assert.deepEqual(applySeoDefaults({ openGraph: { images: ['/mine.png'] } }, { url: 'http://x/' }).openGraph.images, ['/mine.png']);
});

/* ------------ through the request handler ------------ */

test('page head: canonical, og and twitter tags from SITE_URL and the og route', async () => {
  process.env.SITE_URL = 'https://shop.test';
  const appDir = makeApp({
    'app/menu/page.js': page('<h1>Menu</h1>', `export const metadata = { title: 'Menu', description: 'Our food', openGraph: { siteName: 'Shop' } };`),
    'app/opengraph-image.js': `export default () => new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } });`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const html = await (await app.handle(new Request('http://localhost/menu?ref=x'))).text();
  assert.match(html, /<link rel="canonical" href="https:\/\/shop\.test\/menu">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/shop\.test\/menu">/);
  assert.match(html, /<meta property="og:site_name" content="Shop">/);
  assert.match(html, /<meta property="og:title" content="Menu">/);
  assert.match(html, /<meta property="og:description" content="Our food">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/shop\.test\/opengraph-image">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /<h1>Menu<\/h1>/, 'content is in the server HTML');
});

test('sitemap route: array result + pages() lists static, dynamic and skips noindex', async () => {
  process.env.SITE_URL = 'https://shop.test';
  const appDir = makeApp({
    'app/page.js': page('<h1>Home</h1>'),
    'app/(marketing)/about/page.js': page('<h1>About</h1>'),
    'app/products/[id]/page.js': page('<h1>P</h1>', `export async function generateSitemapParams() { return [{ id: 'a b' }, { params: { id: '2' }, lastModified: '2026-01-01' }]; }`),
    'app/docs/[slug]/page.js': page('<h1>D</h1>'),
    'app/account/layout.js': `export const metadata = { robots: { index: false } };\nexport default ({ children }) => children;\n`,
    'app/account/page.js': page('<h1>Account</h1>'),
    'app/secret/page.js': page('<h1>S</h1>', `export const metadata = { robots: 'noindex, nofollow' };`),
    'app/sitemap.js': `export default async function sitemap({ pages }) { return [...await pages(), { url: '/extra', priority: 0.5 }]; }`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://localhost/sitemap.xml'));
  assert.equal(resp.status, 200);
  assert.match(resp.headers.get('content-type'), /application\/xml/);
  const xml = await resp.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  assert.deepEqual(locs, [
    'https://shop.test/',
    'https://shop.test/about',
    'https://shop.test/extra',
    'https://shop.test/products/2',
    'https://shop.test/products/a%20b',
  ]);
  assert.match(xml, /<lastmod>2026-01-01<\/lastmod>/);
});

test('robots route: object result serializes, siteUrl falls back to the request origin', async () => {
  delete process.env.SITE_URL;
  const appDir = makeApp({
    'app/page.js': page('<h1>Home</h1>'),
    'app/robots.js': `export default ({ siteUrl }) => ({ rules: { userAgent: '*', allow: '/', disallow: '/account' }, sitemap: siteUrl + '/sitemap.xml' });`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://shop.local:8080/robots.txt'));
  assert.equal(resp.status, 200);
  assert.match(resp.headers.get('content-type'), /text\/plain/);
  assert.equal(await resp.text(), 'User-agent: *\nAllow: /\nDisallow: /account\n\nSitemap: http://shop.local:8080/sitemap.xml\n');
});

test('robots helper is exported from @webjsdev/server', async () => {
  const mod = await import(SERVER_URL);
  assert.equal(typeof mod.robots, 'function');
});

test('nested metadata route answers under its segment', async () => {
  const appDir = makeApp({
    'app/page.js': page('<h1>Home</h1>'),
    'app/(site)/blog/opengraph-image.js': `export default () => new Response('blog-og', { headers: { 'content-type': 'image/svg+xml' } });`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://localhost/blog/opengraph-image'));
  assert.equal(resp.status, 200);
  assert.equal(await resp.text(), 'blog-og');
  assert.equal((await app.handle(new Request('http://localhost/opengraph-image'))).status, 404);
});

test('crawlers see 404 for an unknown URL and for notFound()', async () => {
  const appDir = makeApp({
    'app/page.js': page('<h1>Home</h1>'),
    'app/items/[id]/page.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `import { notFound } from ${JSON.stringify(CORE_URL)};\n` +
      `export default function P({ params }) { if (params.id !== '1') notFound(); return html\`<h1>Item</h1>\`; }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  assert.equal((await app.handle(new Request('http://localhost/nope'))).status, 404);
  assert.equal((await app.handle(new Request('http://localhost/items/2'))).status, 404);
  assert.equal((await app.handle(new Request('http://localhost/items/1'))).status, 200);
});
