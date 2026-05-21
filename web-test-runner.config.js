/**
 * Web Test Runner configuration for webjs.
 *
 * Runs client-side tests (renderer, directives, components, signals,
 * slots, UI components) in real browsers via Playwright. Server-side
 * tests (router, SSR pipeline, actions, auth) stay on node:test.
 *
 * Browser tests live next to the package they cover, inside a
 * `browser/` subfolder of a feature folder:
 *
 *   packages/core/test/<feature>/browser/*.test.js
 *   packages/ui/test/<feature>/browser/*.test.js
 *
 * Cross-package browser tests live at the root:
 *
 *   test/<feature>/browser/*.test.js
 *
 * Run:
 *   npx wtr                           # all browser tests
 *   npm test                          # all node tests
 *   npm run test:all                  # everything
 */
import { playwrightLauncher } from '@web/test-runner-playwright';
import { esbuildPlugin } from '@web/dev-server-esbuild';

export default {
  files: [
    'packages/*/test/**/browser/**/*.test.js',
    'test/**/browser/**/*.test.js',
    // Blog E2E needs `examples/blog`'s dev server running on :3456 first.
    // It runs via `npm run test:browser:blog` (separate orchestrator),
    // not the default `wtr` run.
    '!test/blog/browser/**/*.test.js',
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
