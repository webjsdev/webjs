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

export default {
  files: ['test/**/browser/**/*.test.js'],
  nodeResolve: true,
  plugins: [stripTypesPlugin()],
  browsers: [playwrightLauncher({ product: 'chromium' })],
  testFramework: {
    config: { ui: 'tdd', timeout: 10000 },
  },
};
