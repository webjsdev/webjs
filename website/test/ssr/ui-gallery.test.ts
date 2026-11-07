/**
 * The /ui section's contract with the rest of the site (#1099, #1666).
 *
 * The gallery moved from ui.webjs.dev into webjs.dev/ui in #1099 and shared
 * the marketing chrome. #1666 turns /ui into a replica of the shadcn/ui site,
 * so it now has its OWN header, footer, palette and type. What stays shared,
 * and is pinned here, is the mechanics: one root layout and one theme
 * signal, so a light or dark choice made in either section holds in the
 * other, and a navigation between them swaps the chrome without a full load.
 *
 * Nothing about the split is self-enforcing. A token block that slips onto
 * :root repaints the marketing site, a stylesheet link that falls out of the
 * head run flashes unstyled, and a second set of chrome renders fine while
 * looking wrong. So each of those is asserted here.
 *
 * Asserted against the REAL request pipeline rather than the layout functions
 * in isolation, because "which layouts wrap which page" is exactly the
 * property under test.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const UI_INDEX = '/ui';
const UI_COMPONENT = '/ui/docs/components/button';
const DOC_PATH = '/docs/routing';
const MARKETING_PATH = '/what-is-webjs';

let handle: (path: string) => Promise<Response>;

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
});

const bodyOf = async (path: string) => {
  const res = await handle(path);
  assert.equal(res.status, 200, `${path} should render`);
  return res.text();
};

function headerOf(html: string): string {
  const start = html.indexOf('<div class="site-top');
  assert.ok(start >= 0, 'the shared fixed header wrapper is present');
  const end = html.indexOf('</header>', start);
  assert.ok(end > start, 'the header closes');
  return html.slice(start, end);
}

function footerOf(html: string): string {
  const start = html.indexOf('<footer');
  assert.ok(start >= 0, 'a footer is present');
  return html.slice(start, html.indexOf('</footer>', start));
}

test('a /ui page renders the /ui chrome, not the marketing chrome', async () => {
  const [ui, marketing] = await Promise.all([bodyOf(UI_COMPONENT), bodyOf(MARKETING_PATH)]);
  const uiHeader = headerOf(ui);
  const marketingHeader = headerOf(marketing);
  assert.notEqual(uiHeader, marketingHeader, 'the two sections have different headers');
  assert.match(uiHeader, /WebJs UI/, 'the /ui header names the section');
  // By href, not label: the /ui menu has a Changelog of its own (the docs
  // Sections' /ui/docs/changelog), which is not the marketing one.
  for (const href of ['href="/blog"', 'href="/compare"', 'href="/changelog"']) {
    assert.ok(!uiHeader.includes(href), `the marketing nav item ${href} is not in the /ui header`);
    assert.ok(marketingHeader.includes(href), `and it IS in the marketing header`);
  }
  const uiFooter = footerOf(ui);
  assert.match(uiFooter, /ported from <a[^>]*>shadcn\/ui/, 'the /ui footer carries the one credit line');
  assert.ok(!footerOf(marketing).includes('shadcn'), 'and the marketing footer does not');
});

test('the links that cross between the sections take a full page load', async () => {
  // A soft navigation across sections is CORRECT (the route groups swap the
  // chrome), but the /ui stylesheet would then arrive after the swap, since
  // the router's head merge only adds. The common links take a full load.
  const [ui, marketing, docs] = await Promise.all([bodyOf(UI_COMPONENT), bodyOf(MARKETING_PATH), bodyOf(DOC_PATH)]);
  assert.match(headerOf(marketing), /href="\/ui"[^>]*data-no-router/, 'the marketing header links to /ui with a full load');
  assert.match(footerOf(marketing), /href="\/ui"[^>]*data-no-router/, 'and so does the marketing footer');
  assert.match(docs, /href="\/ui"[^>]*data-no-router/, 'and so does the docs sidebar');
  assert.match(headerOf(ui), /href="\/"[^>]*data-no-router/, 'the /ui header links back with a full load');
});

test('there is exactly one header, one footer, and one theme control', async () => {
  // The real regression to guard is a SECOND set of chrome, which comparing
  // the first match cannot see: the marketing chrome rendered around the /ui
  // chrome, say, because a page landed outside the route groups.
  // The /ui header carries shadcn's two-state <ui-mode-switcher>, the
  // marketing one the three-state <theme-toggle>, and neither carries both.
  for (const [path, control, other] of [[UI_COMPONENT, '<ui-mode-switcher', '<theme-toggle'], [MARKETING_PATH, '<theme-toggle', '<ui-mode-switcher']]) {
    const html = await bodyOf(path);
    assert.equal(html.split('<div class="site-top').length - 1, 1, `${path}: one header`);
    assert.equal(html.split('<footer').length - 1, 1, `${path}: one footer`);
    assert.equal(html.split(control).length - 1, 1, `${path}: one theme control`);
    assert.ok(!html.includes(other), `${path}: and not the other section's`);
  }
});

test('a /ui page loads only the /ui stylesheet, and a marketing page only its own', async () => {
  // Only the ROOT layout's leading link run is hoisted into <head>, and a
  // stylesheet left in <body> is not reliably render-blocking (#406), so the
  // root layout links each section's stylesheet itself, by path. The two are
  // exclusive: ui.css carries its own reset, and a /ui page that also loaded
  // tailwind.css matched every shared utility and :has() rule twice.
  const headOf = (html: string) => html.slice(0, html.indexOf('</head>'));
  const bodyPart = (html: string) => html.slice(html.indexOf('</head>'));
  for (const path of [UI_COMPONENT, UI_INDEX, '/ui/view/dashboard-01']) {
    const ui = await bodyOf(path);
    assert.match(headOf(ui), /<link rel="stylesheet" href="\/public\/ui\.css/, `${path} has ui.css in <head>`);
    assert.match(headOf(ui), /\/public\/fonts\/geist\.woff2/, 'and preloads Geist');
    assert.ok(!ui.includes('/public/tailwind.css'), `${path} does not load the marketing stylesheet`);
    assert.ok(!ui.includes('/public/fonts/inter.woff2'), `${path} does not preload the marketing fonts`);
  }
  for (const path of [MARKETING_PATH, DOC_PATH, '/']) {
    const html = await bodyOf(path);
    assert.ok(!html.includes('/public/ui.css'), `${path} does not load the /ui stylesheet`);
    assert.ok(!html.includes('geist.woff2'), `${path} does not preload the /ui font`);
    assert.match(headOf(html), /<link rel="stylesheet" href="\/public\/tailwind\.css/, `${path} has tailwind.css in <head>`);
    // The marketing chrome repeats it, for a soft navigation in from /ui,
    // where the root layout is not re-rendered.
    assert.match(bodyPart(html), /<link rel="stylesheet" href="\/public\/tailwind\.css/, `${path} links it again in its own markup`);
  }
});

test('neither chrome layout measures its header; the --header-h token sizes it', () => {
  // #1660: a measuring script read 0 from a header a full-body swap had
  // replaced, and the content slid under the bar. Both headers are sized BY
  // the token instead (the root layout's .site-top > header rule), so no
  // chrome layout may carry a script that writes it.
  for (const file of ['app/(site)/layout.ts', 'app/ui/(chrome)/layout.ts']) {
    const src = readFileSync(resolve(WEBSITE_ROOT, file), 'utf8');
    assert.ok(src.includes('class="site-top'), `${file} renders the fixed header`);
    assert.ok(!src.includes('ResizeObserver'), `${file} does not measure the header`);
    assert.ok(!/setProperty\('--header-h'/.test(src), `${file} does not write --header-h`);
  }
  // On /ui the token is the /ui header's own --header-height, written as
  // literals on :root (which cannot read a variable set on .ui-site). Hold
  // the two pairs equal so a resized header cannot leave a stale offset.
  const css = readFileSync(resolve(WEBSITE_ROOT, 'public/ui-input.css'), 'utf8');
  const heights = [...css.matchAll(/--header-height: calc\(var\(--spacing\) \* (\d+)\)/g)].map((m) => Number(m[1]) * 0.25 + 'rem');
  const tokens = [...css.matchAll(/:root:has\(\.ui-site \.site-top\) \{ --header-h: ([\d.]+rem); \}/g)].map((m) => m[1]);
  assert.deepEqual(heights, ['3.5rem', '4rem'], 'the /ui header is 3.5rem, then 4rem from 64rem');
  assert.deepEqual(tokens, heights, 'and --header-h follows it at both widths');
});

test('a thrown notFound() under /ui keeps the /ui chrome', async () => {
  const res = await handle('/ui/theme-zinc');
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(headerOf(html), /WebJs UI/, 'the /ui section boundary renders inside the /ui chrome');
});

test('/ui is the shadcn-shaped home page, and the introduction moved to /ui/docs', async () => {
  // #1666 replicates ui.shadcn.com, whose home is a hero over a grid of live
  // component cards with no sidebar. The introduction is a docs page.
  const home = await bodyOf(UI_INDEX);
  assert.match(home, /<h1[^>]*>The Foundation for your Design System<\/h1>/, 'the hero heading');
  assert.match(home, /data-slot="demo"/, 'the card grid');
  assert.match(home, /class="style-rhea[\s"]/, 'rendered in the rhea style, as shadcn renders it');
  assert.ok(!home.includes('id="docs-sidebar"'), 'with no docs sidebar');
  assert.equal(home.split('<main').length - 1, 1, 'and one main landmark');
  const docs = await bodyOf('/ui/docs');
  assert.match(docs, /<ui-docs-sidebar[\s>]/, '/ui/docs renders inside the docs layout');
  assert.match(docs, /<h1[^>]*>Introduction<\/h1>/, 'with the introduction as its page');
});

test('every component in the registry has a docs page, and its old gallery url redirects there', async () => {
  // The interim /ui/<name> gallery is retired (#1666): the component pages are
  // /ui/docs/components/<name>, and each old url is a permanent 308 there so
  // a link or a search result pointing at it keeps working.
  const { loadRegistryIndex } = await import('#modules/ui/queries/registry.server.ts');
  const components = (await loadRegistryIndex()).filter((i: any) => i.type === 'registry:ui');
  assert.ok(components.length > 20, `sanity: expected the full kit, got ${components.length}`);
  const broken: string[] = [];
  for (const c of components) {
    const old = await handle(`/ui/${c.name}`);
    const to = old.headers.get('location');
    if (old.status !== 308 || new URL(to ?? '', 'http://localhost').pathname !== `/ui/docs/components/${c.name}`) {
      broken.push(`/ui/${c.name} (${old.status} -> ${to})`);
      continue;
    }
    const page = await handle(`/ui/docs/components/${c.name}`);
    if (page.status !== 200) broken.push(`/ui/docs/components/${c.name} (${page.status})`);
  }
  assert.deepEqual(broken, [], `these components do not redirect to a rendering docs page:\n  ${broken.join('\n  ')}`);
});

test('the retired gallery leaves nothing behind', () => {
  // Its layout, page and the modules only it used are deleted, not orphaned.
  for (const gone of [
    'app/ui/(chrome)/(gallery)',
    'modules/ui/utils/examples.ts',
    'modules/ui/utils/component-api.ts',
    'components/preview-tabs.ts',
  ]) {
    assert.equal(existsSync(resolve(WEBSITE_ROOT, gone)), false, `${gone} is deleted`);
  }
});
test('a non-component registry item does not get a page', async () => {
  // Themes and lib items are registry artifacts with nothing to render. They
  // resolve through loadRegistryItem, so without the type guard they would
  // 200 on an empty shell and land in search results as blank pages.
  for (const slug of ['theme-zinc', 'theme-neutral', 'lib-utils']) {
    const res = await handle(`/ui/${slug}`);
    assert.equal(res.status, 404, `/ui/${slug} is not a component page and does not redirect`);
  }
});

test('the /ui tokens are scoped to .ui-site, so they cannot leak into the marketing pages', async () => {
  // The /ui palette lives in public/ui-input.css on the .ui-site wrapper, never
  // on :root and never in a layout's own style block, where a second copy
  // would drift from the stylesheet the way the old ui.webjs.dev did.
  const layout = readFileSync(resolve(WEBSITE_ROOT, 'app/ui/layout.ts'), 'utf8');
  assert.ok(!layout.includes('@theme'), 'the /ui layout declares no tokens itself');
  assert.ok(!/--background\s*:|--fg\s*:|--accent\s*:/.test(layout), 'and redefines no color token');
  const css = readFileSync(resolve(WEBSITE_ROOT, 'public/ui-input.css'), 'utf8');
  const shared = readFileSync(resolve(WEBSITE_ROOT, 'public/ui-theme.css'), 'utf8');
  const inlineBlock = shared.match(/@theme inline\s*\{[^}]*\}/)?.[0] ?? '';
  for (const t of ['--color-background', '--color-primary', '--color-chart-1', '--color-sidebar']) {
    assert.ok(inlineBlock.includes(t), `${t} maps through @theme inline`);
  }
  assert.match(css, /\.ui-site\s*\{[^}]*--background:\s*light-dark\(/, 'the raw values sit on .ui-site, in light-dark() form');
  assert.match(css, /\.ui-site\s*\{[^}]*--sidebar-primary:/, 'including the sidebar family');
  assert.ok(!/:root\s*\{[^}]*--background:/.test(css), 'and none is declared at :root');
  // ui.css stands alone, since a /ui page loads nothing else: Tailwind's
  // reset, in the layer order @import "tailwindcss" declares, and the rules
  // it shares with tailwind.css.
  assert.match(css, /^@layer theme, base, components, utilities;$/m, 'ui.css declares the layer order');
  assert.match(css, /@import "tailwindcss\/preflight\.css" layer\(base\);/, 'and imports the reset');
  assert.match(css, /@import "\.\/shared-base\.css";/, 'and the shared rules');
  assert.match(readFileSync(resolve(WEBSITE_ROOT, 'public/input.css'), 'utf8'), /@import "\.\/shared-base\.css";/, 'which tailwind.css imports too');
  const html = await bodyOf(UI_COMPONENT);
  assert.match(html, /<div class="ui-site/, 'every /ui page renders inside the .ui-site wrapper');
});

test('the dark variant tracks the site theme, not just the OS preference', () => {
  // The kit's components carry `dark:` utilities and Tailwind's default `dark:`
  // is the OS preference alone, so without this override a reader on a dark OS
  // who picks light gets light page tokens and dark component internals. BOTH
  // stylesheets need it: a `dark:` utility compiled into ui.css follows only
  // the variant declared in ui-theme.css (imported by ui-input.css). One
  // attribute drives both, which is what makes a theme choice hold across the
  // two sections.
  for (const file of ['public/input.css', 'public/ui-theme.css']) {
    const css = readFileSync(resolve(WEBSITE_ROOT, file), 'utf8');
    const variant = css.match(/@custom-variant dark \{[\s\S]*?\n\}/)?.[0];
    assert.ok(variant, `${file} redefines the dark variant`);
    assert.match(variant!, /prefers-color-scheme: dark/, `${file}: it still honours the OS preference`);
    assert.match(variant!, /data-theme='light'/, `${file}: an explicit light choice beats a dark OS`);
    assert.match(variant!, /data-theme='dark'/, `${file}: an explicit dark choice beats a light OS`);
  }
});

/**
 * The registry API is a RELEASED CONTRACT, so it is asserted at the location
 * that now serves it.
 *
 * The redirect test covers the old host's `Location` strings, but a correct
 * redirect into a broken endpoint is still a broken `webjs ui add`, and
 * nothing else here exercised these routes. `/ui/registry` is also a static
 * segment sitting next to the `[name]` page route, so precedence is part of
 * the contract rather than an implementation detail.
 */
test('the registry endpoints serve the shapes a published CLI fetches', async () => {
  const manifest = await handle('/ui/registry');
  assert.equal(manifest.status, 200, 'the full manifest answers');
  assert.equal(manifest.headers.get('content-type'), 'application/json');
  const parsedManifest = JSON.parse(await manifest.text());
  assert.ok(Array.isArray(parsedManifest.items), 'the manifest carries its items');

  const index = await handle('/ui/registry/index.json');
  assert.equal(index.status, 200, 'the flat index answers');
  const items = JSON.parse(await index.text());
  assert.ok(Array.isArray(items) && items.some((i: any) => i.name === 'button'), 'the index lists components');

  // The item shape the CLI parses: `webjsui add` builds `<base>/<name>.json`
  // and reads `files[].content`. An item without inlined content installs an
  // empty file, which is worse than a 404.
  const item = await handle('/ui/registry/button.json');
  assert.equal(item.status, 200);
  const button = JSON.parse(await item.text());
  assert.equal(button.name, 'button');
  assert.equal(button.type, 'registry:ui');
  assert.ok(button.files?.[0]?.content?.includes('buttonClass'), 'the source is inlined, not an empty stub');

  // A synthesized theme resolves through the same route.
  assert.equal((await handle('/ui/registry/theme-zinc.json')).status, 200);
  // And an unknown item is a 404 rather than an empty 200.
  assert.equal((await handle('/ui/registry/does-not-exist.json')).status, 404);
});

test('the registry reserved slugs and CORS survive the move', async () => {
  // `index` and `registry` are reserved slugs the old host answered, carried
  // over verbatim; the CLI relies on them.
  for (const [slug, check] of [
    ['index', (v: any) => Array.isArray(v)],
    ['registry', (v: any) => Array.isArray(v.items)],
  ] as const) {
    const res = await handle(`/ui/registry/${slug}.json`);
    assert.equal(res.status, 200, `${slug} answers`);
    assert.ok(check(JSON.parse(await res.text())), `${slug} returns its documented shape`);
  }
  // The registry is fetched cross-origin by tooling; the old endpoints sent
  // this and dropping it would break a browser-context consumer.
  for (const path of ['/ui/registry', '/ui/registry/index.json', '/ui/registry/button.json']) {
    assert.equal(
      (await handle(path)).headers.get('access-control-allow-origin'),
      '*',
      `${path} is CORS-open`,
    );
  }
});

test('the static registry segment is not shadowed by the component page route', async () => {
  // /ui/registry sits next to /ui/[name]. If the dynamic page won, the CLI
  // would receive an HTML 200 instead of JSON, which parses as neither.
  const res = await handle('/ui/registry');
  assert.match(res.headers.get('content-type') ?? '', /application\/json/, 'JSON, not the component page');
});

test('the sitemap lists each component docs page, never the retired gallery url', async () => {
  const res = await handle('/sitemap.xml');
  assert.equal(res.status, 200);
  const xml = await res.text();
  assert.ok(xml.includes('<loc>https://webjs.dev/ui</loc>'), 'the /ui home is listed');
  for (const name of ['button', 'dialog', 'alert-dialog']) {
    assert.ok(xml.includes(`<loc>https://webjs.dev/ui/docs/components/${name}</loc>`), `${name} is listed`);
    // A redirect in a sitemap makes a crawler spend a fetch to find the page.
    assert.ok(!xml.includes(`<loc>https://webjs.dev/ui/${name}</loc>`), `the old /ui/${name} is not`);
  }
  // A theme is not a page, so listing it would submit a 404 to crawlers.
  assert.ok(!xml.includes('/ui/theme-zinc'), 'non-component registry items stay out');
});
test('the drawer is a component, so nothing has to grep the layout for it', () => {
  // This test used to pin the branches of an inline delegated listener in
  // app/layout.ts, because test/components/browser/docs-drawer.test.js could
  // not import that listener and TRANSCRIBED it instead. Two tests, and the
  // browser one exercised a copy rather than shipping code.
  //
  // components/docs-drawer.ts is importable, so the browser test drives the
  // real element and this file has no transcription left to guard. What
  // survives is the one thing SSR can still check: the mechanism is gone from
  // the layout rather than living in two places at once.
  const layout = readFileSync(resolve(WEBSITE_ROOT, 'app/layout.ts'), 'utf8');
  for (const gone of ['syncDocsNav', 'docs-nav-toggle', 'docs-backdrop', 'data-docs-nav-open']) {
    assert.ok(!layout.includes(gone), `the root layout no longer mentions "${gone}"`);
  }
  const browserTest = readFileSync(
    resolve(WEBSITE_ROOT, 'test/components/browser/docs-drawer.test.js'),
    'utf8',
  );
  assert.ok(
    browserTest.includes("import '#components/docs-drawer.ts'"),
    'the browser test imports the real component instead of transcribing it',
  );
});

test('each component page describes itself, not the section', async () => {
  // Many URLs sharing one description is the duplicate-content shape this
  // whole migration exists to avoid. Each component docs page carries its
  // own record's description from modules/ui/docs/nav.ts.
  const { componentDoc } = await import('#modules/ui/docs/nav.ts');
  const descriptions = new Map<string, string>();
  for (const name of ['button', 'dialog', 'alert-dialog', 'table']) {
    const path = `/ui/docs/components/${name}`;
    const html = await bodyOf(path);
    const d = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
    assert.ok(d, `${path} has a description`);
    descriptions.set(name, d!);
    const own = componentDoc(name)?.description ?? '';
    assert.ok(own && d!.includes(own.replace(/&/g, '&amp;').replace(/"/g, '&quot;').slice(0, 40)), `${path} uses its own record's description`);
  }
  assert.equal(new Set(descriptions.values()).size, descriptions.size, 'every page has its own');
});
test('no page ships a dead SSR action-seed payload', async () => {
  // Site-wide, not gallery-specific, but the gallery is what surfaced it.
  //
  // Every `'use server'` result invoked during SSR is serialized into the page
  // so a shipping async component can skip its on-hydration refetch (#472).
  // This site has no such consumer: no component here does an async render or
  // calls an action, and a page function never re-runs in the browser. So the
  // payload was pure weight, and it was not small: 35KB of a 141KB
  // /ui/dropdown-menu, and 304KB of a 1.1MB /changelog. `webjs.seed` is off
  // for this app as a result.
  //
  // If a component here ever DOES want seeding, re-enable it and delete this
  // test rather than working around it.
  for (const path of ['/ui', '/ui/docs/components/dropdown-menu', '/changelog', '/blog', '/docs/routing']) {
    const html = await bodyOf(path);
    assert.ok(
      !html.includes('__webjs-seeds'),
      `${path} carries an action-seed payload no component on this site can consume`,
    );
  }
});

test('the old /docs/ui page is gone, permanently redirected to /ui', async () => {
  // It was a second, hand-written description of the same kit and it had
  // drifted badly (roughly 55 components claimed against an actual 32, and a
  // <ui-button> API the kit does not have). Two pages chasing one keyword is
  // also the cannibalisation the site's own conventions warn about.
  const res = await handle('/docs/ui');
  assert.ok([301, 308].includes(res.status), `expected a permanent redirect, got ${res.status}`);
  assert.equal(new URL(res.headers.get('location')!, 'http://localhost').pathname, '/ui');
});

test('a page links its kit styles, in <head> and in its own markup', async () => {
  // public/ui.css carries no kit style. Each is one file under
  // public/ui-styles/, linked by the pages that render in it
  // (lib/ui/style-links.ts). The root layout's copy makes a full load
  // flash-free, and the page's copy covers a soft navigation in.
  // test/ssr/ui-style-links.test.ts holds every page to this.
  const headOf = (html: string) => html.slice(0, html.indexOf('</head>'));
  const bodyPart = (html: string) => html.slice(html.indexOf('</head>'));
  const home = await bodyOf(UI_INDEX);
  assert.match(headOf(home), /<link rel="stylesheet" href="\/public\/ui-styles\/rhea\.css/, 'the home page has rhea in <head>');
  assert.match(bodyPart(home), /<link rel="stylesheet" href="\/public\/ui-styles\/rhea\.css/, 'and in its own markup');
  const button = await bodyOf(UI_COMPONENT);
  assert.match(headOf(button), /<link rel="stylesheet" href="\/public\/ui-styles\/nova\.css/, 'a docs page has nova, its previews\' style');
  assert.match(headOf(button), /<link rel="stylesheet" href="\/public\/ui-styles\/new-york\.css/, 'and new-york, the chrome\'s');
  assert.ok(!button.includes('/public/ui-styles/rhea.css'), 'and nothing it does not render');
  const frame = await bodyOf('/ui/view/dashboard-01');
  assert.match(headOf(frame), /\/public\/ui-styles\/new-york\.css/, 'a block frame has new-york');
  assert.ok(!frame.includes('/public/ui-styles/nova.css'), 'and no nova');
  for (const path of [MARKETING_PATH, DOC_PATH]) {
    const html = await bodyOf(path);
    assert.ok(!html.includes('/public/ui-styles/'), `${path} links no kit style`);
  }
});

test('both /ui stylesheet inputs import the shared variants before any kit style', () => {
  // A style's @apply can use a variant (rhea's `not-dark:`) only once it is
  // declared, and CSS allows no rule ahead of an @import, so the variants
  // live in public/ui-theme.css and are imported first.
  const ui = readFileSync(resolve(WEBSITE_ROOT, 'public/ui-input.css'), 'utf8');
  assert.ok(ui.indexOf('./ui-theme.css') >= 0, 'ui-input.css imports ui-theme.css, for its own dark: utilities');
  assert.ok(!ui.includes('@custom-variant dark'), 'and does not redeclare the variant');
  const build = readFileSync(resolve(WEBSITE_ROOT, 'scripts/build-ui-styles.mjs'), 'utf8');
  assert.ok(build.indexOf('ui-theme.css') < build.indexOf('style-${name}.css'), 'the per-style build imports it before the style too');
  const theme = readFileSync(resolve(WEBSITE_ROOT, 'public/ui-theme.css'), 'utf8');
  assert.match(theme, /@custom-variant not-dark \{/, 'not-dark is spelled out, since the two-branch dark variant cannot be negated');
});

test('the home page serves shadcn\'s chat card on its empty state, with the first question queued', async () => {
  // The card is <message-scroller-demo>, shadcn's MessageScrollerDemo. Its
  // first paint is the server's: the empty state and the queued question,
  // inside the wrapper that hides the card's footnote on the home page.
  const home = await bodyOf(UI_INDEX);
  const at = home.indexOf('<message-scroller-demo');
  assert.ok(at > 0, 'the card is in the grid');
  const card = home.slice(at, home.indexOf('</message-scroller-demo>', at));
  assert.match(home.slice(at - 120, at), /\*\*:\[\.text-center\.text-xs\]:hidden/, 'inside the wrapper that hides its footnote');
  assert.match(card, /New Chat/);
  assert.match(card, /data-slot="empty-title"[^>]*>Morning, webjs!/, 'the empty state, before anything is sent');
  assert.match(card, /data-status="ready"[^>]*>I'm building a chat for our app/, 'the first question waits in the box');
  assert.match(card, /aria-label="Reset conversation"/);
  assert.match(card, /<span class="sr-only">Send<\/span>/);
  assert.ok(!card.includes(String.fromCharCode(0x2014)), 'the script keeps the prose rule');
});

test('each kit style is scoped to its nearest wrapper, so a nested region takes one style', async () => {
  // A nova demo sits inside the new-york docs chrome. As plain descendant
  // rules both styles matched it; as @scope blocks that stop at any style
  // wrapper, only the nearer one does (scripts/scope-ui-styles.mjs).
  const { scopeStyle, STYLE_NAMES } = await import('../../scripts/scope-ui-styles.mjs');
  const out = scopeStyle('nova', '/* x */\n.style-nova {\n  .cn-button { @apply rounded-lg; }\n}\n.style-nova {\n  .cn-card { @apply p-4; }\n}\n');
  assert.equal((out.match(/@scope \(\.style-nova\) to \(:is\(/g) || []).length, 2, 'both top-level blocks become scopes');
  for (const n of STYLE_NAMES) assert.ok(out.includes(`.style-${n}`), `the scope stops at .style-${n}`);
  assert.throws(() => scopeStyle('nova', '.cn-button {}'), /no top-level/);
  const build = readFileSync(resolve(WEBSITE_ROOT, 'scripts/build-ui-styles.mjs'), 'utf8');
  assert.match(build, /SCOPED_DIR/, 'the per-style build compiles the scoped copies');
  assert.ok(!/registry\/styles\/style-/.test(build), 'and not the unscoped originals');
});

test('a /ui path that 404s or throws outside the chrome renders in /ui classes, with a way back', async () => {
  // app/ui/not-found.ts and app/ui/error.ts catch the bare frames and a crash
  // in the chrome layout itself. The root boundaries are written in the
  // marketing site's classes, which a /ui path does not load.
  const { renderToString } = await import('@webjsdev/core/server');
  const { default: UiFrameNotFound } = await import('#app/ui/not-found.ts');
  const { default: UiFrameError } = await import('#app/ui/error.ts');
  const missing = await renderToString(UiFrameNotFound());
  const crashed = await renderToString(UiFrameError({ error: new Error('boom <b>') }));
  for (const [name, out] of [['not-found', missing], ['error', crashed]]) {
    assert.match(out, /<main id="main"[^>]*class="flex min-h-svh/, `${name} fills the frame`);
    assert.match(out, /href="\/ui">Back to WebJs UI<\/a>/, `${name} links back to /ui`);
  }
  assert.match(crashed, /boom &lt;b&gt;/, 'the error message is escaped');
  const res = await handle('/ui/view/no-such-block');
  assert.equal(res.status, 404);
  assert.match(await res.text(), /Page not found[\s\S]*Back to WebJs UI/, 'a missing frame renders the /ui 404');
});
