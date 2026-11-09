/**
 * Next.js metadata parity: `generateMetadata(props, parent)` and
 * `generateViewport(props, parent)` receive the parent segments' resolved
 * values, a control-flow throw from generateMetadata answers the request,
 * `themeColor` accepts Next's descriptor array, and `robots.googleBot` accepts
 * Next's object form (a port of resolveRobotsValue).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_MODULE_URL = pathToFileURL(resolve(__dirname, '../../packages/core/src/html.js')).toString();
const CORE_URL = pathToFileURL(resolve(__dirname, '../../packages/core/index.js')).toString();

let ssrPage, _buildDocumentParts, resolveRobotsValue, themeColorList;
let tmpDir;

before(async () => {
  ({ ssrPage, _buildDocumentParts } = await import('../../packages/server/src/ssr.js'));
  ({ resolveRobotsValue, themeColorList } = await import('../../packages/server/src/ssr/head.js'));
  tmpDir = mkdtempSync(join(tmpdir(), 'webjs-meta-parity-'));
});
after(() => rmSync(tmpDir, { recursive: true, force: true }));

function head(metadata) {
  return _buildDocumentParts('<main>p</main>', { metadata, moduleUrls: [], dev: false, streaming: false }).prefix;
}

function layered(...sources) {
  const appDir = mkdtempSync(join(tmpDir, 'app-'));
  const pageFile = join(appDir, 'page.js');
  writeFileSync(pageFile,
    `import { html } from ${JSON.stringify(HTML_MODULE_URL)};\n` +
    `export default function P() { return html\`<main>p</main>\`; }\n`);
  const metadataFiles = sources.map((src, i) => {
    const f = join(appDir, `meta-${i}.js`);
    writeFileSync(f, src);
    return f;
  });
  return { route: { file: pageFile, layouts: [], errors: [], metadataFiles }, appDir };
}

test('generateMetadata receives a parent promise of the outer segments, title normalized', async () => {
  const { route, appDir } = layered(
    `export const metadata = { title: { template: '%s | Site', default: 'Site' }, openGraph: { images: ['/root.png'] } };`,
    `export async function generateMetadata(props, parent) {\n` +
    `  const p = await parent;\n` +
    `  const prev = (p.openGraph && p.openGraph.images) || [];\n` +
    `  return { title: 'Post (' + p.title.absolute + ' / ' + p.title.template + ')', openGraph: { images: ['/post.png', ...prev] } };\n` +
    `}`,
  );
  const html = await (await ssrPage(route, {}, new URL('http://localhost/'), { dev: false, appDir })).text();
  assert.match(html, /<title>Post \(Site \/ %s \| Site\) \| Site<\/title>/);
  assert.match(html, /og:image" content="\/post\.png"/);
  assert.match(html, /og:image" content="\/root\.png"/);
});

test('generateViewport receives a parent promise of the outer viewport', async () => {
  const { route, appDir } = layered(
    `export const viewport = { themeColor: '#111111', colorScheme: 'dark' };`,
    `export async function generateViewport(props, parent) {\n` +
    `  const p = await parent;\n` +
    `  return { themeColor: [{ color: p.themeColor, media: '(prefers-color-scheme: dark)' }, { color: '#ffffff', media: '(prefers-color-scheme: light)' }] };\n` +
    `}`,
  );
  const html = await (await ssrPage(route, {}, new URL('http://localhost/'), { dev: false, appDir })).text();
  assert.match(html, /<meta name="theme-color" content="#111111" media="\(prefers-color-scheme: dark\)">/);
});

test('notFound() thrown from generateMetadata answers 404 like a page throw', async () => {
  const { route, appDir } = layered(
    `import { notFound } from ${JSON.stringify(CORE_URL)};\n` +
    `export async function generateMetadata() { notFound(); }`,
  );
  const resp = await ssrPage(route, {}, new URL('http://localhost/x'), { dev: false, appDir });
  assert.equal(resp.status, 404);
});

test('redirect() thrown from generateMetadata answers a redirect', async () => {
  const { route, appDir } = layered(
    `import { redirect } from ${JSON.stringify(CORE_URL)};\n` +
    `export async function generateMetadata() { redirect('/elsewhere'); }`,
  );
  const resp = await ssrPage(route, {}, new URL('http://localhost/x'), { dev: false, appDir });
  assert.equal(resp.status, 302);
  assert.equal(new URL(resp.headers.get('location'), 'http://localhost').pathname, '/elsewhere');
});

test('themeColor array emits one <meta> per descriptor with media', () => {
  const html = head({ themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'cyan' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ] });
  assert.match(html, /<meta name="theme-color" content="cyan" media="\(prefers-color-scheme: light\)">/);
  assert.match(html, /<meta name="theme-color" content="black" media="\(prefers-color-scheme: dark\)">/);
  assert.deepEqual(themeColorList('#fff'), [{ color: '#fff' }]);
  assert.deepEqual(themeColorList({ color: 'red' }), [{ color: 'red' }]);
  assert.deepEqual(themeColorList(null), []);
});

test('robots.googleBot object form resolves like Next (resolveRobotsValue port)', () => {
  const html = head({ robots: {
    index: true, follow: false, nocache: true,
    googleBot: { index: true, follow: true, noimageindex: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  } });
  assert.match(html, /<meta name="robots" content="index, nofollow, nocache">/);
  assert.match(html, /<meta name="googlebot" content="index, follow, noimageindex, max-video-preview:-1, max-image-preview:large, max-snippet:-1">/);
  assert.equal(resolveRobotsValue('noindex'), 'noindex');
  assert.equal(resolveRobotsValue({}), null);
  assert.equal(resolveRobotsValue({ noarchive: false }), null, 'a false directive is omitted');
});
