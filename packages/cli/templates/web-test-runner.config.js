/**
 * Web Test Runner configuration.
 *
 * Runs browser tests (components, directives, interactions) in real
 * Chromium via Playwright. Server tests (actions, queries) use node:test.
 *
 * Tests are organised by feature. Each feature folder may have a
 * `browser/` subfolder containing real-browser tests; the glob below
 * picks them up wherever they live.
 *
 *   test/<feature>/<file>.test.ts             ← node tests
 *   test/<feature>/browser/<file>.test.js     ← this runner
 *
 * Run:
 *   webjs test              # runs both server + browser tests
 *   webjs test --browser    # browser tests only
 *   webjs test --server     # server tests only
 */
import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  files: ['test/**/browser/**/*.test.js'],
  nodeResolve: true,
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
