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
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const UI_INDEX = '/ui';
const UI_COMPONENT = '/ui/button';
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
  for (const label of ['>Blog<', '>Compare<', '>Changelog<']) {
    assert.ok(!uiHeader.includes(label), `the marketing nav item ${label} is not in the /ui header`);
    assert.ok(marketingHeader.includes(label), `and it IS in the marketing header`);
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

test('there is exactly one header, one footer, and one theme toggle', async () => {
  // The real regression to guard is a SECOND set of chrome, which comparing
  // the first match cannot see: the marketing chrome rendered around the /ui
  // chrome, say, because a page landed outside the route groups.
  for (const path of [UI_COMPONENT, MARKETING_PATH]) {
    const html = await bodyOf(path);
    assert.equal(html.split('<div class="site-top').length - 1, 1, `${path}: one header`);
    assert.equal(html.split('<footer').length - 1, 1, `${path}: one footer`);
    assert.equal(html.split('<theme-toggle').length - 1, 1, `${path}: one theme toggle`);
  }
});

test('a full load of a /ui page has the /ui stylesheet in <head>, and a marketing page has none', async () => {
  // Only the ROOT layout's leading link run is hoisted into <head>, and a
  // stylesheet left in <body> is not reliably render-blocking (#406), so the
  // root layout emits the /ui link itself, for /ui paths only.
  const headOf = (html: string) => html.slice(0, html.indexOf('</head>'));
  const ui = await bodyOf(UI_COMPONENT);
  assert.match(headOf(ui), /<link rel="stylesheet" href="\/public\/ui\.css/, '/ui has ui.css in <head>');
  assert.match(headOf(ui), /\/public\/fonts\/geist\.woff2/, 'and preloads Geist');
  for (const path of [MARKETING_PATH, DOC_PATH, '/']) {
    const html = await bodyOf(path);
    assert.ok(!html.includes('/public/ui.css'), `${path} does not load the /ui stylesheet`);
    assert.ok(!html.includes('geist.woff2'), `${path} does not preload the /ui font`);
  }
});

test('the two chrome layouts measure their header with the same script', () => {
  // Each chrome layout carries its own copy of the --header-h script, next to
  // the header it measures, so the router re-runs it after a swap. Two copies
  // drift, so they are held identical here.
  const scriptOf = (file: string) => {
    const src = readFileSync(resolve(WEBSITE_ROOT, file), 'utf8');
    const m = src.match(/<script nonce=\$\{nonce\}>[\s\S]*?<\/script>/);
    assert.ok(m, `${file} carries the header script`);
    return m![0];
  };
  assert.equal(scriptOf('app/ui/(chrome)/layout.ts'), scriptOf('app/(site)/layout.ts'));
});

test('a thrown notFound() under /ui keeps the /ui chrome', async () => {
  const res = await handle('/ui/theme-zinc');
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(headerOf(html), /WebJs UI/, 'the /ui section boundary renders inside the /ui chrome');
});

test('the gallery uses the SAME sidebar shell as the docs', async () => {
  // Not merely "has a sidebar": the same one, from lib/ui/docs-shell.ts. The
  // whole reason that module was extracted is that two hand-maintained
  // sidebars drift, which is how the old site ended up looking foreign.
  const [ui, docs] = await Promise.all([bodyOf(UI_COMPONENT), bodyOf(DOC_PATH)]);
  for (const marker of ['id="docs-sidebar"', 'class="docs-nav', 'class="docs-backdrop"']) {
    assert.ok(ui.includes(marker), `the gallery renders ${marker}`);
    assert.ok(docs.includes(marker), `and so do the docs, from the same shell`);
  }
});

test('the sidebar groups components under bare Tier 1 and Tier 2 headers', async () => {
  const ui = await bodyOf(UI_INDEX);
  assert.match(ui, />Tier 1</, 'Tier 1 section header');
  assert.match(ui, />Tier 2</, 'Tier 2 section header');
  // The old site spelled these out as "Tier 1 Class helpers" / "Tier 2 Custom
  // elements" in the nav. The tiers are explained on the introduction page;
  // the sidebar only needs to group.
  assert.ok(!/Tier 1\s*<span[^>]*>\s*Class helpers/.test(ui), 'no descriptive suffix in the nav');
});

test('/ui opens on the introduction, with no separate landing page', async () => {
  // A marketing landing page in front of the gallery is exactly what this
  // migration removed: /ui IS the gallery, the way /docs opens on Getting
  // Started rather than on a pitch for the documentation.
  const res = await handle(UI_INDEX);
  assert.equal(res.status, 200, '/ui renders directly, no redirect to a sub-path');
  const html = await res.text();
  assert.ok(html.includes('id="docs-sidebar"'), 'and it renders inside the gallery shell');
});

test('every component in the registry has a reachable page', async () => {
  // The sidebar is generated from the registry index, so a component that is
  // listed but whose page 404s would be an invisible dead link on every page
  // of the section.
  const { loadRegistryIndex } = await import('#modules/ui/queries/registry.server.ts');
  const components = (await loadRegistryIndex()).filter((i: any) => i.type === 'registry:ui');
  assert.ok(components.length > 20, `sanity: expected the full kit, got ${components.length}`);
  const dead: string[] = [];
  for (const c of components) {
    const res = await handle(`/ui/${c.name}`);
    if (res.status !== 200) dead.push(`/ui/${c.name} (${res.status})`);
  }
  assert.deepEqual(dead, [], `these components are listed but do not render:\n  ${dead.join('\n  ')}`);
});

test('a non-component registry item does not get a page', async () => {
  // Themes and lib items are registry artifacts with nothing to render. They
  // resolve through loadRegistryItem, so without the type guard they would
  // 200 on an empty shell and land in search results as blank pages.
  for (const slug of ['theme-zinc', 'theme-neutral', 'lib-utils']) {
    const res = await handle(`/ui/${slug}`);
    assert.equal(res.status, 404, `/ui/${slug} is not a component page`);
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
  const inlineBlock = css.match(/@theme inline\s*\{[^}]*\}/)?.[0] ?? '';
  for (const t of ['--color-background', '--color-primary', '--color-chart-1', '--color-sidebar']) {
    assert.ok(inlineBlock.includes(t), `${t} maps through @theme inline`);
  }
  assert.match(css, /\.ui-site\s*\{[^}]*--background:\s*light-dark\(/, 'the raw values sit on .ui-site, in light-dark() form');
  assert.match(css, /\.ui-site\s*\{[^}]*--sidebar-primary:/, 'including the sidebar family');
  assert.ok(!/:root\s*\{[^}]*--background:/.test(css), 'and none is declared at :root');
  assert.ok(!/@import\s+["']tailwindcss["']/.test(css), 'ui.css does not ship a second preflight');
  const html = await bodyOf(UI_COMPONENT);
  assert.match(html, /<div class="ui-site/, 'every /ui page renders inside the .ui-site wrapper');
});

test('the kit palette is scoped to previews, so it cannot leak into the chrome', () => {
  // The shadcn values must live on .ui-preview, never on :root. Declared at
  // :root they would repaint the whole marketing site with the kit's neutral
  // palette. They also have to be declared through `@theme inline`, or the
  // utilities resolve their var() at :root (where the kit palette does not
  // exist) and every filled component in a preview renders transparent.
  const css = readFileSync(resolve(WEBSITE_ROOT, 'public/input.css'), 'utf8');
  const inlineBlock = css.match(/@theme inline\s*\{[^}]*\}/)?.[0] ?? '';
  assert.ok(inlineBlock.includes('--color-primary'), 'the kit palette maps through @theme inline');
  assert.ok(inlineBlock.includes('--color-accent'), 'including accent, which the preview re-scopes');
  assert.match(css, /\.ui-preview\s*\{[^}]*--primary:/, 'raw values are scoped to .ui-preview');
  assert.ok(
    !/:root\s*\{[^}]*--primary:/.test(css),
    'and never declared at :root, which would repaint the whole site'
  );
});

test('the dark variant tracks the site theme, not just the OS preference', () => {
  // The kit's components carry `dark:` utilities and Tailwind's default `dark:`
  // is the OS preference alone, so without this override a reader on a dark OS
  // who picks light gets light page tokens and dark component internals. BOTH
  // stylesheets need it: a `dark:` utility compiled into ui.css follows only
  // the variant declared in ui-input.css. One attribute drives both, which is
  // what makes a theme choice hold across the two sections.
  for (const file of ['public/input.css', 'public/ui-input.css']) {
    const css = readFileSync(resolve(WEBSITE_ROOT, file), 'utf8');
    const variant = css.match(/@custom-variant dark \{[\s\S]*?\n\}/)?.[0];
    assert.ok(variant, `${file} redefines the dark variant`);
    assert.match(variant!, /prefers-color-scheme: dark/, `${file}: it still honours the OS preference`);
    assert.match(variant!, /data-theme='light'/, `${file}: an explicit light choice beats a dark OS`);
    assert.match(variant!, /data-theme='dark'/, `${file}: an explicit dark choice beats a light OS`);
  }
});

test('a preview pane carries the scoping class', async () => {
  const html = await bodyOf(UI_COMPONENT);
  assert.ok(html.includes('class="ui-preview'), 'the preview pane opts into the kit palette');
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

test('the gallery appears in the sitemap, one URL per component', async () => {
  const res = await handle('/sitemap.xml');
  assert.equal(res.status, 200);
  const xml = await res.text();
  assert.ok(xml.includes('<loc>https://webjs.dev/ui</loc>'), 'the gallery index is listed');
  for (const name of ['button', 'dialog', 'alert-dialog']) {
    assert.ok(xml.includes(`<loc>https://webjs.dev/ui/${name}</loc>`), `${name} is listed`);
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
  // 33 URLs sharing one description is the duplicate-content shape this whole
  // migration exists to avoid, so introducing it here would have been
  // self-defeating. The layout still supplies the section default, which is
  // what /ui itself uses.
  const descriptions = new Map<string, string>();
  for (const path of ['/ui/button', '/ui/dialog', '/ui/alert-dialog', '/ui/table']) {
    const html = await bodyOf(path);
    const d = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
    assert.ok(d, `${path} has a description`);
    descriptions.set(path, d!);
  }
  assert.equal(new Set(descriptions.values()).size, descriptions.size, 'every page has its own');

  // And it says something true about that component rather than a generic
  // blurb: the tier decides which sentence, so a component moving tier moves
  // its description with it.
  assert.match(descriptions.get('/ui/button')!, /class helper/, 'a Tier-1 component reads as a helper');
  assert.match(descriptions.get('/ui/button')!, /buttonClass\(\)/, 'and names its helper');
  assert.match(descriptions.get('/ui/dialog')!, /custom element/, 'a Tier-2 component reads as an element');
  assert.match(descriptions.get('/ui/alert-dialog')!, /ui-alert-dialog/, 'and names its tag');
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
  for (const path of ['/ui', '/ui/dropdown-menu', '/changelog', '/blog', '/docs/routing']) {
    const html = await bodyOf(path);
    assert.ok(
      !html.includes('__webjs-seeds'),
      `${path} carries an action-seed payload no component on this site can consume`,
    );
  }
});

test('the old /docs/ui page is gone, permanently redirected to the gallery', async () => {
  // It was a second, hand-written description of the same kit and it had
  // drifted badly (roughly 55 components claimed against an actual 32, and a
  // <ui-button> API the kit does not have). Two pages chasing one keyword is
  // also the cannibalisation the site's own conventions warn about.
  const res = await handle('/docs/ui');
  assert.ok([301, 308].includes(res.status), `expected a permanent redirect, got ${res.status}`);
  assert.equal(new URL(res.headers.get('location')!, 'http://localhost').pathname, '/ui');
});
