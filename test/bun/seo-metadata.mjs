/**
 * Cross-runtime proof for the search and share metadata (#1564): boot a real
 * app through `startServer` under WHICHEVER runtime runs this file and assert
 * the head, sitemap and robots a crawler reads.
 *
 *   node test/bun/seo-metadata.mjs   # the node:http shell
 *   bun  test/bun/seo-metadata.mjs   # the Bun.serve shell
 *
 * The metadata routes now receive a context built from the request (its origin
 * becomes `siteUrl` when no SITE_URL is set), and a request reaches them through
 * a different listener on each runtime, so both are asserted. A plain assert
 * script (not node:test) so the same file runs on both; the verdict is reported
 * through an explicit exit code.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../packages/core/index.js')).toString();
const { startServer } = await import(pathToFileURL(resolve(__dirname, '../../packages/server/index.js')).toString());
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'wj-seo-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };
const savedSiteUrl = process.env.SITE_URL;

let close;
/** @type {unknown} */
let failure = null;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'seo', type: 'module', webjs: {} }));
  w('app/page.ts', `import { html } from ${JSON.stringify(CORE)};\nexport const metadata = { title: 'Shop', description: 'Fresh bread', openGraph: { siteName: 'Shop', images: [{ url: '/og.png', width: 1200, alt: 'Bread' }] } };\nexport default () => html\`<h1>Shop</h1>\`;`);
  w('app/items/[id]/page.ts', `import { html } from ${JSON.stringify(CORE)};\nexport async function generateSitemapParams() { return [{ id: '7' }]; }\nexport default () => html\`<h1>Item</h1>\`;`);
  w('app/account/page.ts', `import { html } from ${JSON.stringify(CORE)};\nexport const metadata = { robots: { index: false } };\nexport default () => html\`<h1>Account</h1>\`;`);
  w('app/sitemap.ts', `export default async ({ pages }: { pages: () => Promise<unknown[]> }) => pages();`);
  w('app/robots.ts', `export default ({ siteUrl }: { siteUrl: string }) => ({ rules: { userAgent: '*', allow: '/', disallow: '/account' }, sitemap: siteUrl + '/sitemap.xml' });`);

  let server;
  ({ server, close } = await startServer({ appDir: dir, dev: true, port: 0, logger: quiet }));
  const port = typeof server.port === 'number' ? server.port : server.address().port;
  const base = `http://localhost:${port}`;

  // Without SITE_URL: no canonical from the (client-influenced) host, but the
  // Next-shaped og tags are valid.
  delete process.env.SITE_URL;
  let html = await (await fetch(`${base}/`)).text();
  assert.doesNotMatch(html, /rel="canonical"/, `no canonical without a site URL on ${runtime}`);
  assert.match(html, /<meta property="og:site_name" content="Shop">/, `og:site_name on ${runtime}`);
  assert.match(html, /<meta property="og:image:alt" content="Bread">/, `og:image:alt on ${runtime}`);
  assert.match(html, /<h1>Shop<\/h1>/, `content is server-rendered on ${runtime}`);

  // robots.txt and the sitemap fall back to the request origin.
  let robots = await (await fetch(`${base}/robots.txt`)).text();
  assert.equal(robots, `User-agent: *\nAllow: /\nDisallow: /account\n\nSitemap: ${base}/sitemap.xml\n`, `robots.txt on ${runtime}`);

  // With SITE_URL: canonical, og:url and sitemap URLs use it.
  process.env.SITE_URL = 'https://shop.test';
  html = await (await fetch(`${base}/?utm=1`)).text();
  assert.match(html, /<link rel="canonical" href="https:\/\/shop\.test\/">/, `canonical from SITE_URL on ${runtime}`);
  assert.match(html, /<meta property="og:image" content="https:\/\/shop\.test\/og\.png">/, `absolute og:image on ${runtime}`);
  const xml = await (await fetch(`${base}/sitemap.xml`)).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  assert.deepEqual(locs, ['https://shop.test/', 'https://shop.test/items/7'], `sitemap pages() on ${runtime}`);

  const missing = await fetch(`${base}/nope`);
  assert.equal(missing.status, 404, `unknown URL is 404 on ${runtime}`);
  await missing.text();
  console.log(`ok seo metadata on ${runtime}`);
} catch (e) {
  failure = e;
} finally {
  if (savedSiteUrl === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = savedSiteUrl;
  if (close) await close();
  rmSync(dir, { recursive: true, force: true });
}
if (failure) {
  console.error(failure);
  process.exit(1);
}
