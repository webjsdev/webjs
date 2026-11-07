/**
 * The /ui docs (#1666): the shadcn-shaped docs layout, the component pages,
 * and the two 'use server' queries behind them.
 *
 * renderDemo and componentSource are callable over RPC by anyone, so the
 * name each one takes is a public input. Both must refuse a path and an
 * unknown name before touching the filesystem (D14).
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { renderDemo } from '#modules/ui/queries/render-demo.server.ts';
import { componentSource } from '#modules/ui/queries/component-source.server.ts';
import { COMPONENTS, HEADER_NAV, NAV, neighbours } from '#modules/ui/docs/nav.ts';
import { REGISTRIES } from '#modules/ui/directory/registries.ts';
import { DOC_PAGES } from '#modules/ui/docs/pages/index.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let handle: (path: string) => Promise<Response>;

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
});

test('renderDemo refuses a path or an unknown name, and renders a known demo', async () => {
  for (const bad of ['../queries/registry.server', '../../app/layout', 'button-demo/../x', 'BUTTON-DEMO', 'nope-not-a-demo', '']) {
    assert.equal(await renderDemo(bad), null, `${JSON.stringify(bad)} is refused`);
  }
  const demo = await renderDemo('button-demo');
  assert.ok(demo, 'a known demo renders');
  assert.match(demo!.html, /data-slot="button"/, 'the preview is the rendered demo');
  assert.match(demo!.source, /from '#components\/ui\/button\.ts'/, 'the source shows the app path, not the site mirror');
  assert.doesNotMatch(demo!.source, /#modules\/ui\/components\//);
});

test('componentSource refuses a path, and serves a component baked for an app', async () => {
  for (const bad of ['../registry', 'button/../../x', 'Button', '']) {
    assert.equal(await componentSource(bad), null, `${JSON.stringify(bad)} is refused`);
  }
  const files = await componentSource('button');
  assert.ok(files?.length, 'button has a source file');
  // A comment may still name the base form; no CLASS STRING may.
  assert.doesNotMatch(files![0].content, /'[^'\n]*\bcn-button[\w-]*[^'\n]*'/, 'baked: no base-form cn-* name survives in a class string');
  // Either quote: the bake moves a class string carrying a single quote
  // (`[class*='size-']`) into double quotes rather than escaping it.
  assert.match(files![0].content, /"[^"\n]*\binline-flex\b[^"\n]*"|'[^'\n]*\binline-flex\b[^'\n]*'/, 'and the style\'s classes are inlined');
  assert.doesNotMatch(files![0].content, /\\'|\\"/, 'with no escaped quote, which Tailwind would read literally');
});

test('the Manual tab shows every file of a component, each under the path add writes it to', async () => {
  const manualTitles = async (slug: string) => {
    const page = await (await handle(`/ui/docs/components/${slug}`)).text();
    const tab = page.slice(page.indexOf('<ui-tabs-content value="manual"'));
    return [...tab.slice(0, tab.indexOf('</ui-tabs-content>')).matchAll(/<figcaption[^>]*>([^<]+)<\/figcaption>/g)].map((m) => m[1]);
  };
  assert.deepEqual(await manualTitles('button'), ['components/ui/button.ts']);
  // chart is three registry files, and add installs all three.
  assert.deepEqual(await manualTitles('chart'), ['components/ui/chart.ts', 'components/ui/chart-element.ts', 'components/ui/chart-geometry.ts']);
});

test('the Sidebar page\'s View RTL Sidebar opens the right-to-left sidebar full screen', async () => {
  const page = await (await handle('/ui/docs/components/sidebar')).text();
  assert.match(page, /<a href="\/ui\/view\/sidebar-rtl"[^>]*>View RTL Sidebar/);
  const res = await handle('/ui/view/sidebar-rtl');
  assert.equal(res.status, 200);
  const view = await res.text();
  assert.match(view, /<example-bind class="relative block" dir="rtl" lang="ar"/, 'it reads right to left, in Arabic by default');
  assert.match(view, /<ui-sidebar collapsible="icon" side="right"/, 'with the sidebar on the right');
  assert.match(view, /<link rel="stylesheet" href="\/public\/rtl-fonts\.css[^"]*"/, 'and the Arabic and Hebrew faces');
  // The language selector is a GET form the frame lets through, so it works with JS off.
  assert.match(view, /<form method="get" data-view-submit[^>]*>/);
  assert.match(view, /<select id="sidebar-rtl-language" name="lang" data-autosubmit/);
  assert.match(view, /<option value="ar" selected="">Arabic/);
  const he = await (await handle('/ui/view/sidebar-rtl?lang=he')).text();
  assert.match(he, /dir="rtl" lang="he"/);
  assert.match(he, /<option value="he" selected="">Hebrew/);
  assert.ok(he.includes('פלטפורמה'), 'the strings follow the language');
  const en = await (await handle('/ui/view/sidebar-rtl?lang=en')).text();
  assert.match(en, /dir="ltr" lang="en"/);
  assert.match(en, /<ui-sidebar collapsible="icon" side="left"/, 'left to right puts the sidebar on the left');
  assert.ok(en.includes('Platform'));
  assert.match(await (await handle('/ui/view/sidebar-rtl?lang=xx')).text(), /dir="rtl" lang="ar"/, 'an unknown language falls back to Arabic');
  // Only the whole-page demos open there; any other demo stays a 404.
  assert.equal((await handle('/ui/view/button-demo')).status, 404);
});

test('every component in the nav has a page, and an unknown one is a 404', async () => {
  const failed: string[] = [];
  for (const c of COMPONENTS) {
    const res = await handle(`/ui/docs/components/${c.slug}`);
    if (res.status !== 200) failed.push(`${c.slug} (${res.status})`);
  }
  assert.deepEqual(failed, []);
  assert.equal((await handle('/ui/docs/components/not-a-component')).status, 404);
});

test('the sidebar\'s Typography link redirects to the Typeset docs, as shadcn\'s does', async () => {
  assert.ok(NAV.some((g) => g.items.some((i) => i.href === '/ui/docs/components/typography')), 'the sidebar still lists it');
  const res = await handle('/ui/docs/components/typography');
  assert.equal(res.status, 308);
  assert.equal(res.headers.get('location'), '/ui/docs/typeset');
});

test('a component page has the shadcn shape: title, preview, installation, table of contents', async () => {
  const res = await handle('/ui/docs/components/button');
  const page = await res.text();
  assert.match(page, /<h1[^>]*>Button<\/h1>/);
  assert.match(page, /data-slot="component-preview"/, 'the lead demo');
  assert.match(page, /<h2 id="installation">/, 'the Installation section');
  assert.match(page, /pnpm dlx @webjsdev\/ui add button/, 'the add command');
  assert.match(page, /aria-label="On this page"[\s\S]*href="#usage"/, 'the table of contents lists the sections');
  assert.match(page, /<a href="\/ui\/docs\/components\/button"[^>]*data-active="true"[^>]*aria-current="page"/, 'the sidebar marks the page');
  const { previous, next } = neighbours('/ui/docs/components/button');
  assert.ok(previous && next);
  assert.ok(page.includes(`href="${previous!.href}"`) && page.includes(`href="${next!.href}"`), 'previous and next link the neighbours');
});

test('the nav keeps shadcn\'s section order and leaves out what cannot exist', () => {
  assert.deepEqual(NAV.map((g) => g.title).slice(0, 3), ['Components', 'AI Elements', 'Get Started']);
  const hrefs = NAV.flatMap((g) => g.items.map((i) => i.href));
  for (const gone of ['/ui/docs/legacy', '/ui/docs/registry/open-in-v0', '/ui/docs/react-19']) {
    assert.ok(!hrefs.includes(gone), `${gone} is in the "Cannot exist" table`);
  }
  // shadcn's 67 less Typography, whose link redirects to the Typeset docs.
  assert.equal(COMPONENTS.length, 66, 'all of shadcn\'s component pages');
});

test('the components index lists every component page, in title order as shadcn\'s does', async () => {
  // shadcn's components folder takes fumadocs' default order, by title, so
  // Alert comes before Alert Dialog and Button before Button Group. The
  // sidebar and the index read the same list.
  const items = NAV.find((g) => g.title === 'Components')!.items;
  const titles = items.map((i) => i.title);
  assert.deepEqual(titles, [...titles].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  assert.ok(titles.indexOf('Alert') < titles.indexOf('Alert Dialog'));
  const res = await handle('/ui/docs/components');
  assert.equal(res.status, 200, 'the page the sidebar\'s Components link opens');
  const page = await res.text();
  assert.match(page, /<h1[^>]*>Components<\/h1>/);
  for (const i of items) assert.ok(page.includes(`href="${i.href}"`), `links ${i.title}`);
});

test('the header search offers only pages that exist, starting with the header nav', async () => {
  // shadcn's CommandMenu: a Pages group (the header nav), then the docs tree's
  // folders. Every link it offers must open a page, so each href is fetched.
  const page = await (await handle('/ui/docs/components')).text();
  const at = page.indexOf('<docs-command-menu');
  assert.ok(at > 0, 'the header carries the search');
  const menu = page.slice(at, page.indexOf('</docs-command-menu>', at));
  assert.match(menu, /Search documentation\.\.\./);
  assert.match(menu, /<ui-command-group heading="Pages"/);
  const groups = [...menu.matchAll(/<ui-command-group heading="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(groups[0], 'Pages', 'the header nav comes first');
  assert.ok(groups.includes('Components'));
  const hrefs = [...new Set([...menu.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]))];
  assert.ok(hrefs.length >= HEADER_NAV.length + COMPONENTS.length, `offers the nav and every component (${hrefs.length})`);
  const broken: string[] = [];
  for (const href of hrefs) {
    if ((await handle(href)).status !== 200) broken.push(href);
  }
  assert.deepEqual(broken, [], 'no item opens a missing page');
});

test('the registry directory lists the registries, searches them, and serves them as JSON', async () => {
  const page = await (await handle('/ui/docs/directory')).text();
  assert.match(page, /<h1[^>]*>Registry Directory<\/h1>/);
  for (const r of REGISTRIES) assert.ok(page.includes(r.name), `lists ${r.name}`);
  assert.match(page, /<form method="get" action="\/ui\/docs\/directory" role="search"/, 'the search is a plain GET form, so it works with JavaScript off');
  assert.match(page, /pnpm dlx @webjsdev\/ui add &lt;component&gt;|pnpm dlx @webjsdev\/ui add <component>/, 'Add shows a command this CLI runs');
  const none = await (await handle('/ui/docs/directory?q=zzzz-no-such-registry')).text();
  assert.match(none, /No registries match/);
  assert.match(none, /0 registries/);
  const res = await handle('/ui/r/registries.json');
  assert.equal(res.status, 200);
  const json = await res.json() as Array<Record<string, unknown>>;
  assert.deepEqual(json.map((r) => r.name), REGISTRIES.map((r) => r.name));
  assert.ok(json.every((r) => typeof r.url === 'string' && !('default' in r)), 'each entry carries its base url, and nothing internal');
  const header = await (await handle('/ui')).text();
  assert.match(header, /href="\/ui\/docs\/directory"[^>]*>Directory</, 'the header links it, now that it exists');
});

test('the docs catch-all serves the DOC_PAGES modules and nothing else', async () => {
  // A non-component docs page is one module under modules/ui/docs/pages/,
  // keyed by its path. An unknown path is a 404, and the specific docs
  // routes still answer for their own paths.
  assert.equal((await handle('/ui/docs/no-such-page')).status, 404);
  assert.equal((await handle('/ui/docs/registry/no-such-page')).status, 404);
  assert.equal((await handle('/ui/docs/components/button')).status, 200, 'a component page is not shadowed');
  assert.equal((await handle('/ui/docs/directory')).status, 200);
  for (const path of Object.keys(DOC_PAGES)) {
    const res = await handle(`/ui/docs/${path}`);
    assert.equal(res.status, 200, `/ui/docs/${path}`);
    const mod = await DOC_PAGES[path]();
    assert.match(await res.text(), new RegExp(`<h1[^>]*>${mod.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h1>`));
  }
});
