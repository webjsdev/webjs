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
import { esbuildPlugin } from '@web/dev-server-esbuild';

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

export default {
  files: ['test/examples/blog/browser/**/*.test.js'],
  nodeResolve: true,
  plugins: [esbuildPlugin({ ts: true, target: 'es2022' })],
  middleware: [proxyBlog],
  browsers: [playwrightLauncher({ product: 'chromium' })],
  testFramework: {
    config: { ui: 'tdd', timeout: 30000 },
  },
};
