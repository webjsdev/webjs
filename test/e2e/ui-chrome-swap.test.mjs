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
 *   2. The /ui stylesheet is applied when the swapped content lands (the
 *      link app/ui/layout.ts leads with is hoisted into the response's head,
 *      and the router loads it before it swaps the page in), and the
 *      marketing sheet is switched off, so the soft navigation applies
 *      exactly the stylesheets a full load of /ui does (#1669). Back
 *      reverses both.
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

/**
 * The stylesheets that apply right now, by path, sorted: every head link that
 * is a stylesheet, not switched off (#1669) and not one of the router's
 * temporary copies, plus how many links point at a file already counted.
 */
const activeSheets = (page) => page.evaluate(() => {
  const seen = new Map();
  for (const l of document.querySelectorAll('link[rel~="stylesheet"]')) {
    if (l.hasAttribute('data-webjs-preload-style')) continue;
    const path = new URL(l.href).pathname;
    const on = !(l.sheet && l.sheet.disabled);
    seen.set(path, { on: on || seen.get(path)?.on, n: (seen.get(path)?.n || 0) + 1 });
  }
  return {
    on: [...seen].filter(([, v]) => v.on).map(([p]) => p).sort(),
    duplicated: [...seen].filter(([, v]) => v.n > 1).map(([p]) => p),
  };
});

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

    // What a FULL load of each side applies, the baseline a soft navigation
    // has to match: a section's sheet leaves with the section (#1669).
    await page.goto(BASE + '/ui');
    await page.waitForLoadState('load');
    const fullUi = await activeSheets(page);
    await page.goto(BASE + MARKETING);
    await page.waitForLoadState('load');
    const fullMarketing = await activeSheets(page);
    assert.deepEqual(fullMarketing.duplicated, [], 'a full load links each stylesheet once');
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
      // The font the /ui content paints in on the FIRST frame it is in the
      // document. The router loads the stylesheets a page brings before it
      // swaps the page in, so the swapped content is never unstyled.
      window.__fontAtSwap = null;
      new MutationObserver((records, observer) => {
        const el = document.querySelector('.ui-site');
        if (!el) return;
        window.__fontAtSwap = getComputedStyle(el).fontFamily;
        observer.disconnect();
      }).observe(document.body, { childList: true, subtree: true });
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

    // The /ui stylesheet is applied on the first frame the /ui content is in
    // the document, not after it: the swap waited for it.
    assert.match(await page.evaluate(() => window.__fontAtSwap) || '', /Geist/, 'the swapped content is styled when it lands');
    // The marketing sheet is switched off and the /ui ones are on: the same
    // set a full load of /ui applies, each file linked once.
    assert.deepEqual((await activeSheets(page)).on, fullUi.on, 'a soft navigation into /ui applies what a full load does');
    assert.deepEqual((await activeSheets(page)).duplicated, [], 'and links no file twice');

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
    // Back switches the marketing sheet on again and the /ui ones off.
    assert.deepEqual((await activeSheets(page)).on, fullMarketing.on, 'Back applies what a full load of the marketing page does');
    assert.deepEqual((await activeSheets(page)).duplicated, [], 'still one link per file');
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
