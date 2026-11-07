/**
 * The /ui blocks pages (#1666, D18): /ui/blocks (the featured blocks),
 * /ui/blocks/<category>, and /ui/view/<name>, the bare frame each block
 * viewer shows. The block list comes from the real registry, so a block added
 * there is covered here with no edit.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { BLOCK_CATEGORIES, FEATURED_BLOCKS } from '#lib/ui/blocks-shell.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REGISTRY = resolve(WEBSITE_ROOT, '..', 'packages', 'ui', 'packages', 'registry');
let handle: (path: string) => Promise<Response>;

interface ManifestItem { name: string; type: string; categories?: string[]; files?: { path: string }[] }
const manifest = JSON.parse(readFileSync(join(REGISTRY, 'registry.json'), 'utf8')) as { items: ManifestItem[] };
const blocks = manifest.items.filter((i) => i.type === 'registry:block' && !(i.categories || []).some((c) => c === 'chart' || c === 'preview'));
const previews = manifest.items.filter((i) => i.type === 'registry:block' && (i.categories || []).includes('preview'));

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
});

async function page(path: string) {
  const res = await handle(path);
  assert.equal(res.status, 200, `${path} renders`);
  return res.text();
}

/** The names of the block viewers on a page, in order. */
const viewers = (html: string) => [...html.matchAll(/<block-viewer[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);

test('the registry has blocks to show, including the sixteen sidebars', () => {
  assert.ok(blocks.length >= 26, `expected at least 26 blocks, found ${blocks.length}`);
  for (let n = 1; n <= 16; n++) {
    const name = `sidebar-${String(n).padStart(2, '0')}`;
    assert.ok(blocks.some((b) => b.name === name && b.categories?.includes('sidebar')), `${name} is a sidebar block`);
  }
});

test('/ui/blocks shows the featured blocks that exist, then the link to the rest', async () => {
  const html = await page('/ui/blocks');
  const names = new Set(blocks.map((b) => b.name));
  assert.deepEqual(viewers(html), FEATURED_BLOCKS.filter((n) => names.has(n)));
  assert.match(html, /Building Blocks for the Web/);
  assert.match(html, /<a href="\/ui\/blocks\/sidebar"[^>]*>Browse more blocks<\/a>/);
  assert.match(html, /<a href="\/ui\/blocks"[^>]*data-active="true"[^>]*>Featured<\/a>/, 'Featured is the current category');
});

test('every block is listed on the page of each category it belongs to, and only there', async () => {
  for (const category of BLOCK_CATEGORIES) {
    const expected = blocks.filter((b) => b.categories?.includes(category.slug)).map((b) => b.name).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const res = await handle(`/ui/blocks/${category.slug}`);
    if (!expected.length) {
      assert.equal(res.status, 404, `/ui/blocks/${category.slug} has no blocks, so it is a 404`);
      continue;
    }
    assert.equal(res.status, 200, `/ui/blocks/${category.slug} renders`);
    assert.deepEqual(viewers(await res.text()), expected, `/ui/blocks/${category.slug} lists exactly its blocks`);
  }
  // Every block is reachable from some category page.
  for (const b of blocks) assert.ok(b.categories?.some((c) => BLOCK_CATEGORIES.some((k) => k.slug === c)), `${b.name} has a listed category`);
});

test('the categories nav lists only the visible categories that have blocks', async () => {
  const html = await page('/ui/blocks/login');
  const nav = html.match(/<nav aria-label="Block categories"[\s\S]*?<\/nav>/)?.[0] ?? '';
  assert.match(nav, />Featured</);
  assert.match(nav, /href="\/ui\/blocks\/sidebar"/);
  assert.match(nav, /href="\/ui\/blocks\/login"[^>]*data-active="true"/);
  assert.match(nav, /href="\/ui\/blocks\/signup"/);
  assert.doesNotMatch(nav, /\/ui\/blocks\/authentication|\/ui\/blocks\/dashboard/, 'hidden categories have no nav link');
  assert.equal((await handle('/ui/blocks/nope')).status, 404);
});

test('a block viewer carries the toolbar, the frame, the install command and every file', async () => {
  const html = await page('/ui/blocks/login');
  const one = html.match(/<block-viewer[^>]*id="login-01"[\s\S]*?<\/block-viewer>/)?.[0] ?? '';
  assert.match(one, /data-block-view="preview" checked/);
  assert.match(one, /data-block-view="code"/);
  for (const size of ['desktop', 'tablet', 'mobile']) assert.match(one, new RegExp(`data-block-viewport="${size}"`));
  assert.match(one, /<iframe src="\/ui\/view\/login-01"/);
  assert.match(one, /<a href="\/ui\/view\/login-01" target="_blank"/, 'open in a new tab');
  assert.match(one, /data-block-copy="npx @webjsdev\/ui add login-01"/);
  // Both files, at their install targets, with their source in the HTML (readable with JS off).
  assert.match(one, /value="app\/login\/page\.ts"/);
  assert.match(one, /value="components\/login-form\.ts"/);
  assert.match(one, /loginForm/);
  // The code shows imports as `add` writes them, not the registry's own layout.
  assert.doesNotMatch(one, /\.\.\/\.\.\/\.\.\/components\//);
  assert.match(one, /\.\/ui\/card\.ts/);
});

test('a blocks page ships the viewer element and nothing else of its own', async () => {
  // The element is the island; the page and the viewer's markup fragment are
  // server-only, so a module-scope call creeping into either would pin them.
  for (const path of ['/ui/blocks', '/ui/blocks/login']) {
    const html = await page(path);
    assert.match(html, /\/components\/block-viewer\.ts/, `${path} loads the <block-viewer> element`);
    assert.doesNotMatch(html, /\/lib\/ui\/block-viewer\.ts|\/lib\/ui\/blocks-shell\.ts|\/app\/ui\/\(chrome\)\/blocks\//, `${path} ships neither the page nor its fragments`);
  }
});

test('the header links Blocks after Components', async () => {
  const html = await page('/ui/blocks');
  const nav = html.match(/<nav class="hidden items-center gap-0 lg:flex" aria-label="Main">[\s\S]*?<\/nav>/)?.[0] ?? '';
  assert.match(nav, /href="\/ui\/docs\/components"[^>]*>Components<\/a>\s*<a[^>]*href="\/ui\/blocks"[^>]*>Blocks<\/a>/);
});

test('/ui/view/<name> renders every block bare, with no chrome, in new-york', async () => {
  for (const b of blocks) {
    const html = await page(`/ui/view/${b.name}`);
    assert.match(html, new RegExp(`data-slot="block-view" data-block="${b.name}" class="style-new-york`), `${b.name} renders in new-york`);
    assert.doesNotMatch(html, /aria-label="WebJs UI home"/, `${b.name} has no /ui header`);
    assert.match(html, /addEventListener\('submit'/, `${b.name}: a submit inside the frame is cancelled`);
  }
  assert.equal((await handle('/ui/view/not-a-block')).status, 404);
  assert.equal((await handle('/ui/view/..%2Fregistry')).status, 404);
});

test('the preview blocks and dashboard-01 render in the frame, and their elements load there', async () => {
  assert.deepEqual(previews.map((b) => b.name).sort(), ['preview', 'preview-02', 'preview-03'], 'the three preview boards');
  for (const b of [...previews, { name: 'dashboard-01' }]) {
    const html = await page(`/ui/view/${b.name}`);
    assert.match(html, new RegExp(`data-block="${b.name}"`), `${b.name} renders`);
    // Dozens of cards share one page, so an id must not repeat.
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], `${b.name} repeats no id`);
  }
  const dash = await page('/ui/view/dashboard-01');
  assert.match(dash, /<dashboard-01-data-table[\s>]/, 'the data table element');
  assert.match(dash, /<ui-sidebar-provider[\s>]/, 'in the kit sidebar shell');
  // The frame loads the generated barrel of block elements, so a block's own
  // element upgrades even though the block itself renders as a string.
  assert.match(dash, /modules\/ui\/blocks\/elements\.ts|dashboard-01\/components\/data-table\.ts/, 'the block elements reach the browser');
  // A preview board is not a blocks-page block.
  for (const b of previews) assert.doesNotMatch(await page('/ui/blocks/sidebar'), new RegExp(`id="${b.name}"`));
});

test('/ui/blocks features dashboard-01 first, and /ui/blocks/dashboard lists it', async () => {
  assert.equal(viewers(await page('/ui/blocks'))[0], 'dashboard-01');
  assert.deepEqual(viewers(await page('/ui/blocks/dashboard')), ['dashboard-01']);
});

test('the sample avatar is the WebJs one, hotlinked by an install and site-relative in the frame', async () => {
  // The registry source carries the absolute URL an installed block hotlinks.
  const source = readFileSync(join(REGISTRY, 'blocks', 'sidebar-07', 'components', 'app-sidebar.ts'), 'utf8');
  assert.match(source, /https:\/\/webjs\.dev\/public\/avatars\/vivek\.jpg/);
  assert.doesNotMatch(source, /github\.com\/shadcn\.png/);
  // The site's mirror rewrites it (scripts/copy-registry.mjs), so the local
  // frame serves the photo from public/ before it is deployed.
  const mirror = readFileSync(join(WEBSITE_ROOT, 'modules', 'ui', 'blocks', 'sidebar-07', 'components', 'app-sidebar.ts'), 'utf8');
  assert.match(mirror, /'\/public\/avatars\/vivek\.jpg'/);
  assert.doesNotMatch(mirror, /https:\/\/webjs\.dev\/public\//);
  const html = await page('/ui/view/sidebar-07');
  assert.match(html, /<img data-slot="avatar-image" src="\/public\/avatars\/vivek\.jpg" alt="@vivek"/);
  assert.match(html, />VK<\/span>/, 'the initials fallback');
  assert.equal((await handle('/public/avatars/vivek.jpg')).status, 200, 'the photo is served');
  // No block anywhere still points at shadcn's avatar.
  for (const b of manifest.items.filter((i) => i.type === 'registry:block')) {
    for (const f of b.files || []) {
      if (f.path.endsWith('.ts')) assert.doesNotMatch(readFileSync(join(REGISTRY, f.path), 'utf8'), /github\.com\/shadcn\.png/, f.path);
    }
  }
});

/** Every .ts file under a block's directory. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

test('no block writes a cn-* name in its own markup', () => {
  // The kit helpers a block composes carry the cn-* names, which the bake
  // turns into plain Tailwind on install. A name written in the block itself
  // would reach an installed app unbaked.
  for (const b of blocks) {
    for (const f of files(join(REGISTRY, 'blocks', b.name))) {
      assert.doesNotMatch(readFileSync(f, 'utf8'), /["'\s]cn-[a-z]/, `${f} writes no cn-* class`);
    }
  }
});

test('the Sidebar docs page leads with the sidebar-07 block', async () => {
  const html = await page('/ui/docs/components/sidebar');
  assert.match(html, /data-slot="block-preview"[\s\S]*?<iframe src="\/ui\/view\/sidebar-07"/);
  assert.match(html, /A sidebar that collapses to icons\./);
  assert.match(html, /<a href="\/ui\/blocks">Browse the Blocks Library<\/a>/);
});
