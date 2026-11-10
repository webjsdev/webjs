/**
 * End-to-end test: an RPC action that calls revalidatePath() for the page on
 * screen re-renders that page in place (Next.js parity), with no reload and no
 * code in the component beyond `await action()`.
 *
 * Only a real browser exercises the whole chain: the action records the path,
 * the RPC response carries `x-webjs-refresh`, the generated stub reads it and
 * calls `refreshPage()`, and the server re-renders the page with the new data.
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/revalidate-path-refresh.test.mjs
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFixtureDev } from './next-actions-harness.mjs';

describe('E2E: revalidatePath() from an RPC action refreshes the page on screen', {
  skip: !process.env.WEBJS_E2E && 'set WEBJS_E2E=1 to run E2E tests',
}, () => {
  let app;
  before(async () => { app = await startFixtureDev(); });
  after(async () => { await app?.stop(); });

  test('the count updates in place after await bump()', async () => {
    const page = await app.browser.newPage();
    await page.goto(`${app.base}/counter`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => customElements.get('bump-button'));
    const before = await page.evaluate(() => ({ token: window.__docToken, count: Number(document.querySelector('#count').textContent) }));
    await page.click('#bump');
    await page.waitForFunction((n) => Number(document.querySelector('#count')?.textContent) === n + 1, { timeout: 10000 }, before.count);
    const after = await page.evaluate(() => window.__docToken);
    assert.equal(after, before.token, 'no full reload: the document token survived');
    await page.close();
  });
});
