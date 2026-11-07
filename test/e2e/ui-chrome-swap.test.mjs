/**
 * The marketing site and /ui have different chrome, owned by two route-group
 * layouts, `app/(site)/layout.ts` and `app/ui/(chrome)/layout.ts` (#1666).
 * This is the first in-repo app that gives a route group its own layout, so
 * the swap is proven in a real browser rather than inferred from the router's
 * unit tests:
 *
 *   1. A soft navigation from a marketing page to /ui, through a link with
 *      NO `data-no-router`, swaps the header and footer with no full page
 *      load and no `webjs:navigation-fallback`.
 *   2. The /ui stylesheet applies after that swap (the root layout is not
 *      re-rendered on a soft navigation, so the link app/ui/layout.ts emits is
 *      what brings it in).
 *   3. The content's offset fits the NEW header: each header is sized by the
 *      --header-h token, which follows the section (and the /ui header's
 *      breakpoint), so nothing measures a header a swap may have replaced
 *      (#1660).
 *   4. Back swaps the marketing chrome in again, still without a reload.
 *   5. A dark choice made on the marketing side holds on /ui, because both
 *      sections read the one `data-theme` attribute.
 *
 * Runs against the website dev server, the same way
 * form-submission-and-race.test.mjs does (CI starts it on :5001).
 * WEBJS_E2E_WEBSITE_URL points it at another one.
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/ui-chrome-swap.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.WEBJS_E2E_WEBSITE_URL || 'http://localhost:5001';
const MARKETING = '/what-is-webjs';
const enabled = process.env.WEBJS_E2E === '1';

async function ensureServer() {
  try {
    const res = await fetch(`${BASE}/ui`);
    if (!res.ok) throw new Error(`server responded ${res.status}`);
  } catch {
    throw new Error(`website dev server not reachable at ${BASE}. Start it with: cd website && npm run dev`);
  }
}

/** The text of the fixed header currently on the page. */
const headerText = (page) => page.evaluate(() => {
  const bars = document.querySelectorAll('.site-top');
  return bars.length === 1 ? bars[0].textContent || '' : `count=${bars.length}`;
});

test('marketing to /ui and back swaps the chrome softly', { skip: !enabled }, async () => {
  await ensureServer();
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext()).newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(BASE + MARKETING);
    await page.waitForLoadState('load');
    assert.match(await headerText(page), /Blog/, 'starts on the marketing header');
    assert.equal(await page.locator('link[href*="/public/ui.css"]').count(), 0, 'the /ui stylesheet is not loaded on a marketing page');

    // A marker that a full page load would wipe, plus a recorder for the
    // router's degradation event, armed BEFORE the click.
    await page.evaluate(() => {
      window.__sameDocument = true;
      window.__fallbacks = [];
      document.addEventListener('webjs:navigation-fallback', (e) => window.__fallbacks.push(e.detail?.cause));
      // A plain in-page link to /ui with no data-no-router, the way a link
      // in a blog post would be. The chrome's own UI links take a full load
      // on purpose, so they cannot exercise the soft path.
      const a = document.createElement('a');
      a.href = '/ui';
      a.id = 'e2e-to-ui';
      a.textContent = 'to ui';
      document.querySelector('main')?.append(a);
    });

    await page.click('#e2e-to-ui');
    await page.waitForURL(BASE + '/ui');
    await page.waitForFunction(() => (document.querySelector('.site-top')?.textContent || '').includes('WebJs UI'));

    assert.equal(await page.evaluate(() => window.__sameDocument), true, 'no full page load happened');
    assert.deepEqual(await page.evaluate(() => window.__fallbacks), [], 'the router did not degrade the navigation');
    const uiHeader = await headerText(page);
    assert.match(uiHeader, /WebJs UI/, 'the /ui header is in');
    assert.doesNotMatch(uiHeader, /Compare/, 'and the marketing header is gone');
    assert.match(await page.locator('footer').first().textContent(), /shadcn\/ui/, 'the /ui footer is in');

    // The /ui stylesheet arrives with the swapped markup and applies.
    await page.waitForFunction(() => {
      const el = document.querySelector('.ui-site');
      return !!el && getComputedStyle(el).fontFamily.includes('Geist');
    }, null, { timeout: 10_000 });

    // The offset fits the header that is on screen now: the bar's height
    // equals the body's top padding, at the /ui header's two sizes.
    const headerFits = () => page.waitForFunction(() => {
      const bar = document.querySelector('.site-top');
      const pad = parseFloat(getComputedStyle(document.body).paddingTop);
      return !!bar && pad > 0 && Math.abs(bar.getBoundingClientRect().height - pad) < 0.5;
    });
    await headerFits();
    await page.setViewportSize({ width: 500, height: 800 });
    await headerFits();
    assert.equal(await page.evaluate(() => document.querySelector('.site-top').getBoundingClientRect().height), 56, 'the /ui header is 3.5rem below 64rem');
    await page.setViewportSize({ width: 1280, height: 800 });
    await headerFits();
    assert.equal(await page.evaluate(() => document.querySelector('.site-top').getBoundingClientRect().height), 64, 'and 4rem from 64rem');

    await page.goBack();
    await page.waitForURL(BASE + MARKETING);
    await page.waitForFunction(() => (document.querySelector('.site-top')?.textContent || '').includes('Blog'));
    assert.equal(await page.evaluate(() => window.__sameDocument), true, 'Back is still the same document');
    assert.doesNotMatch(await headerText(page), /WebJs UI/, 'the /ui header is gone again');
    await headerFits();
    assert.deepEqual(errors, [], 'no page errors');
  } finally {
    await browser.close();
  }
});

test('a dark choice made on the marketing site holds on /ui', { skip: !enabled }, async () => {
  await ensureServer();
  const browser = await chromium.launch();
  try {
    // A light OS, so only the stored choice can make the page dark.
    const page = await (await browser.newContext({ colorScheme: 'light' })).newPage();
    await page.goto(BASE + MARKETING);
    await page.evaluate(() => localStorage.setItem('webjs_theme', 'dark'));
    await page.goto(BASE + '/ui');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    // The /ui palette resolves its light-dark() tokens to the dark side:
    // shadcn's dark background is oklch(0.145 0 0), a near-black.
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.ui-site')).backgroundColor);
    assert.match(bg, /oklch\(0\.145 0 0\)|rgb\(10, 10, 10\)/, `the /ui background is the dark token (got ${bg})`);
  } finally {
    await browser.close();
  }
});
