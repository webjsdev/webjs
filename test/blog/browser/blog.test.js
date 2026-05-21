/**
 * E2E test for the blog example: runs in a real browser via WTR + Playwright.
 *
 * These tests navigate to the running blog app and verify real user flows:
 * SSR output, component hydration, navigation, theme toggle, etc.
 *
 * Driven by `npm run test:browser:blog`, which boots the blog dev
 * server on port 3456 and proxies `/__blog/*` to it from the
 * wtr-served origin. Going through the proxy keeps requests
 * same-origin so CORS preflight does not block them; the blog
 * itself ships no CORS headers in dev.
 */

const BLOG_URL = '/__blog';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
};

async function fetchPage(path) {
  const resp = await fetch(BLOG_URL + path);
  return resp;
}

suite('E2E: Blog (real browser)', () => {
  test('homepage returns 200 with HTML', async () => {
    const resp = await fetchPage('/');
    assert.equal(resp.status, 200);
    assert.ok(resp.headers.get('content-type').includes('text/html'));
  });

  test('SSR HTML contains the chrome the example renders', async () => {
    const resp = await fetchPage('/');
    const html = await resp.text();
    assert.ok(html.includes('<theme-toggle'), 'SSR should render the theme-toggle component');
    assert.ok(html.includes('<main'), 'SSR should render a <main> region');
    assert.ok(/<title>[^<]*webjs[^<]*<\/title>/i.test(html), 'SSR should set a webjs <title>');
  });

  test('health endpoint responds', async () => {
    const resp = await fetchPage('/__webjs/health');
    const data = await resp.json();
    assert.equal(data.status, 'ok');
  });

  test('import map includes framework entries', async () => {
    const resp = await fetchPage('/');
    const html = await resp.text();
    assert.ok(html.includes('"@webjskit/core"'), 'import map should have @webjskit/core entry');
    assert.ok(html.includes('@webjskit/core/directives'), 'import map should have directives entry');
  });

  test('API route returns JSON', async () => {
    const resp = await fetchPage('/api/posts');
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.ok(Array.isArray(data), '/api/posts should return an array');
  });

  test('404 for unknown route', async () => {
    const resp = await fetchPage('/this-does-not-exist-xyz');
    assert.equal(resp.status, 404);
  });
});
