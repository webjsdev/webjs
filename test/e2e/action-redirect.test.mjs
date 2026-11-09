/**
 * End-to-end test: redirect() in a server action behaves as in Next.js.
 *   - Called over RPC from a component: the client router navigates to the
 *     target with no full reload.
 *   - Bound to a form: the response is a 303, the browser follows with a GET,
 *     and the action runs exactly once (a 307 re-POSTed and ran it twice),
 *     with JavaScript on (the router submits) and off (a native submission).
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/action-redirect.test.mjs
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFixtureDev } from './next-actions-harness.mjs';

describe('E2E: redirect() from a server action', {
  skip: !process.env.WEBJS_E2E && 'set WEBJS_E2E=1 to run E2E tests',
}, () => {
  let app;
  before(async () => { app = await startFixtureDev(); });
  after(async () => { await app?.stop(); });

  test('an RPC action redirect navigates with the client router', async () => {
    const page = await app.browser.newPage();
    await page.goto(`${app.base}/go`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => customElements.get('go-button'));
    const token = await page.evaluate(() => window.__docToken);
    await page.click('#go');
    await page.waitForFunction(() => location.pathname === '/counter' && document.querySelector('#count'), { timeout: 10000 });
    assert.equal(await page.evaluate(() => window.__docToken), token, 'no full reload');
    await page.close();
  });

  for (const js of [true, false]) {
    test(`a form action redirect runs the action once (JavaScript ${js ? 'on' : 'off'})`, async () => {
      const page = await app.browser.newPage();
      await page.setJavaScriptEnabled(js);
      await page.goto(`${app.base}/created`, { waitUntil: 'networkidle0' });
      const before = Number(await page.$eval('#runs', (el) => el.textContent));
      await page.goto(`${app.base}/create`, { waitUntil: 'networkidle0' });
      await Promise.all([
        js ? page.waitForFunction(() => location.pathname === '/created', { timeout: 10000 }) : page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('#create'),
      ]);
      await page.waitForSelector('#runs');
      assert.equal(new URL(page.url()).pathname, '/created');
      assert.equal(Number(await page.$eval('#runs', (el) => el.textContent)), before + 1, 'exactly one run');
      await page.close();
    });
  }
});
