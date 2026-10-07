/**
 * web-test-runner config used only by `npm run test:browser:blog`
 * (via scripts/run-blog-browser-e2e.js).
 *
 * Globs ONLY the blog browser e2e tests, which need the blog dev
 * server running on :3456 first. The default `wtr` config excludes
 * these tests for that reason.
 *
 * Why the proxy middleware: the browser context runs the test page
 * from wtr's own origin (a random localhost port). Cross-origin
 * fetch to http://localhost:3456 triggers CORS preflight and the
 * blog dev server has no CORS headers. We forward `/__blog/*`
 * (same-origin from the test page's view) to localhost:3456, and
 * the test code uses that same-origin prefix.
 */
import { playwrightLauncher } from '@web/test-runner-playwright';
import { stripTypeScriptTypes } from 'node:module';

/**
 * Custom WTR plugin: strip TypeScript types via Node 24+'s built-in
 * `module.stripTypeScriptTypes`. Same shape as the one in the
 * root web-test-runner.config.js; duplicated rather than imported
 * because WTR configs load their plugins eagerly.
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

const BLOG = 'http://localhost:3456';

/** Koa-style middleware that proxies /__blog/* to the blog dev server. */
async function proxyBlog(ctx, next) {
  const m = ctx.path.match(/^\/__blog(\/.*)?$/);
  if (!m) return next();
  const target = BLOG + (m[1] || '/');
  const upstream = await fetch(target, {
    method: ctx.method,
    headers: pickHeaders(ctx.req.headers),
    body: ['GET', 'HEAD'].includes(ctx.method) ? undefined : ctx.req,
    redirect: 'manual',
  });
  ctx.status = upstream.status;
  upstream.headers.forEach((v, k) => {
    if (k === 'content-encoding' || k === 'content-length' || k === 'transfer-encoding') return;
    ctx.set(k, v);
  });
  ctx.body = Buffer.from(await upstream.arrayBuffer());
}

function pickHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h)) {
    if (k === 'host' || k === 'connection' || k === 'content-length') continue;
    out[k] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}

import { createServer as createPortProbe } from 'node:net';

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
  files: ['test/examples/blog/browser/**/*.test.js'],
  nodeResolve: true,
  plugins: [stripTypesPlugin()],
  middleware: [proxyBlog],
  browsers: [playwrightLauncher({ product: 'chromium' })],
  testFramework: {
    config: { ui: 'tdd', timeout: 30000 },
  },
};
