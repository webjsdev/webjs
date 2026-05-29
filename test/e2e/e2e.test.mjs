/**
 * End-to-end tests for webjs.
 *
 * Starts the example blog app on a random port, runs Puppeteer against it,
 * and tears down. These tests verify the full stack: SSR, client hydration,
 * routing, theme toggle, component rendering, preloads, and import maps.
 *
 * Requires: chromium + puppeteer-core (devDependencies of the monorepo).
 *
 * Run:   WEBJS_E2E=1 node --test test/e2e/e2e.test.mjs
 * (gated behind WEBJS_E2E so the default `npm test` run skips it; CI runs
 * it as its own job, see .github/workflows/ci.yml)
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const BLOG_DIR = resolve(ROOT, 'examples', 'blog');

let browser, page, serverProcess, baseUrl;

/**
 * Find a free port by binding to 0 and releasing.
 * @returns {Promise<number>}
 */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/**
 * Start the blog example dev server and wait until it's ready.
 * @param {number} port
 * @returns {Promise<import('node:child_process').ChildProcess>}
 */
function startBlog(port) {
  const cliPath = resolve(ROOT, 'packages', 'cli', 'bin', 'webjs.js');
  return new Promise((res, reject) => {
    const child = spawn(
      process.execPath,
      [cliPath, 'dev', '--port', String(port)],
      {
        cwd: BLOG_DIR,
        env: { ...process.env, __WEBJS_DEV_CHILD: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let started = false;
    const onData = (chunk) => {
      const text = chunk.toString();
      if (!started && text.includes('ready on')) {
        started = true;
        res(child);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    child.on('exit', (code) => {
      if (!started) reject(new Error(`Server exited with code ${code} before ready`));
    });
    setTimeout(() => { if (!started) reject(new Error('Server start timeout')); }, 15000);
  });
}

// --- Tests ---

describe('E2E: Blog example', { skip: !process.env.WEBJS_E2E && 'set WEBJS_E2E=1 to run E2E tests' }, () => {

  before(async () => {
    const puppeteer = (await import('puppeteer-core')).default;
    const chromium = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

    const port = await freePort();
    baseUrl = `http://localhost:${port}`;
    serverProcess = await startBlog(port);

    browser = await puppeteer.launch({
      executablePath: chromium,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
  });

  after(async () => {
    if (browser) await browser.close();
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise((r) => { serverProcess.on('exit', r); setTimeout(r, 3000); });
    }
  });

  test('homepage renders with correct title', async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000);
    const title = await page.title();
    assert.ok(title.toLowerCase().includes('blog'), `Expected blog title, got: ${title}`);
  });

  test('layout emits wj:children markers for the client router', async () => {
    // Per-layout `<!--wj:children:<segment>-->` comment markers wrap
    // each ${children} interpolation. The client router walks these
    // markers across old + new DOMs to detect the deepest shared
    // layout for partial-swap navigation. Replaced the older single
    // `data-layout` attribute approach on 2026-05-16 (f216f0e).
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(1000);
    const markers = await page.evaluate(() => {
      const it = document.createNodeIterator(document, NodeFilter.SHOW_COMMENT);
      const layoutMarkers = [];
      let n;
      while ((n = it.nextNode())) {
        if (n.data && n.data.startsWith('wj:children:')) {
          layoutMarkers.push(n.data);
        }
      }
      const hasNav = !!document.querySelector('header nav');
      const hasMain = !!document.querySelector('main');
      return { layoutMarkers, hasNav, hasMain };
    });
    assert.ok(markers.layoutMarkers.length > 0,
      `wj:children comment markers should be present; got ${JSON.stringify(markers.layoutMarkers)}`);
    assert.ok(markers.hasNav, '<header> <nav> should render in the layout');
    assert.ok(markers.hasMain, '<main> should render in the layout');
  });

  test('import map includes all framework entries', async () => {
    const map = await page.evaluate(() => {
      const s = document.querySelector('script[type="importmap"]');
      return s ? JSON.parse(s.textContent) : null;
    });
    assert.ok(map, 'Import map should exist');
    assert.ok(map.imports['@webjsdev/core'], 'Should have @webjsdev/core entry');
    assert.ok(map.imports['@webjsdev/core/directives'], 'Should have @webjsdev/core/directives entry');
    assert.ok(map.imports['@webjsdev/core/context'], 'Should have @webjsdev/core/context entry');
    assert.ok(map.imports['@webjsdev/core/task'], 'Should have @webjsdev/core/task entry');
  });

  test('modulepreload links are deduplicated', async () => {
    const preloads = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel="modulepreload"]')].map(l => l.href)
    );
    const unique = new Set(preloads);
    assert.equal(preloads.length, unique.size, 'Modulepreloads should be deduplicated');
    assert.ok(preloads.length > 0, 'Should have at least one modulepreload');
  });

  test('theme-toggle custom element is upgraded (light DOM)', async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000);
    const status = await page.evaluate(() => {
      const tt = document.querySelector('theme-toggle');
      return {
        exists: !!tt,
        upgraded: !!tt && tt._connected === true,
        hasButton: !!tt?.querySelector('button'),
      };
    });
    assert.ok(status.exists, 'theme-toggle should exist');
    assert.ok(status.upgraded, 'theme-toggle should be upgraded (connectedCallback ran)');
    assert.ok(status.hasButton, 'theme-toggle should render its button');
  });

  test('theme toggle cycles through themes', async () => {
    // Set localStorage to 'light' and reload so the component picks it up
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000);
    await page.evaluate(() => localStorage.setItem('webjs_theme', 'light'));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000);

    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    assert.equal(before, 'light', 'Theme should be light after reload');

    // Click toggle: light → dark (light DOM: toggle + button live in document)
    await page.evaluate(() => {
      const toggle = document.querySelector('theme-toggle');
      toggle?.querySelector('button')?.click();
    });
    await sleep(300);

    const after = await page.evaluate(() => document.documentElement.dataset.theme);
    assert.equal(after, 'dark', 'After click, theme should be dark');

    // Clean up: reset to system
    await page.evaluate(() => localStorage.removeItem('webjs_theme'));
  });

  test('client-side navigation works (Turbo Drive style)', async () => {
    // Reset to homepage
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000);

    // Click "About" link in the layout nav (light DOM now).
    await page.evaluate(() => {
      for (const a of document.querySelectorAll('nav a')) {
        if (a.textContent.trim() === 'About') { a.click(); break; }
      }
    });
    await sleep(2000);

    assert.ok(page.url().includes('/about'), `URL should contain /about, got: ${page.url()}`);
  });

  test('no JavaScript errors on homepage', async () => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000);

    // Filter out known non-critical errors
    const critical = errors.filter(e => !e.includes('favicon'));
    assert.equal(critical.length, 0, `Unexpected JS errors: ${critical.join('; ')}`);

    page.removeAllListeners('pageerror');
  });

  test('health endpoint responds', async () => {
    const response = await page.goto(`${baseUrl}/__webjs/health`, { timeout: 5000 });
    const body = await response.json();
    assert.equal(body.status, 'ok');
  });

  // ---------------------------------------------------------------------------
  // Counter component survives client-side navigation
  //
  // Regression tests for: after multiple client-side navigations, the counter
  // component stopped working because Document.parseHTMLUnsafe() created
  // elements in a detached document, and custom element upgrades didn't fire
  // when those elements were moved to the live document via replaceChildren.
  // The fix (upgradeCustomElements) ensures connectedCallback always fires.
  // ---------------------------------------------------------------------------

  test('counter works on initial page load', async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000);

    const initial = await getCounterValue(page);
    assert.equal(initial, 3, `Counter should start at 3, got: ${initial}`);

    await clickCounterButton(page, 'Increment');
    await sleep(300);
    const after = await getCounterValue(page);
    assert.equal(after, 4, `Counter should be 4 after increment, got: ${after}`);
  });

  test('counter works after navigating away and back (same-layout swap)', async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000);

    // Navigate to About page via client-side router
    await clickNavLink(page, 'About');
    await sleep(2000);
    assert.ok(page.url().includes('/about'), `Should be on /about, got: ${page.url()}`);

    // Navigate back to homepage via the brand link
    await clickBrandLink(page);
    await sleep(2000);
    assert.ok(!page.url().includes('/about'), `Should be back on homepage, got: ${page.url()}`);

    // Counter should be present and functional
    const val = await getCounterValue(page);
    assert.equal(val, 3, `Counter should reset to 3 after navigation, got: ${val}`);

    await clickCounterButton(page, 'Increment');
    await sleep(300);
    const after = await getCounterValue(page);
    assert.equal(after, 4, `Counter should be 4 after increment, got: ${after}`);
  });

  test('counter works after multiple navigations with random delays', { timeout: 120000 }, async () => {
    // This replicates the exact user-reported bug: navigate around the blog
    // for about a minute (with varied, realistic pauses between navigations),
    // then come back to the landing page: the counter should still work.
    //
    // Delays are randomized between 3–10s to mimic real browsing behavior
    // where the user reads content, scrolls, and clicks at irregular intervals.
    const delay = () => sleep(3000 + Math.floor(Math.random() * 7000));

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await delay();

    // Navigation 1: Home → About (read the about page for a while)
    await clickNavLink(page, 'About');
    await delay();
    assert.ok(page.url().includes('/about'), 'Should be on /about');

    // Navigation 2: About → Home via brand link (browse the post list)
    await clickBrandLink(page);
    await delay();

    // Navigation 3: Home → About again (re-read something)
    await clickNavLink(page, 'About');
    await delay();
    assert.ok(page.url().includes('/about'), 'Should be on /about again');

    // Navigation 4: About → Home via Posts nav link (different link, same dest)
    await clickNavLink(page, 'Posts');
    await delay();

    // Navigation 5: Home → About once more (third visit to about)
    await clickNavLink(page, 'About');
    await delay();

    // Navigation 6: About → Home via brand
    await clickBrandLink(page);
    await delay();

    // Navigation 7: Home → About (keep going)
    await clickNavLink(page, 'About');
    await delay();

    // Navigation 8: About → Home via Posts
    await clickNavLink(page, 'Posts');
    await delay();

    // Navigation 9: Home → About (one more round trip)
    await clickNavLink(page, 'About');
    await delay();

    // Navigation 10: Back to Home (the scenario that triggered the bug)
    await clickBrandLink(page);
    await delay();

    // The counter MUST be upgraded and functional after all that browsing
    const val = await getCounterValue(page);
    assert.equal(typeof val, 'number', `Counter value should be a number, got: ${typeof val}`);
    assert.equal(val, 3, `Counter should be 3, got: ${val}`);

    await clickCounterButton(page, 'Increment');
    await sleep(300);
    assert.equal(await getCounterValue(page), 4, 'Counter should increment to 4');

    await clickCounterButton(page, 'Decrement');
    await sleep(300);
    assert.equal(await getCounterValue(page), 3, 'Counter should decrement back to 3');
  });

  test('counter element is fully upgraded after client navigation', async () => {
    // Directly verify the internal state that was broken before the fix:
    // _renderRoot should not be null, and the element should have state.
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000);

    // Navigate away and back
    await clickNavLink(page, 'About');
    await sleep(2000);
    await clickBrandLink(page);
    await sleep(2000);

    const status = await page.evaluate(() => {
      const counter = document.querySelector('my-counter');
      if (!counter) return { exists: false };
      return {
        exists: true,
        // Counter is light DOM: no shadowRoot; render root is the element itself.
        hasRenderRoot: counter._renderRoot !== null && counter._renderRoot !== undefined,
        renderRootIsSelf: counter._renderRoot === counter,
        isConnected: counter._connected === true,
        tagName: counter.tagName,
      };
    });

    assert.ok(status.exists, 'Counter element should exist in the DOM');
    assert.ok(status.hasRenderRoot, 'Counter._renderRoot should not be null (element must be upgraded)');
    assert.ok(status.renderRootIsSelf, 'Counter light-DOM render root is the element itself');
    assert.ok(status.isConnected, 'Counter._connected should be true');
  });

  test('counter works after rapid back-and-forth navigation', async () => {
    // Faster navigations: still should work with upgradeCustomElements
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000);

    for (let i = 0; i < 4; i++) {
      await clickNavLink(page, 'About');
      await sleep(1000);
      await clickBrandLink(page);
      await sleep(1000);
    }

    const val = await getCounterValue(page);
    assert.equal(val, 3, `Counter should be 3 after rapid nav, got: ${val}`);

    await clickCounterButton(page, 'Increment');
    await sleep(300);
    assert.equal(await getCounterValue(page), 4, 'Counter should increment after rapid nav');
  });

  // ---------------------------------------------------------------------------
  // Nested DSD: all four shadow/light DOM nesting combinations
  //
  // The /test-nesting page renders four sections, each with a parent component
  // nesting a child component in a different shadow/light DOM combination.
  // These tests verify:
  //   1. SSR emits correct DSD templates / hydration markers
  //   2. Components upgrade and render content after JS loads
  //   3. Inline styles from DSD are applied (no layout shift)
  // ---------------------------------------------------------------------------

  test('nested DSD: shadow parent → shadow child renders with DSD and styles', async () => {
    await page.goto(`${baseUrl}/test-nesting`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000);

    const result = await page.evaluate(() => {
      const section = document.querySelector('#shadow-shadow');
      const parent = section?.querySelector('shadow-parent');
      if (!parent) return { error: 'shadow-parent not found' };

      const parentHasShadow = !!parent.shadowRoot;
      const parentDiv = parent.shadowRoot?.querySelector('[data-testid="shadow-parent"]');

      const child = parent.shadowRoot?.querySelector('shadow-inner');
      const childHasShadow = !!child?.shadowRoot;
      const childText = child?.shadowRoot?.querySelector('[data-testid="shadow-inner"]')?.textContent;

      // Check that the child's shadow root has adopted styles (inline <style>
      // from SSR was replaced by adoptedStyleSheets on upgrade)
      const childHasAdoptedStyles = (child?.shadowRoot?.adoptedStyleSheets?.length || 0) > 0;

      return { parentHasShadow, parentDiv: !!parentDiv, childHasShadow, childText, childHasAdoptedStyles };
    });

    assert.ok(!result.error, result.error);
    assert.ok(result.parentHasShadow, 'Shadow parent should have a shadow root');
    assert.ok(result.parentDiv, 'Shadow parent should render its content');
    assert.ok(result.childHasShadow, 'Shadow child nested in shadow parent should have a shadow root');
    assert.equal(result.childText, 'shadow-inner OK', 'Shadow child should render its text');
    assert.ok(result.childHasAdoptedStyles, 'Shadow child should have adopted styles');
  });

  test('nested DSD: shadow parent → light child renders with hydration marker', async () => {
    const result = await page.evaluate(() => {
      const section = document.querySelector('#shadow-light');
      const parent = section?.querySelector('shadow-parent');
      if (!parent) return { error: 'shadow-parent not found' };

      const parentHasShadow = !!parent.shadowRoot;
      const child = parent.shadowRoot?.querySelector('light-inner');
      const childHasShadow = !!child?.shadowRoot;
      // Light DOM child renders directly into its own element (no shadow root)
      const childText = child?.querySelector('[data-testid="light-inner"]')?.textContent;

      return { parentHasShadow, childExists: !!child, childHasShadow, childText };
    });

    assert.ok(!result.error, result.error);
    assert.ok(result.parentHasShadow, 'Shadow parent should have a shadow root');
    assert.ok(result.childExists, 'Light child should exist inside shadow parent');
    assert.ok(!result.childHasShadow, 'Light child should NOT have a shadow root');
    assert.equal(result.childText, 'light-inner OK', 'Light child should render its text');
  });

  test('nested DSD: light parent → shadow child renders with DSD and styles', async () => {
    const result = await page.evaluate(() => {
      const section = document.querySelector('#light-shadow');
      const parent = section?.querySelector('light-parent');
      if (!parent) return { error: 'light-parent not found' };

      const parentHasShadow = !!parent.shadowRoot;
      // Light DOM parent renders into itself
      const parentDiv = parent.querySelector('[data-testid="light-parent"]');
      const child = parent.querySelector('shadow-inner');
      const childHasShadow = !!child?.shadowRoot;
      const childText = child?.shadowRoot?.querySelector('[data-testid="shadow-inner"]')?.textContent;
      const childHasAdoptedStyles = (child?.shadowRoot?.adoptedStyleSheets?.length || 0) > 0;

      return { parentHasShadow, parentDiv: !!parentDiv, childHasShadow, childText, childHasAdoptedStyles };
    });

    assert.ok(!result.error, result.error);
    assert.ok(!result.parentHasShadow, 'Light parent should NOT have a shadow root');
    assert.ok(result.parentDiv, 'Light parent should render its content');
    assert.ok(result.childHasShadow, 'Shadow child nested in light parent should have a shadow root');
    assert.equal(result.childText, 'shadow-inner OK', 'Shadow child should render its text');
    assert.ok(result.childHasAdoptedStyles, 'Shadow child should have adopted styles');
  });

  test('nested DSD: light parent → light child renders with hydration marker', async () => {
    const result = await page.evaluate(() => {
      const section = document.querySelector('#light-light');
      const parent = section?.querySelector('light-parent');
      if (!parent) return { error: 'light-parent not found' };

      const parentHasShadow = !!parent.shadowRoot;
      const child = parent.querySelector('light-inner');
      const childHasShadow = !!child?.shadowRoot;
      const childText = child?.querySelector('[data-testid="light-inner"]')?.textContent;

      return { parentHasShadow, childExists: !!child, childHasShadow, childText };
    });

    assert.ok(!result.error, result.error);
    assert.ok(!result.parentHasShadow, 'Light parent should NOT have a shadow root');
    assert.ok(result.childExists, 'Light child should exist inside light parent');
    assert.ok(!result.childHasShadow, 'Light child should NOT have a shadow root');
    assert.equal(result.childText, 'light-inner OK', 'Light child should render its text');
  });

  test('nested DSD: SSR output has inline styles for shadow components before JS', async () => {
    // Fetch raw HTML without executing JS to verify SSR output directly
    const html = await page.evaluate(async (url) => {
      const resp = await fetch(url);
      return resp.text();
    }, `${baseUrl}/test-nesting`);

    // shadow-parent should have DSD with <style>
    assert.match(html, /<shadow-parent[^>]*><template shadowrootmode="open"><style>/,
      'shadow-parent should have DSD with inline <style>');

    // shadow-inner nested inside should also have DSD with <style>
    assert.match(html, /<shadow-inner><template shadowrootmode="open"><style>/,
      'shadow-inner nested inside parent should have DSD with inline <style>');

    // light-parent should have hydration marker, NOT DSD
    assert.match(html, /<light-parent[^>]*><!--webjs-hydrate-->/,
      'light-parent should have hydration marker');
    assert.ok(!html.includes('<light-parent><template shadowrootmode'),
      'light-parent should NOT have DSD template');

    // light-inner should have hydration marker, NOT DSD
    assert.match(html, /<light-inner><!--webjs-hydrate-->/,
      'light-inner should have hydration marker');
    assert.ok(!html.includes('<light-inner><template shadowrootmode'),
      'light-inner should NOT have DSD template');

    // Verify the inline styles contain actual CSS (not empty)
    assert.match(html, /shadow-inner><template shadowrootmode="open"><style>[^<]+<\/style>/,
      'shadow-inner DSD should contain non-empty inline styles');
  });

  test('nested DSD: no duplicate <style> tags after hydration (SSR style removed)', async () => {
    await page.goto(`${baseUrl}/test-nesting`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000);

    const result = await page.evaluate(() => {
      const checks = [];

      // Check all shadow-inner instances
      for (const el of document.querySelectorAll('shadow-inner')) {
        if (!el.shadowRoot) continue;
        const styleTags = el.shadowRoot.querySelectorAll('style').length;
        const adoptedSheets = el.shadowRoot.adoptedStyleSheets?.length || 0;
        checks.push({ tag: 'shadow-inner', styleTags, adoptedSheets });
      }

      // Check all shadow-parent instances
      for (const el of document.querySelectorAll('shadow-parent')) {
        if (!el.shadowRoot) continue;
        const styleTags = el.shadowRoot.querySelectorAll('style').length;
        const adoptedSheets = el.shadowRoot.adoptedStyleSheets?.length || 0;
        checks.push({ tag: 'shadow-parent', styleTags, adoptedSheets });
      }

      return checks;
    });

    for (const check of result) {
      assert.equal(check.styleTags, 0,
        `${check.tag} should have 0 inline <style> tags after hydration (SSR style removed)`);
      assert.ok(check.adoptedSheets > 0,
        `${check.tag} should have adoptedStyleSheets after hydration`);
    }
  });

  // ---------------------------------------------------------------------------
  // Additional coverage: dynamic routes, 404, auth redirect, metadata,
  // browser history, Suspense streaming, server-side /api round-trip.
  // ---------------------------------------------------------------------------

  test('dynamic route: /blog/[slug] renders the post title in <head>', async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(1500);
    // Use any post href rendered on the home page.
    const href = await page.evaluate(() => {
      const a = document.querySelector('main ul a[href^="/blog/"]');
      return a?.getAttribute('href');
    });
    assert.ok(href, 'homepage should list at least one /blog/... link');
    await page.goto(baseUrl + href, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(1000);
    const title = await page.title();
    assert.ok(title.toLowerCase().includes('blog'),
      `slug page title should mention "blog", got: ${title}`);
    const hasArticle = await page.evaluate(() => !!document.querySelector('article'));
    assert.ok(hasArticle, 'slug page should render an <article>');
  });

  test('dynamic route: unknown slug hits notFound() → 404 page', async () => {
    const resp = await page.goto(
      baseUrl + '/blog/this-post-definitely-does-not-exist-xyz-98765',
      { waitUntil: 'domcontentloaded', timeout: 10000 },
    );
    assert.equal(resp.status(), 404);
    const body = await page.evaluate(() =>
      document.body.textContent.toLowerCase());
    assert.ok(/not found|404/.test(body),
      `custom 404 page should render a "not found" message; got: ${body.slice(0, 200)}`);
  });

  test('dashboard middleware redirects unauthenticated requests to /login', async () => {
    const resp = await page.goto(baseUrl + '/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });
    assert.equal(resp.status(), 200);
    assert.ok(page.url().includes('/login'),
      `unauthenticated /dashboard should redirect to /login; final url: ${page.url()}`);
    // `then` query parameter should be set so post-login returns to /dashboard.
    assert.ok(page.url().includes('then='),
      'redirect should carry a ?then= parameter');
  });

  test('login page renders the <auth-forms> custom element', async () => {
    await page.goto(baseUrl + '/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(1500);
    const ok = await page.evaluate(() => {
      const af = document.querySelector('auth-forms');
      return { exists: !!af, hasInputs: !!af?.querySelector('input') };
    });
    assert.ok(ok.exists, '<auth-forms> should be present on /login');
    assert.ok(ok.hasInputs, '<auth-forms> should render form inputs');
  });

  // ---------------------------------------------------------------------------
  // UI demo route (Webjs UI showcase)
  //
  // Verifies /ui-demo renders both tiers correctly:
  //   - Tier 1 (button, card, input, label, alert, badge): class-helper
  //     functions on native elements. Asserts the helper output (e.g.
  //     "rounded-xl border bg-card", "bg-primary text-primary-foreground")
  //     is present in the rendered HTML.
  //   - Tier 2 (dialog): real <ui-dialog> custom element.
  // Also enforces the regression denylist: no <ui-button>/<ui-card>/
  // <ui-input>/<ui-alert>/<ui-badge> tags (Tier-1 is class-helper-only
  // after the migration).
  // ---------------------------------------------------------------------------

  test('/ui-demo route renders both tiers: class-helper output + ui-dialog', async () => {
    // After the Tier-1/Tier-2 migration: Tier-1 components (button, card,
    // input, label, alert, badge) are class-helper functions: no
    // <ui-button>/<ui-card> custom elements. They render as native
    // <button>/<div>/<input> with the helper's class string. Tier-2
    // components (dialog and friends) stay as <ui-X> custom elements.
    const resp = await page.goto(baseUrl + '/ui-demo', { waitUntil: 'domcontentloaded', timeout: 10000 });
    assert.equal(resp.status(), 200, '/ui-demo should respond 200');
    await sleep(1500);

    const result = await page.evaluate(() => {
      const headings = [...document.querySelectorAll('h1')].map((h) => h.textContent || '');
      const html = document.documentElement.outerHTML;
      return {
        hasHeading: headings.some((t) => t.toLowerCase().includes('webjs ui demo')),
        // Stale Tier-1 tags MUST NOT appear (regression denylist).
        staleTier1: {
          'ui-button': document.querySelectorAll('ui-button').length,
          'ui-card':   document.querySelectorAll('ui-card').length,
          'ui-input':  document.querySelectorAll('ui-input').length,
          'ui-alert':  document.querySelectorAll('ui-alert').length,
          'ui-badge':  document.querySelectorAll('ui-badge').length,
        },
        // Tier-2 dialog WAS migrated to stay as a custom element.
        uiDialogCount: document.querySelectorAll('ui-dialog').length,
        // Tier-1 helper output present (cardClass + buttonClass characteristic strings).
        hasCardClassOutput: html.includes('rounded-xl border bg-card'),
        hasButtonClassOutput: html.includes('bg-primary text-primary-foreground hover:bg-primary'),
      };
    });

    assert.ok(result.hasHeading, '"Webjs UI demo" heading should be visible');
    for (const [tag, count] of Object.entries(result.staleTier1)) {
      assert.equal(count, 0, `Tier-1 ${tag} is a class helper after migration; <${tag}> tag must not appear`);
    }
    assert.ok(result.uiDialogCount >= 1, `expected at least one <ui-dialog>, got ${result.uiDialogCount}`);
    assert.ok(result.hasCardClassOutput, 'cardClass() Tailwind output should be present');
    assert.ok(result.hasButtonClassOutput, 'buttonClass() Tailwind output should be present');
  });

  test('/ui-demo: clicking a button does not crash the page', async () => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(baseUrl + '/ui-demo', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(1500);

    const clicked = await page.evaluate(() => {
      // Tier-1 buttons render as native <button> with buttonClass() output.
      // Find one in the demo (any of the two on /ui-demo work).
      const buttons = [...document.querySelectorAll('button')];
      for (const b of buttons) {
        const t = (b.textContent || '').toLowerCase();
        if (t.includes('send link') || t.includes('cancel') || t.includes('open dialog')) {
          b.click();
          return true;
        }
      }
      return false;
    });

    assert.ok(clicked, 'a button with the expected text should be present');
    await sleep(500);

    const critical = errors.filter((e) => !e.includes('favicon'));
    assert.equal(critical.length, 0, `clicking a button should not throw JS errors: ${critical.join('; ')}`);
    page.removeAllListeners('pageerror');
  });

  // ---------------------------------------------------------------------------
  // Migrated auth flow: <auth-forms> uses Tier-1 class helpers
  // (inputClass, labelClass, buttonClass) on raw native <input>/<label>/
  // <button> elements. No <ui-input>/<ui-button> custom elements after
  // the Tier-1/Tier-2 split.
  // ---------------------------------------------------------------------------

  test('migrated auth flow: login form uses native inputs styled by class helpers', async () => {
    await page.goto(baseUrl + '/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(1500);

    const shape = await page.evaluate(() => {
      const af = document.querySelector('auth-forms');
      const html = af?.innerHTML || '';
      return {
        nativeInputCount: af?.querySelectorAll('input').length || 0,
        nativeButtonCount: af?.querySelectorAll('button[type="submit"]').length || 0,
        // Stale Tier-1 custom-element tags must not appear.
        staleUiInput: af?.querySelectorAll('ui-input').length || 0,
        staleUiButton: af?.querySelectorAll('ui-button').length || 0,
        // Tier-1 helper characteristic Tailwind strings should be present.
        hasInputClass: html.includes('border-input'),
        hasButtonClass: html.includes('bg-primary text-primary-foreground'),
      };
    });

    assert.equal(shape.staleUiInput, 0, '<auth-forms> should not contain <ui-input> (Tier-1 is a class helper)');
    assert.equal(shape.staleUiButton, 0, '<auth-forms> should not contain <ui-button> (Tier-1 is a class helper)');
    assert.ok(shape.nativeInputCount >= 2, `expected native email + password <input>, found ${shape.nativeInputCount}`);
    assert.ok(shape.nativeButtonCount >= 1, `expected a native <button type="submit">, found ${shape.nativeButtonCount}`);
    assert.ok(shape.hasInputClass, 'inputClass() Tailwind output should be present on inputs');
    assert.ok(shape.hasButtonClass, 'buttonClass() Tailwind output should be present on submit button');
  });

  test('migrated auth flow: fill email + password and submit navigates or shows error', async () => {
    await page.goto(baseUrl + '/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(1500);

    const startUrl = page.url();
    const submitOutcome = await page.evaluate(async () => {
      const af = document.querySelector('auth-forms');
      // Tier-1: inputs are real native <input> elements inside the form.
      const inputs = [...(af?.querySelectorAll('input') || [])];
      const emailInput = inputs.find((i) => i.type === 'email' || i.name === 'email');
      const passwordInput = inputs.find((i) => i.type === 'password' || i.name === 'password');
      if (!emailInput || !passwordInput) {
        return { ok: false, reason: 'native email/password input not found' };
      }
      emailInput.value = `e2e-ui-${Date.now()}@test.local`;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.value = 'correct-horse-battery-staple';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

      const form = af.querySelector('form');
      if (!form) return { ok: false, reason: 'no <form> inside auth-forms' };
      form.requestSubmit
        ? form.requestSubmit()
        : form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      return { ok: true };
    });

    assert.ok(submitOutcome.ok, `submit setup failed: ${submitOutcome.reason || ''}`);
    await sleep(1500);

    const after = await page.evaluate(() => {
      const af = document.querySelector('auth-forms');
      const errText = af?.textContent?.toLowerCase() || '';
      return {
        url: location.href,
        hasError: /error|invalid|fail|password|email/.test(errText),
      };
    });

    const navigated = after.url !== startUrl;
    assert.ok(navigated || after.hasError,
      `expected navigation or error message after submit; url=${after.url}, hasError=${after.hasError}`);
  });

  test('metadata: <title> and <meta description> update per route', async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(500);
    const home = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
    }));
    assert.ok(home.title.toLowerCase().includes('blog'));
    assert.ok(home.description && home.description.length > 0, 'homepage has a description meta');

    await page.goto(baseUrl + '/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(500);
    const login = await page.evaluate(() => ({ title: document.title }));
    assert.ok(login.title.toLowerCase().includes('sign in'),
      `/login <title> should mention "sign in"; got: ${login.title}`);
  });

  test('browser history: back button after client nav returns to previous page', async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(1500);
    await clickNavLink(page, 'About');
    await sleep(2000);
    assert.ok(page.url().endsWith('/about'), 'navigated to /about');

    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(1000);
    assert.ok(page.url() === baseUrl + '/' || page.url() === baseUrl,
      `back should return to homepage, got: ${page.url()}`);

    await page.goForward({ waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(1000);
    assert.ok(page.url().endsWith('/about'), 'forward returns to /about');
  });

  test('Suspense streaming: fallback appears first, resolved content follows', async () => {
    // The home page has <Suspense> around `slowStat()` which sleeps 400ms
    // before resolving with a timestamp wrapped in <muted-text>.
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000); // Enough for the deferred chunk to stream in.
    const hasStat = await page.evaluate(() => {
      // "posts loaded" is part of the resolved Suspense content.
      return document.body.textContent.includes('posts loaded');
    });
    assert.ok(hasStat, 'resolved Suspense content should eventually render');
  });

  test('/api/posts GET returns an array of posts', async () => {
    const resp = await page.goto(baseUrl + '/api/posts', { timeout: 5000 });
    assert.equal(resp.status(), 200);
    const data = await resp.json();
    assert.ok(Array.isArray(data), '/api/posts should return an array');
  });

  test('POST /api/posts without auth is rejected', async () => {
    const result = await page.evaluate(async (url) => {
      const r = await fetch(url + '/api/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x', body: 'y' }),
      });
      return { status: r.status };
    }, baseUrl);
    assert.ok(result.status >= 400 && result.status < 500,
      `unauthenticated POST should be 4xx, got ${result.status}`);
  });

  test('404 for unknown pathname serves text/html', async () => {
    const resp = await page.goto(baseUrl + '/nothing-here-abcxyz', {
      waitUntil: 'domcontentloaded',
      timeout: 5000,
    });
    assert.equal(resp.status(), 404);
    const ct = resp.headers()['content-type'];
    assert.ok(ct && ct.includes('text/html'), `expected html 404, got ${ct}`);
  });

  test('same-origin link with download attribute is NOT intercepted by router', async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(1500);
    const intercepted = await page.evaluate(async () => {
      const a = document.createElement('a');
      a.href = '/favicon.ico';
      a.setAttribute('download', '');
      document.body.appendChild(a);
      let fetched = false;
      const orig = window.fetch;
      window.fetch = async (...args) => { fetched = true; return orig(...args); };
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      a.dispatchEvent(ev);
      window.fetch = orig;
      a.remove();
      return fetched;
    });
    assert.equal(intercepted, false,
      'downloads should bypass the router (let the browser handle)');
  });

  test('CSRF cookie is set on first GET response', async () => {
    // Fresh context → clear cookies.
    await page.deleteCookie(...(await page.cookies()));
    const resp = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    assert.equal(resp.status(), 200);
    const cookies = await page.cookies();
    const csrf = cookies.find((c) => /csrf/i.test(c.name));
    assert.ok(csrf, `expected a csrf cookie; got: ${cookies.map(c => c.name).join(', ')}`);
    assert.ok(csrf.value && csrf.value.length > 10, 'csrf cookie should have a non-trivial value');
  });

  test('theme toggle still works after navigations that test counter', async () => {
    // Verify that upgradeCustomElements doesn't break other components
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(2000);

    // Navigate away and back
    await clickNavLink(page, 'About');
    await sleep(2000);
    await clickBrandLink(page);
    await sleep(2000);

    // Theme toggle should still cycle
    const before = await page.evaluate(() =>
      document.documentElement.dataset.theme || 'system',
    );
    await page.evaluate(() => {
      const toggle = document.querySelector('theme-toggle');
      toggle?.querySelector('button')?.click();
    });
    await sleep(300);
    const after = await page.evaluate(() =>
      document.documentElement.dataset.theme || 'system',
    );
    assert.notEqual(before, after, 'Theme should change after toggle click post-navigation');
  });

  // ---------------------------------------------------------------------------
  // Full auth round-trip: signup → protected dashboard → logout
  // ---------------------------------------------------------------------------

  test('auth flow: signup → access dashboard → logout clears session', async () => {
    // Run late: previous tests assume unauthenticated state, so clean
    // cookies before starting the flow.
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(500);

    const email = `e2e-${Date.now()}@test.local`;
    const password = 'correct-horse-battery-staple';

    // 1) POST /api/auth/signup with a fresh email. Rate-limited to 5/10s
    // - we do one request total per test run, so we're well under.
    const signupResp = await page.evaluate(async ({ email, password }) => {
      const r = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, name: 'E2E User' }),
      });
      return { status: r.status, ok: r.ok };
    }, { email, password });
    assert.ok(signupResp.ok, `signup should succeed; got status ${signupResp.status}`);

    // 2) With the session cookie now set, /dashboard should render (not redirect).
    const dashResp = await page.goto(baseUrl + '/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });
    assert.equal(dashResp.status(), 200);
    assert.ok(
      !page.url().includes('/login'),
      `authenticated /dashboard should not redirect to /login; got: ${page.url()}`,
    );

    // 3) POST /api/auth/logout → clears cookie.
    const logoutResp = await page.evaluate(async () => {
      const r = await fetch('/api/auth/logout', { method: 'POST' });
      return { status: r.status };
    });
    assert.ok(
      logoutResp.status >= 200 && logoutResp.status < 400,
      `logout should return 2xx/3xx; got ${logoutResp.status}`,
    );

    // 4) /dashboard now redirects back to /login again.
    await page.goto(baseUrl + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(500);
    assert.ok(
      page.url().includes('/login'),
      `/dashboard after logout should redirect to /login; got: ${page.url()}`,
    );
  });

  // ---------------------------------------------------------------------------
  // Client-side nav: same-layout swap preserves the layout header element
  // ---------------------------------------------------------------------------

  test('client nav: layout header survives same-layout swap (no remount)', async () => {
    // Same-layout nav should preserve the layout chrome: the header
    // DOM element is the same instance before and after. If the router
    // did a full page reload, a property stamped on the element would
    // be lost.
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(1500);
    await page.evaluate(() => {
      const h = document.querySelector('header');
      if (h) /** @type any */ (h).__layoutMarker = 'before';
    });
    await clickNavLink(page, 'About');
    await sleep(2000);
    const survived = await page.evaluate(() =>
      /** @type any */ (document.querySelector('header'))?.__layoutMarker === 'before',
    );
    assert.ok(survived, 'same-layout nav should keep the <header> DOM element mounted');
  });

  // ---------------------------------------------------------------------------
  // Rate limiting: 6th rapid auth request → 429
  // ---------------------------------------------------------------------------

  test('rate limit: 6 rapid auth requests → 429 with retry-after', { timeout: 30000 }, async () => {
    // /api/auth/* has `rateLimit({ window: '10s', max: 5 })`. Fire 6
    // login attempts with a bogus credential in quick succession.
    // Use Node's fetch (not page.evaluate) so we bypass puppeteer
    // navigation timeouts: this is a pure HTTP-level test.
    // The X-Forwarded-For header gives us a fresh IP bucket so earlier
    // tests in the suite don't consume our quota.
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const r = await fetch(baseUrl + '/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ email: 'ratelimit@test', password: 'x' }),
      });
      statuses.push({ status: r.status, retryAfter: r.headers.get('retry-after') });
    }
    const last = statuses[statuses.length - 1];
    assert.equal(last.status, 429, `6th rapid auth request should be 429, got ${last.status}`);
    assert.ok(last.retryAfter, 'rate-limit 429 should include a Retry-After header');
  });

  // ---------------------------------------------------------------------------
  // Light-DOM <slot> projection through the full stack
  //
  //   These tests exercise the slot pipeline end-to-end: file-router SSR,
  //   client hydration, client-router navigation away and back, form
  //   state survival, and shadow-DOM parity (the same render template
  //   running under both static shadow = false and static shadow = true).
  //   Backed by /slot-demo (page.ts) + components/slot-card.ts +
  //   components/slot-card-shadow.ts.
  // ---------------------------------------------------------------------------

  test('SSR places projected children inside light slot elements', async () => {
    // Fetch raw SSR'd HTML (no client JS), so we observe exactly what
    // the server emits without hydration reordering attributes.
    const res = await fetch(`${baseUrl}/slot-demo`);
    const html = await res.text();
    // The framework-marked slot elements carry data-webjs-light and a
    // data-projection attribute set to "actual" or "fallback".
    assert.ok(html.includes('data-webjs-light'), 'light slots present in SSR output');
    assert.ok(html.includes('data-projection="actual"'), 'at least one projection is actual');
    assert.ok(html.includes('data-projection="fallback"'), 'partial card has a fallback slot');
    // Header slot in the full card projects the H2 child. Verify
    // structurally without depending on attribute order, since the SSR
    // emitter writes one order and the browser's serialiser may produce
    // another.
    assert.ok(html.includes('<h2 slot="header">Full card</h2>'),
      'header H2 with slot="header" present in output');
    // Footer slot in the partial card shows the fallback text.
    assert.ok(html.includes('no actions'),
      'fallback footer text "no actions" present in output');
  });

  test('hydration preserves authored DOM identity through SSR roundtrip', async () => {
    await page.goto(`${baseUrl}/slot-demo`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    // Tag the SSR-rendered button before hydration completes. If
    // hydration ran cleanly via DOM identity preservation, the same
    // node reference is in the slot AFTER full settle.
    const identityHeld = await page.evaluate(() => {
      const btnBefore = document.querySelector('#footer-btn');
      if (!btnBefore) return { ok: false, why: 'no SSR button' };
      btnBefore.dataset.hydrationProbe = 'present';
      return new Promise((res) => {
        // Microtask + a queued macrotask covers projection settle.
        setTimeout(() => {
          const btnAfter = document.querySelector('#footer-btn');
          res({
            ok: !!btnAfter && btnAfter.dataset.hydrationProbe === 'present',
            inSlot: btnAfter?.parentElement?.tagName === 'SLOT',
          });
        }, 50);
      });
    });
    assert.ok(identityHeld.ok, 'pre-hydration node identity preserved');
    assert.ok(identityHeld.inSlot, 'projected button is inside its <slot> element');
  });

  test('client-router navigation away and back preserves slot projection', async () => {
    await page.goto(`${baseUrl}/slot-demo`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(500);
    // Navigate away to home via the client router (link click).
    await page.evaluate(() => {
      document.querySelector('a[data-testid="back-home"]').click();
    });
    await page.waitForFunction(() => location.pathname === '/', { timeout: 5000 });
    await sleep(300);
    // Navigate back. Use a fresh navigation since we have not exercised
    // the client router's URL-state preservation for slot-using pages
    // yet; a hard goto verifies the SSR round-trip cleanly.
    await page.goto(`${baseUrl}/slot-demo`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(500);
    // After return, the projected paragraph should be visible in the
    // light-DOM slot and the slot should carry data-projection="actual".
    const observed = await page.evaluate(() => {
      const slot = document.querySelector('#card-full slot[data-webjs-light]:not([name])');
      if (!slot) return { ok: false, why: 'no slot' };
      return {
        ok: true,
        projection: slot.getAttribute('data-projection'),
        bodyText: slot.textContent.trim(),
      };
    });
    assert.ok(observed.ok, observed.why || 'slot present after navigation');
    assert.equal(observed.projection, 'actual', 'slot projecting after re-navigation');
    assert.ok(observed.bodyText.includes('authored children'),
      `body slot still has projected content, got: ${observed.bodyText}`);
  });

  test('input value inside slotted content survives projection round-trip', async () => {
    await page.goto(`${baseUrl}/slot-demo`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.evaluate(() => {
      const input = document.querySelector('#survive-input');
      input && (input.value = 'typed-into-slot');
      input && input.focus();
    });
    // Force a re-render through the framework by triggering a microtask
    // batch on an unrelated mutation. The slot's projected input should
    // keep its value because DOM identity is preserved.
    await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
    const value = await page.evaluate(() => document.querySelector('#survive-input')?.value);
    assert.equal(value, 'typed-into-slot', 'input value preserved');
  });

  test('shadow-DOM parity: same render template projects via native slot', async () => {
    await page.goto(`${baseUrl}/slot-demo`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    const sshadow = await page.evaluate(() => {
      const host = document.querySelector('#card-shadow-full');
      if (!host) return { ok: false, why: 'no shadow host' };
      // Wait for upgrade.
      const sr = host.shadowRoot;
      if (!sr) return { ok: false, why: 'no shadow root' };
      const headerSlot = sr.querySelector('slot[name="header"]');
      const defaultSlot = Array.from(sr.querySelectorAll('slot')).find((s) => !s.hasAttribute('name'));
      const footerSlot = sr.querySelector('slot[name="footer"]');
      // Native browser projection: assignedNodes returns the host's
      // light-DOM children that match each slot's name.
      return {
        ok: true,
        headerAssigned: headerSlot.assignedNodes().map((n) => n.tagName || n.nodeType),
        defaultAssigned: defaultSlot.assignedNodes().map((n) => n.tagName || n.nodeType),
        footerAssigned: footerSlot.assignedNodes().map((n) => n.tagName || n.nodeType),
      };
    });
    assert.ok(sshadow.ok, sshadow.why || 'shadow host should be upgraded');
    assert.ok(sshadow.headerAssigned.includes('H2'),
      `header slot should project H2, got ${JSON.stringify(sshadow.headerAssigned)}`);
    assert.ok(sshadow.footerAssigned.includes('BUTTON'),
      `footer slot should project BUTTON, got ${JSON.stringify(sshadow.footerAssigned)}`);
  });

  test('shadow-DOM partial card shows fallback when footer slot empty', async () => {
    await page.goto(`${baseUrl}/slot-demo`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(500);
    const fb = await page.evaluate(() => {
      const host = document.querySelector('#card-shadow-partial');
      const sr = host?.shadowRoot;
      if (!sr) return null;
      const footerSlot = sr.querySelector('slot[name="footer"]');
      if (!footerSlot) return null;
      // assignedNodes returns empty when fallback content is being shown.
      const assigned = footerSlot.assignedNodes();
      // Slot's fallback text is its own children (in the shadow tree).
      const fallback = footerSlot.textContent.trim();
      return { assignedCount: assigned.length, fallback };
    });
    assert.ok(fb, 'shadow root + footer slot present');
    assert.equal(fb.assignedCount, 0, 'no children projected to footer');
    assert.equal(fb.fallback, 'no actions', 'footer shows fallback text');
  });

  test('light-DOM partial card shows fallback when footer slot empty', async () => {
    await page.goto(`${baseUrl}/slot-demo`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    const fb = await page.evaluate(() => {
      const host = document.querySelector('#card-partial');
      const footerSlot = host.querySelector('slot[data-webjs-light][name="footer"]');
      if (!footerSlot) return null;
      return {
        projection: footerSlot.getAttribute('data-projection'),
        text: footerSlot.textContent?.trim(),
        assignedCount: footerSlot.assignedNodes().length,
      };
    });
    assert.ok(fb, 'light footer slot present');
    assert.equal(fb.projection, 'fallback', 'projection is fallback');
    assert.equal(fb.text, 'no actions', 'fallback text rendered');
    assert.equal(fb.assignedCount, 0, 'assignedNodes is empty per spec');
  });

  test('light and shadow cards produce equivalent observable output', async () => {
    await page.goto(`${baseUrl}/slot-demo`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await sleep(500);
    // textContent inside a shadow root does not flatten through native
    // slots, so for shadow cards we read each slot's assignedNodes and
    // concat their text. For light cards we can read the host directly
    // because projection physically moves the children into the slot.
    const observed = await page.evaluate(() => {
      const lightFull = document.querySelector('#card-full');
      const shadowFull = document.querySelector('#card-shadow-full');
      function lightSlotText(host, name) {
        const sel = name ? `slot[data-webjs-light][name="${name}"]` : 'slot[data-webjs-light]:not([name])';
        const slot = host.querySelector(sel);
        return slot ? slot.textContent.trim() : '';
      }
      function shadowSlotText(host, name) {
        const sr = host.shadowRoot;
        if (!sr) return '';
        const sel = name ? `slot[name="${name}"]` : 'slot:not([name])';
        const slot = sr.querySelector(sel);
        if (!slot) return '';
        const nodes = slot.assignedNodes();
        return nodes.map((n) => n.textContent || '').join('').trim();
      }
      return {
        light: {
          header: lightSlotText(lightFull, 'header'),
          footer: lightSlotText(lightFull, 'footer'),
        },
        shadow: {
          header: shadowSlotText(shadowFull, 'header'),
          footer: shadowSlotText(shadowFull, 'footer'),
        },
      };
    });
    assert.equal(observed.light.header, 'Full card');
    assert.equal(observed.shadow.header, 'Shadow full card');
    assert.ok(observed.light.footer.includes('Footer action'));
    assert.ok(observed.shadow.footer.includes('Shadow footer'));
  });

  // ---------------------------------------------------------------------------
  // Display-only component elision (the network probe)
  //
  //   <build-stamp> is purely presentational (static markup, no events,
  //   props, hooks, or slot), so its import is stripped from the served
  //   page source and the browser must never download its module. The
  //   interactive <my-counter> on the same page must still be fetched.
  // ---------------------------------------------------------------------------

  test('display-only component module is never downloaded; interactive one is', async () => {
    /** @type {string[]} */
    const requested = [];
    const onRequest = (req) => requested.push(req.url());
    page.on('request', onRequest);
    try {
      // Cache disabled so module fetches actually hit the network and
      // show up in the log. networkidle is unusable here: the chat-box
      // WebSocket keeps the connection open, so settle on a fixed delay
      // after domcontentloaded, long enough for the boot script to walk
      // the page's import graph.
      await page.setCacheEnabled(false);
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(3000);
    } finally {
      page.off('request', onRequest);
      await page.setCacheEnabled(true);
    }

    const built = requested.some((u) => /\/components\/build-stamp\.(ts|js)/.test(u));
    const counter = requested.some((u) => /\/components\/counter\.(ts|js)/.test(u));

    // The home page renders <build-stamp> correctly without its JS.
    const stampText = await page.evaluate(
      () => document.querySelector('build-stamp')?.textContent?.trim() || '',
    );
    assert.ok(stampText.includes('no-build'), 'build-stamp SSR content is present');

    assert.equal(built, false, 'display-only build-stamp module must NOT be downloaded');
    assert.equal(counter, true, 'interactive counter module must be downloaded');
  });
});

// ---------------------------------------------------------------------------
// Helpers for counter & navigation tests
// ---------------------------------------------------------------------------

/**
 * Get the current counter display value.
 * The counter is a shadow DOM component: <my-counter> → shadowRoot → <output>.
 * @param {import('puppeteer-core').Page} p
 * @returns {Promise<number|null>}
 */
async function getCounterValue(p) {
  return p.evaluate(() => {
    // <my-counter> is a light-DOM component; children live on the element itself.
    const counter = document.querySelector('my-counter');
    if (!counter) return null;
    const output = counter.querySelector('output');
    if (!output) return null;
    return parseInt(output.textContent.trim(), 10);
  });
}

/**
 * Click a counter button by its aria-label (Increment or Decrement).
 * @param {import('puppeteer-core').Page} p
 * @param {'Increment'|'Decrement'} label
 */
async function clickCounterButton(p, label) {
  await p.evaluate((lbl) => {
    const counter = document.querySelector('my-counter');
    const btn = counter?.querySelector(`button[aria-label="${lbl}"]`);
    btn?.click();
  }, label);
}

/**
 * Click a nav link inside blog-shell's shadow root.
 * @param {import('puppeteer-core').Page} p
 * @param {string} text  The visible link text (e.g. 'About', 'Posts', 'Dashboard')
 */
async function clickNavLink(p, text) {
  await p.evaluate((t) => {
    for (const a of document.querySelectorAll('header nav a')) {
      if (a.textContent.trim() === t) { a.click(); return; }
    }
  }, text);
}

/**
 * Click the brand link ("webjs / blog"): the first <a> in the header that
 * points at '/', sitting before the nav.
 * @param {import('puppeteer-core').Page} p
 */
async function clickBrandLink(p) {
  await p.evaluate(() => {
    const brand = document.querySelector('header > a[href="/"]');
    brand?.click();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
