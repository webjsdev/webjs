/**
 * End-to-end test: a context provider rendered by the ROOT LAYOUT reaches a
 * consumer rendered by the PAGE, on first load, with each element imported
 * only by the route module that renders it (how an agent writes them).
 *
 * A Lit context request is a one-shot event a consumer dispatches when it
 * connects. The boot used to import the page module before its layouts, so on
 * first load the page's consumer upgraded while the layout's provider was not
 * defined yet, the request went unanswered, and the consumer silently kept no
 * value (found by an agent building an app, whose header unit switch never
 * reached the page's components). The boot now imports in nesting order,
 * outermost layout first (packages/server/src/ssr/shipped-modules.js), so the
 * provider is defined first.
 *
 * Counterfactual: put `route.file` back ahead of `...route.layouts` in
 * `shippedBootModules` and the consumer renders no value. About 5 seconds.
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/context-across-layout.test.mjs
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

function write(file, body) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}

function stageApp() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-context-layout-e2e-'));
  write(join(dir, 'package.json'), JSON.stringify({ name: 'context-layout-app', private: true, type: 'module', imports: { '#*': './*' } }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  for (const p of ['core', 'server']) symlinkSync(join(ROOT, 'packages', p), join(dir, 'node_modules/@webjsdev', p));
  write(join(dir, 'components/unit-context.ts'), `import { createContext } from '@webjsdev/core/context';
export const unitContext = createContext<string>('unit');
`);
  write(join(dir, 'components/unit-provider.ts'), `import { WebComponent, html } from '@webjsdev/core';
import { ContextProvider } from '@webjsdev/core/context';
import { unitContext } from './unit-context.ts';

class UnitProvider extends WebComponent {
  private _provider = new ContextProvider(this, { context: unitContext, initialValue: 'imperial' });
  render() { return html\`<slot></slot>\`; }
}
UnitProvider.register('unit-provider');
`);
  write(join(dir, 'components/unit-label.ts'), `import { WebComponent, html } from '@webjsdev/core';
import { ContextConsumer } from '@webjsdev/core/context';
import { unitContext } from './unit-context.ts';

class UnitLabel extends WebComponent {
  private _unit = new ContextConsumer(this, { context: unitContext, subscribe: true });
  render() { return html\`<span>unit:\${this._unit.value ?? 'none'}</span>\`; }
}
UnitLabel.register('unit-label');
`);
  write(join(dir, 'app/layout.ts'), `import { html } from '@webjsdev/core';
import '#components/unit-provider.ts';
export default function RootLayout({ children }: { children: unknown }) {
  return html\`<!doctype html><html><head><title>t</title></head><body><unit-provider>\${children}</unit-provider></body></html>\`;
}
`);
  write(join(dir, 'app/page.ts'), `import { html } from '@webjsdev/core';
import '#components/unit-label.ts';
export default function Home() { return html\`<main><unit-label></unit-label></main>\`; }
`);
  return dir;
}

describe('E2E: a layout context provider reaches a page consumer on first load', {
  skip: !process.env.WEBJS_E2E && 'set WEBJS_E2E=1 to run E2E tests',
}, () => {
  let dir, close, port, playwright;

  before(async () => {
    playwright = await import('playwright');
    dir = stageApp();
    const { startServer } = await import('@webjsdev/server');
    let server;
    ({ server, close } = await startServer({ appDir: dir, dev: false, compress: false, port: 0, logger: quiet }));
    port = server.address().port;
    for (let i = 0; i < 60; i++) {
      if ((await fetch(`http://localhost:${port}/__webjs/ready`)).status === 200) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  after(async () => {
    if (close) await close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('the boot imports the layout module before the page module', async () => {
    const html = await (await fetch(`http://localhost:${port}/`)).text();
    const provider = html.search(/import\s+["'][^"']*unit-provider\.ts/);
    const consumer = html.search(/import\s+["'][^"']*unit-label\.ts/);
    assert.ok(provider !== -1 && consumer !== -1, 'both components are in the boot');
    assert.ok(provider < consumer, 'the layout\'s provider is imported first');
  });

  test('chromium: the page consumer reads the layout provider\'s value', async (t) => {
    let browser;
    try {
      browser = await playwright.chromium.launch();
    } catch (e) {
      t.skip(`no chromium for Playwright here: ${String(e.message).split('\n')[0]}`);
      return;
    }
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message)));
      await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('unit-label')?.textContent?.includes('unit:imperial'), null, { timeout: 5000 })
        .catch(() => {});
      const text = await page.evaluate(() => document.querySelector('unit-label')?.textContent);
      assert.match(text ?? '', /unit:imperial/, `the consumer got the provider's value (errors: ${errors.join(' | ')})`);
    } finally {
      await browser.close();
    }
  });
});
