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

test('below lg a block viewer shows the block\'s screenshot, not a second frame', async () => {
  // shadcn's BlockViewerMobile: a picture in each theme. A frame there would
  // render the block's own phone layout, not the page a reader is choosing.
  const html = await page('/ui/blocks/login');
  const one = html.match(/<block-viewer[^>]*id="login-01"[\s\S]*?<\/block-viewer>/)?.[0] ?? '';
  const mobile = one.slice(one.indexOf('data-slot="block-viewer-mobile"'));
  assert.match(mobile, /class="flex flex-col gap-2 lg:hidden"/);
  assert.match(mobile, /<img src="\/public\/images\/blocks\/login-01-light\.png[^"]*" alt="login-01" data-block="login-01" width="1440" height="900" loading="lazy"[^>]*class="object-cover dark:hidden"/);
  assert.match(mobile, /<img src="\/public\/images\/blocks\/login-01-dark\.png[^"]*"[^>]*class="object-cover hidden dark:block"/);
  assert.doesNotMatch(mobile, /<iframe/);
  assert.equal(one.match(/<iframe/g)?.length, 1, 'one frame per viewer, the desktop one');
});

test('every block the pages list has its screenshot in both themes', () => {
  // scripts/shoot-block-images.mjs writes them; a new block needs a run.
  for (const b of blocks) {
    for (const theme of ['light', 'dark']) {
      const file = join(WEBSITE_ROOT, 'public', 'images', 'blocks', `${b.name}-${theme}.png`);
      const bytes = readFileSync(file);
      assert.equal(bytes.readUInt32BE(16), 1440, `${b.name}-${theme}.png is 1440 wide`);
      assert.equal(bytes.readUInt32BE(20), 900, `${b.name}-${theme}.png is 900 high`);
    }
  }
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

test('the preview cards follow a live design-system wrapper with no re-render', async () => {
  // /ui/create repaints its wrapper in place on every pick, so the cards key
  // on it: the names sit in spans the configurator rewrites, and the bar
  // charts are drawn rounded and square with the style variants choosing.
  const preview = await page('/ui/view/preview');
  for (const key of ['style', 'font-heading', 'font-heading-label', 'font']) {
    assert.match(preview, new RegExp(`<span data-design-system-text="${key}">`), `a ${key} name span`);
  }
  // Every key is one the configurator writes (syncDesignSystemText), or the
  // span would keep its first value through every pick.
  const { syncDesignSystemText } = await import('#modules/ui/create/design-system.ts');
  const synced = new Set<string>();
  const el = (key: string) => ({ dataset: { designSystemText: key }, set textContent(_v: string) { synced.add(key); }, get textContent() { return ''; } });
  const keys = [...new Set([...preview.matchAll(/data-design-system-text="([^"]+)"/g)].map((m) => m[1]))];
  const { parseCreateParams } = await import('#modules/ui/create/params.ts');
  syncDesignSystemText({ querySelectorAll: () => keys.map(el) } as never, parseCreateParams(new URLSearchParams()).config);
  assert.deepEqual([...synced].sort(), [...keys].sort(), 'the configurator writes every key the cards use');
  const p02 = await page('/ui/view/preview-02');
  for (const html of [preview, p02]) {
    assert.match(html, /class="contents style-lyra:hidden style-sera:hidden"><ui-chart/, 'the rounded chart, hidden under lyra and sera');
    assert.match(html, /class="hidden style-lyra:contents style-sera:contents"><ui-chart/, 'the square chart, shown under them');
  }
});

test('the dashboard-01 chart takes its first range and a default tooltip point', async () => {
  const { renderToString } = await import('@webjsdev/core/server');
  const { chartAreaInteractive } = await import('#modules/ui/blocks/dashboard-01/components/chart-area-interactive.ts');
  const shown = (html: string) => [...html.matchAll(/<div data-range="(\w+)"(\s+hidden)?/g)].filter((m) => !m[2]).map((m) => m[1]);
  const plain = await renderToString(chartAreaInteractive(), { ssr: false });
  assert.deepEqual(shown(plain), ['90d'], 'three months by default');
  assert.doesNotMatch(plain, /data-default-index=/, 'no tooltip point by default');
  const week = await renderToString(chartAreaInteractive({ range: '7d', tooltipIndex: 3 }), { ssr: false });
  assert.deepEqual(shown(week), ['7d'], 'the requested range shows first');
  assert.match(week, /<ui-toggle-group type="single" value="7d"/, 'the toggle starts on it');
  assert.match(week, /<option value="7d" selected/, 'and so does the select');
  assert.match(week, /data-default-index="3"/, 'the tooltip point is drawn from the first paint');
});

test('the dashboard-01 sidebar and header take the example dashboard\'s shape', async () => {
  const { renderToString } = await import('@webjsdev/core/server');
  const { html } = await import('@webjsdev/core');
  const { appSidebar } = await import('#modules/ui/blocks/dashboard-01/components/app-sidebar.ts');
  const { siteHeader } = await import('#modules/ui/blocks/dashboard-01/components/site-header.ts');
  const render = (t: unknown) => renderToString(t as never, { ssr: false });

  // The block's own shape is the default.
  const block = await render(appSidebar());
  assert.match(block, /<ui-sidebar collapsible="offcanvas"/);
  assert.match(block, />Quick Create</);
  assert.doesNotMatch(block, /data-sidebar="group-label"[^\n]*?">Home<\/div>/);
  const header = await render(siteHeader());
  assert.match(header, /<ui-sidebar-trigger/);
  assert.doesNotMatch(header, />Quick Create</);
  assert.doesNotMatch(header, /sticky/);

  // shadcn's examples/dashboard: a fixed column with a Home group and no
  // Quick Create row, a sticky header with the button and no trigger.
  const example = await render(appSidebar({
    collapsible: 'none',
    class: 'h-auto border-r [--sidebar-width:calc(var(--spacing)*64)]',
    headerClass: 'border-b',
    logo: html`<svg data-test-logo></svg>`,
    mainLabel: 'Home',
    quickCreate: false,
    data: { navMain: [{ title: 'Overview', url: '/x' }] },
  }));
  assert.match(example, /<ui-sidebar collapsible="none"[^>]*class="[^"]*h-auto border-r/);
  assert.doesNotMatch(example, /spacing\)\*72/, 'a caller width replaces the block default');
  assert.match(block, /<ui-sidebar [^>]*\[--sidebar-width:calc\(var\(--spacing\)\*72\)\]/);
  assert.match(example, /data-sidebar="header" class="[^"]*border-b/);
  assert.match(example, /data-test-logo/);
  assert.match(example, /data-sidebar="group-label"[^\n]*?">Home<\/div>/);
  assert.doesNotMatch(example, />Quick Create</);
  assert.match(example, /href="\/x"[\s\S]*?>Overview</, 'the replaced main nav');
  assert.match(example, />Data Library</, 'the lists not replaced keep the sample data');
  const exHeader = await render(siteHeader({ trigger: false, quickCreate: true, sticky: true, title: 'Documents' }));
  assert.doesNotMatch(exHeader, /<ui-sidebar-trigger/);
  assert.match(exHeader, /<header class="[^"]*sticky top-0 z-10 bg-background\/90/);
  assert.match(exHeader, />Quick Create</);
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
  // Below md the frame gives way to the block's screenshot, as shadcn's does.
  const preview = html.match(/data-slot="block-preview"[\s\S]*?<\/iframe>/)?.[0] ?? '';
  assert.match(preview, /<img src="\/public\/images\/blocks\/sidebar-07-light\.png[^"]*"[^>]*class="[^"]*md:hidden[^"]*dark:hidden"/);
  assert.match(preview, /<img src="\/public\/images\/blocks\/sidebar-07-dark\.png[^"]*"[^>]*class="[^"]*hidden dark:block"/);
  assert.match(preview, /<div class="absolute inset-0 hidden w-\[1600px\] bg-background md:block">\s*<iframe/);
  assert.match(html, /A sidebar that collapses to icons\./);
  assert.match(html, /<a href="\/ui\/blocks">Browse the Blocks Library<\/a>/);
});
