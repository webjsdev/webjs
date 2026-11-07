/**
 * Every /ui page is readable and discoverable by an agent (#1666).
 *
 * WebJs UI is where an agent learns how a WebJs app is written, so /llms.txt
 * has to reach every /ui page, every page has a markdown form with its demos'
 * source in it, and the sitemap lists every page a crawler should fetch. The
 * lists are derived (lib/ui/llm.server.ts), so these tests compare them with
 * the data the pages themselves render from: a page added to the nav, the
 * component records, DOC_PAGES or the registry, and left out of the index,
 * fails here.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { COMPONENTS } from '#modules/ui/docs/nav.ts';
import { COMPONENT_DOCS } from '#modules/ui/docs/components/index.ts';
import { DOC_PAGES } from '#modules/ui/docs/pages/index.ts';
import { listBlocks } from '#modules/ui/queries/blocks.server.ts';
import { listUiPages, renderUiIndexSection } from '#lib/ui/llm.server.ts';
import { uiMarkdownHref, uiPathFromSlug } from '#lib/ui/llm-path.ts';
import { parseHtml, toMarkdown } from '#lib/html-to-markdown.ts';
import Sitemap from '#app/sitemap.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let handle: (path: string) => Promise<Response>;
let llms = '';
let uiLlms = '';

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
  llms = await (await handle('/llms.txt')).text();
  uiLlms = await (await handle('/ui/llms.txt')).text();
});

/** The markdown links in an llms.txt body, as [title, url] pairs. */
const links = (body: string) => [...body.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);

/** The /ui page paths an llms.txt body links the markdown of. */
const listedPaths = (body: string) => new Set(
  links(body)
    .map((u) => new URL(u, 'http://localhost').pathname)
    .filter((p) => p === '/ui/llm' || p.startsWith('/ui/llm/'))
    .map((p) => uiPathFromSlug(p.slice('/ui/llm'.length).split('/'))),
);

/** Which of `expected` a listing leaves out. The coverage assertions all go through it. */
const missingFrom = (listed: Set<string>, expected: string[]) => expected.filter((p) => !listed.has(p));

/** The DOC_PAGES keys whose module loads (one still being written is not a page yet). */
async function loadableDocPages(): Promise<string[]> {
  const out: string[] = [];
  for (const [key, load] of Object.entries(DOC_PAGES)) {
    try {
      await load();
      out.push(key);
    } catch { /* not a servable page */ }
  }
  return out;
}

test('/llms.txt and /ui/llms.txt list every component, docs page and block category', async () => {
  const blocks = await listBlocks();
  const categories = [...new Set(blocks.flatMap((b) => b.categories))];
  const expected = [
    ...Object.keys(COMPONENT_DOCS).map((slug) => `/ui/docs/components/${slug}`),
    ...COMPONENTS.map((c) => `/ui/docs/components/${c.slug}`),
    ...(await loadableDocPages()).map((key) => `/ui/docs/${key}`),
    '/ui', '/ui/docs', '/ui/docs/components', '/ui/docs/directory', '/ui/blocks', '/ui/typeset',
  ];
  for (const body of [llms, uiLlms]) {
    const listed = listedPaths(body);
    assert.ok(listed.size > 100, `expected the whole /ui section, found ${listed.size} pages`);
    assert.deepEqual(missingFrom(listed, expected), []);
    // Every block category that has a block is listed (the BLOCK_CATEGORIES
    // slugs a block carries, like "sidebar" or "login").
    const cats = categories.filter((c) => [...listed].some((p) => p === `/ui/blocks/${c}`));
    assert.ok(cats.length >= 3, `block categories listed: ${cats.join(', ')}`);
  }
});

test('the coverage check fails when a page is missing (counterfactual)', async () => {
  const listed = listedPaths(llms);
  // A component the nav does not have is reported, so a real one left out of
  // the index would be too.
  assert.deepEqual(missingFrom(listed, ['/ui/docs/components/not-a-component']), ['/ui/docs/components/not-a-component']);
  // And a listing built from a page list without one component drops it.
  const pages = (await listUiPages('http://localhost')).filter((p) => p.path !== '/ui/docs/components/switch');
  const partial = listedPaths((await renderUiIndexSection('http://localhost', pages)).join('\n'));
  assert.deepEqual(missingFrom(partial, ['/ui/docs/components/switch']), ['/ui/docs/components/switch']);
});

test('every registry block is listed with its add command', async () => {
  const blocks = await listBlocks();
  assert.ok(blocks.length > 5);
  const missing = blocks.filter((b) => !llms.includes(`npx @webjsdev/ui add ${b.name}\``) || !uiLlms.includes(`npx @webjsdev/ui add ${b.name}\``));
  assert.deepEqual(missing.map((b) => b.name), []);
});

test('the examples are listed: the gallery demos, the blog and this site', () => {
  assert.match(llms, /## Examples/);
  assert.match(llms, /\(https:\/\/gallery\.webjs\.dev\/features\/routing\)/);
  assert.match(llms, /github\.com\/webjsdev\/webjs\/tree\/main\/gallery\/app\/features\/routing/);
  assert.match(llms, /github\.com\/webjsdev\/webjs\/tree\/main\/examples\/blog/);
  assert.match(llms, /github\.com\/webjsdev\/webjs\/tree\/main\/website\/app\/ui/);
});

test('every same-site link in /llms.txt and /ui/llms.txt answers 200, the text forms as text', async () => {
  const site = new Set(['localhost', 'webjs.dev', new URL(process.env.SITE_URL || 'https://webjs.dev').hostname]);
  const paths = new Set<string>();
  for (const u of [...links(llms), ...links(uiLlms)]) {
    const url = new URL(u, 'http://localhost');
    if (site.has(url.hostname)) paths.add(url.pathname);
  }
  assert.ok(paths.size > 150, `expected many same-site links, found ${paths.size}`);
  const failed: string[] = [];
  for (const path of paths) {
    const res = await handle(path);
    const type = res.headers.get('content-type') ?? '';
    await res.arrayBuffer();
    const textual = path.startsWith('/ui/llm') || path.endsWith('.txt');
    if (res.status !== 200) failed.push(`${path} (${res.status})`);
    else if (textual && !/^text\/(markdown|plain)/.test(type)) failed.push(`${path} (${type})`);
  }
  assert.deepEqual(failed, []);
});

test('a link to a page that does not exist is caught (counterfactual)', async () => {
  const res = await handle(uiMarkdownHref('/ui/docs/components/not-a-component')!);
  assert.equal(res.status, 404);
});

test('a component page\'s markdown carries its demos\' source, the install command and the API reference', async () => {
  const res = await handle('/ui/llm/docs/components/switch');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^text\/markdown/);
  const md = await res.text();
  const docs = await readFile(resolve(WEBSITE_ROOT, 'modules/ui/docs/components/switch.ts'), 'utf8');
  const demos = ['switch-demo', ...[...docs.matchAll(/componentPreview\('([^']+)'/g)].map((m) => m[1])];
  assert.ok(demos.length > 4);
  for (const demo of demos) {
    const src = await readFile(resolve(WEBSITE_ROOT, `modules/ui/examples/${demo}.ts`), 'utf8');
    const fn = src.match(/export default (?:async )?function \w+/)?.[0];
    assert.ok(fn && md.includes(fn), `the ${demo} source is inlined`);
  }
  assert.match(md, /^# Switch$/m);
  assert.match(md, /```bash\nnpx @webjsdev\/ui add switch\n```/);
  assert.match(md, /^## API Reference$/m);
  assert.match(md, /^\| Attribute \| Type \| Default \|$/m);
  // The rendered demo is dropped and nothing from the chrome leaks in.
  assert.doesNotMatch(md, /On This Page|View Code|Copy Page/);
});

test('every component page with a lead demo inlines that demo\'s source', async () => {
  const failed: string[] = [];
  for (const [slug, load] of Object.entries(COMPONENT_DOCS)) {
    const mod = await load().catch(() => null);
    if (!mod?.demo) continue;
    const src = await readFile(resolve(WEBSITE_ROOT, `modules/ui/examples/${mod.demo}.ts`), 'utf8').catch(() => '');
    const fn = src.match(/export default (?:async )?function \w+/)?.[0];
    if (!fn) continue;
    const md = await (await handle(`/ui/llm/docs/components/${slug}`)).text();
    if (!md.includes(fn)) failed.push(slug);
  }
  assert.deepEqual(failed, []);
});

test('a /ui page names its markdown in the head, and keeps its canonical', async () => {
  for (const path of ['/ui/docs/components/button', '/ui/docs/installation', '/ui/blocks']) {
    const html = await (await handle(path)).text();
    assert.ok(html.includes(`<link rel="alternate" type="text/markdown" href="http://localhost${uiMarkdownHref(path)}">`), `${path} links its markdown`);
    assert.ok(html.includes(`<link rel="canonical" href="http://localhost${path}">`), `${path} keeps its canonical`);
  }
  const doc = await (await handle('/ui/docs/components/button')).text();
  assert.match(doc, /<docs-copy-page href="\/ui\/llm\/docs\/components\/button"/, 'the Copy Page button');
});

test('a block page\'s markdown carries each block\'s add command and files', async () => {
  const md = await (await handle('/ui/llm/blocks/login')).text();
  assert.match(md, /npx @webjsdev\/ui add login-01/);
  assert.match(md, /```ts title="app\/login\/page\.ts"/);
});

test('the sitemap lists every /ui page and none of the iframe targets', async () => {
  const xml = await Sitemap();
  const locs = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname));
  const pages = await listUiPages('http://localhost');
  const expected = [
    ...pages.map((p) => p.path),
    ...COMPONENTS.map((c) => `/ui/docs/components/${c.slug}`),
    ...(await loadableDocPages()).map((key) => `/ui/docs/${key}`),
  ];
  assert.deepEqual(missingFrom(locs, expected), []);
  assert.deepEqual([...locs].filter((p) => /^\/ui\/(view|preview|llm)(\/|$)/.test(p)), []);
  // The counterfactual: a page the sitemap does not have is reported.
  assert.deepEqual(missingFrom(locs, ['/ui/docs/components/not-a-component']), ['/ui/docs/components/not-a-component']);
});

test('the full corpus carries every /ui page', async () => {
  // The list is read first, so a page that appears while the corpus renders
  // is in the corpus rather than missing from it.
  const pages = await listUiPages('http://localhost');
  const res = await handle('/ui/llms-full.txt');
  assert.equal(res.status, 200);
  const body = await res.text();
  const missing = pages.filter((p) => !body.includes(`Source: http://localhost${p.path}\n`));
  // A redirecting section page is listed under where it lands, so every
  // listed path is a Source line.
  assert.deepEqual(missing.map((p) => p.path), []);
  assert.doesNotMatch(body, /could not be rendered as markdown/);
  const site = await (await handle('/llms-full.txt')).text();
  assert.ok(site.includes('Source: http://localhost/ui/docs/components/switch'), '/llms-full.txt carries the /ui corpus');
});

test('html to markdown: tables, code figures, link lists, and the preview dropped', () => {
  const html = `<div>
    <h2 id="x"><a href="#x">Usage</a></h2>
    <p>Use <code>buttonClass()</code> on a <a href="/ui/docs/components/button">button</a>.</p>
    <div data-slot="component-preview"><div data-slot="preview"><button>Live demo</button></div>
      <div data-slot="code"><figure data-rehype-pretty-code-figure><pre data-language="ts"><code><span data-line>const a = 1 &lt; 2;</span>
<span data-line>  return a;</span>
</code></pre></figure></div></div>
    <table><thead><tr><th>Prop</th><th>Type</th></tr></thead><tbody><tr><td><code>size</code></td><td><code>"sm" | "lg"</code></td></tr></tbody></table>
    <div><a href="/a">A</a><a href="/b">B</a></div>
    <span class="sr-only">hidden text</span>
  </div>`;
  const md = toMarkdown(parseHtml(html), { origin: 'https://webjs.dev' });
  assert.equal(md, [
    '## Usage',
    'Use `buttonClass()` on a [button](https://webjs.dev/ui/docs/components/button).',
    '```ts\nconst a = 1 < 2;\n  return a;\n```',
    '| Prop | Type |\n| --- | --- |\n| `size` | `"sm" \\| "lg"` |',
    '- [A](https://webjs.dev/a)\n- [B](https://webjs.dev/b)',
  ].join('\n\n'));
});
