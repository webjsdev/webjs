/**
 * The /ui chrome and home page against shadcn's (#1666): the header's GitHub
 * star count (read on the server, cached, with a fallback), the mobile menu's
 * links, the mode switcher, the footer rules, and the home page's card grid
 * (all five columns) with its below-md picture.
 *
 * GitHub is never called: the star reader's fetcher is stubbed per case.
 */
import test, { before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { readGithubStars, resetGithubStars, setStarsFetcher } from '#lib/github-stars.server.ts';
import { formatStars } from '#lib/ui/github-link.ts';
import { HEADER_NAV, SECTIONS, NAV } from '#modules/ui/docs/nav.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let handle: (path: string) => Promise<Response>;
let calls: string[] = [];

/** Answer the GitHub API with this star count (or a failure), recording each call. */
function stubGithub(answer: number | 'error' | 'down') {
  setStarsFetcher(async (url) => {
    calls.push(url);
    if (answer === 'down') throw new TypeError('fetch failed');
    if (answer === 'error') return new Response('rate limited', { status: 403 });
    return Response.json({ stargazers_count: answer });
  });
}

before(async () => {
  stubGithub('down');
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
});

beforeEach(() => { calls = []; resetGithubStars(); });
afterEach(() => { resetGithubStars(); setStarsFetcher(null); });

async function page(path: string): Promise<string> {
  const res = await handle(path);
  assert.equal(res.status, 200, `${path} renders`);
  return res.text();
}

/** The served header, from its open tag to its close. */
function header(html: string): string {
  const m = html.match(/<header[\s\S]*?<\/header>/);
  assert.ok(m, 'the page has a header');
  return m![0];
}

test('the star count is formatted as shadcn formats it', () => {
  assert.equal(formatStars(28), '28');
  assert.equal(formatStars(999), '999');
  assert.equal(formatStars(1000), '1k');
  assert.equal(formatStars(1499), '1k');
  assert.equal(formatStars(128_400), '128k');
});

test('the star count is read once, then served from the cache', async () => {
  stubGithub(42);
  assert.equal(await readGithubStars(), 42);
  assert.equal(await readGithubStars(), 42);
  assert.equal(calls.length, 1, 'one request for two reads inside the hour');
  assert.equal(calls[0], 'https://api.github.com/repos/webjsdev/webjs', 'it reads webjsdev/webjs');
});

test('a failure yields null, and is not retried on every read', async () => {
  stubGithub('error');
  assert.equal(await readGithubStars(), null);
  stubGithub('down');
  assert.equal(await readGithubStars(), null);
  assert.equal(calls.length, 1, 'the failed attempt holds off the next one');
});

test('a value read earlier survives a later failure', async () => {
  stubGithub(7);
  assert.equal(await readGithubStars(), 7);
  // Expire it by hand: the retry window is the only thing standing between
  // reads, so a reset of the timestamp alone stands in for an hour passing.
  stubGithub('down');
  const realNow = Date.now;
  Date.now = () => realNow() + 2 * 60 * 60 * 1000;
  try {
    assert.equal(await readGithubStars(), 7, 'the stale count is served while the refresh runs');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(await readGithubStars(), 7, 'and kept when the refresh fails');
  } finally {
    Date.now = realNow;
  }
});

test('the header shows the count beside the GitHub mark', async () => {
  stubGithub(1234);
  const h = header(await page('/ui'));
  assert.match(h, /href="https:\/\/github\.com\/webjsdev\/webjs"/);
  assert.match(h, /<span data-github-stars[^>]*>1k<\/span>/);
});

test('with GitHub down the header shows the mark alone', async () => {
  stubGithub('down');
  const h = header(await page('/ui'));
  assert.match(h, /href="https:\/\/github\.com\/webjsdev\/webjs"/);
  assert.doesNotMatch(h, /data-github-stars/);
});

test('the header carries shadcn\'s controls in shadcn\'s order', async () => {
  const h = header(await page('/ui'));
  const at = (needle: string) => {
    const i = h.indexOf(needle);
    assert.ok(i >= 0, `the header has ${needle}`);
    return i;
  };
  const order = ['<ui-mobile-nav', 'aria-label="Main"', 'github.com/webjsdev/webjs', '<ui-mode-switcher', 'data-new-project'].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'menu, nav, GitHub, mode switch, New');
  assert.doesNotMatch(h, /<theme-toggle/, 'the three-state marketing toggle is not in the /ui header');
  assert.match(h, /<ui-mobile-nav class="flex lg:hidden"/, 'the menu is for below lg only');
});

test('the mobile menu lists the header links, the docs sections and every docs group', async () => {
  const h = header(await page('/ui'));
  const menu = h.match(/<ui-mobile-nav[\s\S]*?<\/ui-mobile-nav>/)![0];
  for (const l of [...HEADER_NAV, ...SECTIONS, ...NAV.flatMap((g) => g.items)]) {
    assert.ok(menu.includes(`href="${l.href}"`), `the menu links ${l.href}`);
  }
  for (const title of ['Menu', 'Sections', ...NAV.map((g) => g.title)]) {
    assert.ok(menu.includes(`>${title}</div>`), `the menu has a ${title} heading`);
  }
  assert.match(menu, /<details\s+class="group\/mnav"/, 'a native details, so it opens with JS off');
});

test('the footer follows shadcn\'s rules for docs and designer pages', async () => {
  const html = await page('/ui');
  const footer = html.match(/<footer class="([^"]*)"/)![1];
  for (const cls of ['group-has-data-[slot=designer]/layout:hidden', 'group-has-[[data-slot=docs]]/layout:hidden', 'group-has-[.section-soft]/layout:bg-surface/40']) {
    assert.ok(footer.split(' ').includes(cls), `the footer carries ${cls}`);
  }
  assert.match(html, /The source code is available on <a[^>]*href="https:\/\/github\.com\/webjsdev\/webjs"/);
});

test('the home page links where shadcn\'s does', async () => {
  const html = await page('/ui');
  assert.match(html, /<a href="\/ui\/docs\/installation"[^>]*>Get Started<\/a>/);
  assert.match(html, /<a href="\/ui\/docs\/components"[^>]*>View Components<\/a>/);
  assert.match(html, /<a href="\/ui\/docs\/changelog" data-slot="badge"/);
});

test('the card grid has all five of shadcn\'s columns', async () => {
  const html = await page('/ui');
  const demo = html.slice(html.indexOf('data-slot="demo"'));
  const columns = [...demo.matchAll(/<div class="((?:hidden )?flex(?:-col)? [^"]*gap-\(--gap\)[^"]*)">/g)].map((m) => m[1]);
  assert.deepEqual(
    columns.map((c) => c.split(' ').find((t) => /:flex$/.test(t)) ?? 'always'),
    ['always', 'lg:flex', 'min-[1400px]:flex', 'md:flex', 'min-[1900px]:flex'],
    'one column always, then from lg, 1400px, md and 1900px, as shadcn\'s',
  );
  const fifth = demo.slice(demo.indexOf('min-[1900px]:flex'));
  for (const title of ['Distribute Track', 'Analytics', 'Notifications', 'Power Usage']) {
    assert.ok(fifth.includes(title), `the fifth column has ${title}`);
  }
});

test('below md the home page shows a picture of the grid instead of the grid', async () => {
  const html = await page('/ui');
  assert.match(html, /<section class="-mx-4 w-\[140vw\] overflow-hidden md:hidden">/);
  assert.match(html, /<img src="\/public\/images\/home-cards-light\.png[^"]*"[^>]*class="block h-auto w-full dark:hidden"/);
  assert.match(html, /<img src="\/public\/images\/home-cards-dark\.png[^"]*"[^>]*class="hidden h-auto w-full dark:block"/);
  assert.match(html, /<section class="style-rhea hidden md:block">/);
  for (const theme of ['light', 'dark']) {
    const res = await handle(`/public/images/home-cards-${theme}.png`);
    assert.equal(res.status, 200, `the ${theme} picture is served`);
  }
});

test('the UI elements card shows its extra switch only from 4xl', async () => {
  // The switch host is display: contents, so the breakpoint class must sit on
  // a wrapper; on the host it hid nothing and the row overflowed the card.
  const html = await page('/ui');
  assert.match(html, /<span class="hidden 4xl:flex items-center"><ui-switch[^>]*aria-label="Enable advanced setting"/);
  assert.match(html, /<span class="flex 4xl:hidden items-center"><ui-switch[^>]*aria-label="Enable compact notifications"/);
});
