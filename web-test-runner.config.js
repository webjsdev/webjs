/**
 * Web Test Runner configuration for webjs.
 *
 * Runs client-side tests (renderer, directives, components) in real browsers
 * via Playwright. Server-side tests (router, SSR, actions) stay on node:test.
 *
 * Run:
 *   npx wtr                           # client + component tests
 *   npm test                          # server tests (node:test)
 *   npm run test:all                  # everything
 */
import { playwrightLauncher } from '@web/test-runner-playwright';
import { esbuildPlugin } from '@web/dev-server-esbuild';

export default {
  files: [
    'test/browser/render-client.test.js',
    'test/browser/light-dom-hydration.test.js',
    'test/browser/ui-stateful.test.js',
    'test/browser/ui-overlay.test.js',
    'test/browser/slot.test.js',
    'test/browser/component-lifecycle.test.js',
    'test/browser/directives.test.js',
    'test/browser/directives-cache_test.js',
    'test/browser/directives-async-stream_test.js',
    'test/browser/directives-ref_test.js',
    'test/browser/directives-keyed_test.js',
    'test/browser/directives-guard_test.js',
    'test/browser/directives-template-content_test.js',
    'test/browser/directives-until_test.js',
    'test/browser/controllers-port_test.js',
    'test/browser/lifecycle-port_test.js',
    'test/browser/watch-directive.test.js',
  ],
  nodeResolve: true,
  // Transform .ts → JS on the fly so browsers can `import()` the @webjskit/ui
  // component sources directly. Mirrors `webjs dev` (which registers an esbuild
  // ESM loader hook for the same purpose): esbuild is already a hard dep of
  // @webjskit/server, so this isn't adding a new toolchain.
  plugins: [esbuildPlugin({ ts: true, target: 'es2022' })],
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
  ],
  testFramework: {
    config: {
      ui: 'tdd',
      timeout: 10000,
    },
  },
};
