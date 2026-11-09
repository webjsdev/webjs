/**
 * Web Test Runner configuration for the webjs marketing website.
 *
 * Browser tests live in a `browser/` subfolder of a feature folder, the
 * same feature-first layout the framework and scaffolded apps use:
 *
 *   test/<feature>/browser/*.test.js
 *
 * Node tests (the highlight tokenizer, etc.) stay on node:test and run
 * via `webjs test` (which skips anything under `browser/`).
 *
 * Run:
 *   npm test              # node + browser (webjs test)
 *   npm run test:browser  # browser only (webjs test --browser)
 */
import { playwrightLauncher } from '@web/test-runner-playwright';
import { stripTypeScriptTypes } from 'node:module';

/**
 * Strip TypeScript types via Node's built-in `module.stripTypeScriptTypes`
 * so the browser can `import()` the app's .ts source directly, exactly the
 * way `webjs dev` serves it. No bundler, no esbuild. Mirrors the framework's
 * own root web-test-runner.config.js.
 *
 * @returns {import('@web/test-runner').TestRunnerPlugin}
 */
function stripTypesPlugin() {
  return {
    name: 'webjs-strip-types',
    resolveMimeType(context) {
      if (context.path.endsWith('.ts') || context.path.endsWith('.mts')) return 'js';
    },
    transform(context) {
      if (!context.path.endsWith('.ts') && !context.path.endsWith('.mts')) return;
      const src = typeof context.body === 'string' ? context.body : null;
      if (src == null) return;
      return { body: stripTypeScriptTypes(src) };
    },
  };
}

import { createServer as createPortProbe } from 'node:net';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));

/**
 * Serve `public/` at the url root, as the WebJs server does (Next.js parity):
 * a request for `/ui-styles/nova.css` is answered from
 * `public/ui-styles/nova.css`. The test server's own root is the app dir, so
 * without this the pages under test would 404 their stylesheets and scripts.
 * @returns {(ctx: any, next: () => Promise<unknown>) => Promise<unknown>}
 */
function publicAtRoot() {
  return (ctx, next) => {
    let p = ctx.path;
    try { p = decodeURIComponent(p); } catch { /* keep raw */ }
    if (p !== '/' && !p.includes('..')) {
      try { if (statSync(join(PUBLIC_DIR, p)).isFile()) ctx.url = '/public' + ctx.url; } catch { /* not a public file */ }
    }
    return next();
  };
}

/**
 * A kernel-assigned free port for this run's dev server (#1593).
 * web-test-runner's default is "8000, or the next free one" (portfinder), and
 * two runs started together (two agents' CI on one machine) both pick 8000,
 * after which the browsers' module requests are split across the two servers
 * and a test fails with "Failed to fetch dynamically imported module".
 * Asking the kernel for port 0 cannot collide. WTR_PORT pins one by hand.
 * @returns {Promise<number>}
 */
function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createPortProbe();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = /** @type {import('node:net').AddressInfo} */ (probe.address());
      probe.close(() => resolvePort(port));
    });
  });
}

export default {
  port: Number(process.env.WTR_PORT) || await freePort(),
  files: ['test/**/browser/**/*.test.js'],
  nodeResolve: true,
  plugins: [stripTypesPlugin()],
  middleware: [publicAtRoot()],
  // Playwright launches headless browsers with `--hide-scrollbars`, which makes
  // every scrollbar zero-width. That hides a whole class of real layout bug:
  // #1147 (the docs drawer's scroll lock shifting the fixed site header) only
  // reproduces when the scrollbar takes LAYOUT WIDTH, so under the default flag
  // the regression test would pass vacuously and prove nothing. The root
  // web-test-runner.config.js drops the flag for the same reason (#1144).
  browsers: [
    playwrightLauncher({
      product: 'chromium',
      launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
    }),
  ],
  testFramework: {
    config: { ui: 'tdd', timeout: 10000 },
  },
};
