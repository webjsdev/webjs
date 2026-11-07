/**
 * No /ui page is wider than a phone (#1666). At 390px in mobile emulation
 * every page's document must be exactly the screen's width: a docs title row
 * or a code figure that runs past it widens the layout viewport, which drags
 * the fixed header wider with it and leaves the page scrolling sideways.
 * shadcn's site has no such page.
 *
 * The pages come from /ui/llms.txt, the list lib/ui/llm.server.ts derives
 * from the nav, the component records, the blocks and the route table, so a
 * page added tomorrow is checked with no edit here. Content that scrolls
 * inside its own container (a code block, a table) is fine; only the
 * document's own scroll width counts.
 *
 * Runs against the website dev server, like ui-chrome-swap.test.mjs (CI
 * starts it on :5001). WEBJS_E2E_WEBSITE_URL points it at another one.
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/ui-phone-overflow.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.WEBJS_E2E_WEBSITE_URL || 'http://localhost:5001';
const enabled = process.env.WEBJS_E2E === '1';
const WIDTH = 390;

/** Every /ui page path /ui/llms.txt lists, from its markdown links. */
async function uiPages() {
  let res;
  for (let attempt = 1; attempt <= 10 && !res?.ok; attempt++) {
    res = await fetch(`${BASE}/ui/llms.txt`).catch(() => undefined);
    if (!res?.ok) await new Promise((r) => setTimeout(r, 2000));
  }
  if (!res?.ok) throw new Error(`website dev server not reachable at ${BASE}. Start it with: cd website && npm run dev`);
  const text = await res.text();
  const paths = new Set();
  for (const m of text.matchAll(/\]\((?:https?:\/\/[^/)]+)?(\/ui\/llm(?:\/[^)#?]*)?)\)/g)) {
    paths.add(m[1].replace(/^\/ui\/llm/, '/ui') || '/ui');
  }
  return [...paths];
}

test('no /ui page overflows a 390px phone', { skip: !enabled, timeout: 900_000 }, async () => {
  const pages = await uiPages();
  assert.ok(pages.length > 50, `the page list is the whole /ui section (${pages.length})`);
  const browser = await chromium.launch();
  const wide = [];
  try {
    const context = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    for (const path of pages) {
      // A dev server restarts on every source change; ride out a refused load.
      for (let attempt = 1; ; attempt++) {
        try {
          await page.goto(BASE + path, { waitUntil: 'load' });
          break;
        } catch (err) {
          if (attempt === 10 || !/ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|ERR_ABORTED|ERR_CONNECTION_RESET/.test(String(err))) throw err;
          await page.waitForTimeout(2000);
        }
      }
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      if (width > WIDTH) {
        // Name the outermost element past the edge, which is the one to fix.
        const culprit = await page.evaluate((w) => {
          const past = [...document.body.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > w + 1);
          const outer = past.find((el) => !past.includes(el.parentElement));
          return outer ? `<${outer.tagName.toLowerCase()} class="${String(outer.className).slice(0, 80)}">` : '';
        }, WIDTH);
        wide.push(`${path} is ${width}px ${culprit}`);
      }
    }
  } finally {
    await browser.close();
  }
  assert.deepEqual(wide, [], `pages wider than ${WIDTH}px:\n${wide.join('\n')}`);
});
