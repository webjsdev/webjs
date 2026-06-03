import { html } from '@webjsdev/core';

export const metadata = { title: 'Deployment | webjs' };

export default function Deployment() {
  return html`
    <h1>Deployment</h1>
    <p>webjs runs as a standard Node.js server. There is no static export, no serverless adapter, no edge runtime. Deploy it anywhere you can run Node 24+ (the minimum is set by Node's built-in TypeScript type-stripping): a VPS, a container, a PaaS like Fly.io or Railway, or behind a reverse proxy on bare metal.</p>

    <h2>Dev vs Prod</h2>
    <p>webjs has two modes, controlled by the npm script (which wraps the underlying <code>webjs dev</code> / <code>webjs start</code> CLI):</p>
    <pre># Development: live reload, no compression, no caching, verbose errors
npm run dev -- --port 8080

# Production: compression, ETags, cache headers, graceful shutdown
npm run start -- --port 8080</pre>
    <p>Key differences:</p>
    <ul>
      <li><strong>Dev:</strong> Node's built-in <code>fs.watch</code> watches your source tree and triggers live reload via SSE. TypeScript files are served with <code>Cache-Control: no-cache</code>. Errors include full stack traces. No compression.</li>
      <li><strong>Prod:</strong> no file watcher, no SSE endpoint. Static files get ETags and <code>Cache-Control: public, max-age=3600</code>. Auto-vendored npm packages get <code>max-age=31536000, immutable</code>. Gzip and Brotli compression are enabled. Error responses omit stack traces.</li>
    </ul>

    <h2>No build step</h2>
    <div role="note" style="border-left:4px solid var(--accent,#3b82f6);padding:1rem 1.25rem;background:var(--bg-elev);border-radius:.25rem;margin:1.25rem 0">
      <p style="margin:0 0 .5rem;font-weight:600">Recommended for production: HTTP/2 at the edge</p>
      <p style="margin:0">webjs's per-file-ESM model rides HTTP/2 multiplex to be competitive with bundling. <strong>PaaS edges already serve HTTP/2 for free.</strong> Railway, Fly, Render, Vercel, Cloudflare Pages, and Heroku all terminate TLS + HTTP/2 at the edge and proxy plain HTTP/1.1 to your container. For bare-VM deploys, put nginx, Caddy, or Traefik in front to do the same job. The production server (<code>npm run start</code>) only speaks plain HTTP/1.1, so TLS termination is the proxy's responsibility, not the framework's.</p>
    </div>
    <p>The same <code>.js</code> / <code>.ts</code> source files that ran in <code>npm run dev</code> run in <code>npm run start</code>. There is no compile, bundle, or "prepare for production" phase. Production performance comes from HTTP/2 multiplex plus SSR-time <code>modulepreload</code> hints, not concatenation.</p>
    <p>The full mechanism (importmap, module graph, vendor bundling, 103 Early Hints, granular cache invalidation) lives in <a href="/docs/no-build">No-Build Model</a>. This page covers the deployment-side concerns.</p>

    <h2>Production Features</h2>

    <h3>Compression</h3>
    <p>In production mode, webjs automatically negotiates <code>Accept-Encoding</code> and compresses responses with Brotli (quality 4) or Gzip (level 6). Compression applies to text-based content types: HTML, JavaScript, JSON, CSS, SVG, XML. Binary assets (images, fonts) are served uncompressed.</p>

    <h3>ETags and Cache Headers</h3>
    <p>Static files are served with a SHA-1 ETag and a 1-hour <code>max-age</code>. Vendor npm packages resolve through importmap to jspm.io URLs (default) or to local <code>/__webjs/vendor/&lt;pkg&gt;@&lt;version&gt;.js</code> paths (after <code>webjs vendor pin --download</code>). Direct jspm.io URLs use jspm.io's own immutable headers; locally-served <code>--download</code> bundles use <code>max-age=31536000, immutable</code>. In dev, all files use <code>Cache-Control: no-cache</code>.</p>

    <h3>Content Security Policy (CSP) and vendor packages</h3>
    <p>The default vendor mode serves bundles from <code>https://ga.jspm.io</code> (the jspm.io CDN). If your app sets a strict <code>Content-Security-Policy</code> header with <code>script-src 'self'</code>, the browser blocks the jspm.io script and vendor imports fail to load.</p>
    <p>Two ways to handle this:</p>
    <ol>
      <li><strong>Allow jspm.io in CSP</strong>: add <code>https://ga.jspm.io</code> to your <code>script-src</code> directive. Example: <code>script-src 'self' https://ga.jspm.io</code>. Browsers fetch bundles from jspm.io's CDN. Same-origin-only consumers (compliance-locked, air-gapped) cannot use this mode.</li>
      <li><strong>Switch to <code>--download</code> mode</strong>: run <code>webjs vendor pin --download</code> at deploy-prep time and commit the resulting <code>.webjs/vendor/&lt;pkg&gt;@&lt;version&gt;.js</code> bundle files. The importmap then points at local <code>/__webjs/vendor/</code> paths served by your own origin. <code>script-src 'self'</code> alone is sufficient; no third-party allowlist needed. Suitable for compliance-locked, air-gapped, or strictest-CSP environments.</li>
    </ol>
    <p>Pick the mode that matches your security posture. The choice is per-deploy, not per-package: either everything goes through jspm.io or everything is locally vendored. Mixing modes per-package is not supported.</p>

    <h3>Secure response headers</h3>
    <p>webjs sets a baseline of standard security headers on every response, so a deployed app is not clickjackable or MIME-sniffable without any reverse-proxy configuration. The defaults are literal HTTP headers:</p>
    <ul>
      <li><code>X-Content-Type-Options: nosniff</code></li>
      <li><code>X-Frame-Options: SAMEORIGIN</code></li>
      <li><code>Referrer-Policy: strict-origin-when-cross-origin</code></li>
      <li><code>Permissions-Policy: camera=(), microphone=(), geolocation=()</code></li>
      <li><code>Strict-Transport-Security: max-age=63072000; includeSubDomains</code> in production over HTTPS only</li>
    </ul>
    <p>HSTS is gated to production AND HTTPS. webjs detects the original scheme from <code>X-Forwarded-Proto</code> (the header the trusted edge proxy forwards after terminating TLS), honoring the same proxy-trust posture as the rest of the framework, so HSTS is never set on a plain-HTTP hop or in dev. Set <code>WEBJS_NO_TRUST_PROXY=1</code> to stop trusting forwarded headers when the container is directly exposed.</p>
    <p>A default is set only when the response does not already carry that header, so anything your middleware, a <code>route.&#123;js,ts&#125;</code> handler, or <code>expose</code> sets always wins.</p>
    <h4>Per-path overrides</h4>
    <p>Declare per-path header rules in <code>package.json</code> under <code>"webjs": &#123; "headers": [...] &#125;</code>, shaped like Next's. The <code>source</code> is a path pattern matched with the native URLPattern API, so <code>:param</code> and <code>:rest*</code> tokens work:</p>
    <pre>&#123;
  "webjs": &#123;
    "headers": [
      &#123; "source": "/embed/:path*", "headers": [&#123; "key": "X-Frame-Options", "value": null &#125;] &#125;,
      &#123; "source": "/app/:path*",   "headers": [&#123; "key": "X-Frame-Options", "value": "DENY" &#125;] &#125;
    ]
  &#125;
&#125;</pre>
    <p>A rule can ADD a header, OVERRIDE a default by giving a new value, or DISABLE a default on a path with a <code>null</code> value (the first example drops <code>X-Frame-Options</code> so a public-embed route can be framed). Precedence, lowest to highest, runs secure defaults, then the <code>webjs.headers</code> path config, then app middleware (which always wins, since its headers are already on the response when webjs merges).</p>

    <h4>Content-Security-Policy (nonce, opt-in)</h4>
    <p>webjs can mint a fresh per-request CSP nonce and emit a matching <code>Content-Security-Policy</code> response header. It is OFF by default (a strict policy would break an app with third-party inline scripts/styles, so you opt in). Enable it with a <code>webjs.csp</code> key in <code>package.json</code>:</p>
    <pre>&#123;
  "webjs": &#123; "csp": true &#125;
&#125;</pre>
    <p><code>true</code> turns on a strict-by-default policy: <code>script-src 'nonce-&lt;minted&gt;' 'strict-dynamic' 'self' https:</code> plus <code>default-src 'self'</code>, <code>object-src 'none'</code>, <code>frame-ancestors 'self'</code>, and an inline-style allowance for the Tailwind runtime. On every request the framework mints a CSPRNG nonce (16 random bytes, base64), stamps it on every inline <code>&lt;script&gt;</code>, the importmap, and the <code>modulepreload</code> hints it emits (the same value <code>cspNonce()</code> returns during SSR), and sets the header carrying that exact nonce. The nonce on the header and the nonce on the scripts are one minted value, so there is no drift, and it changes every request.</p>
    <p>For a custom policy, give an object. <code>directives</code> is merged over the strict defaults (override one directive without restating the rest; a <code>null</code> value drops a default directive), and <code>reportOnly: true</code> emits <code>Content-Security-Policy-Report-Only</code> for a staged rollout:</p>
    <pre>&#123;
  "webjs": &#123;
    "csp": &#123;
      "directives": &#123; "connect-src": "'self' https://api.example.com" &#125;,
      "reportOnly": true
    &#125;
  &#125;
&#125;</pre>
    <p>The <code>__NONCE__</code> placeholder inside a directive value (e.g. in a custom <code>script-src</code>) is substituted with the minted nonce per request. A CSP header your app already set (in middleware, a <code>route.&#123;js,ts&#125;</code> handler, or the <code>webjs.headers</code> config) is never clobbered, so an explicit app policy still wins. Inside layouts/pages, read the nonce with <code>import &#123; cspNonce &#125; from '@webjsdev/core'</code> to stamp it on your own inline <code>&lt;script&gt;</code> tags; it is isomorphic (returns <code>''</code> in the browser, so the same source is safe to ship).</p>

    <h3>Request body limits &amp; server timeouts</h3>
    <p>The server hardens its request ingress by default. Every request body it reads (the action RPC endpoint, <code>route.&#123;js,ts&#125;</code> handlers via <code>readBody</code>, and the no-JS page-action form path) is size-capped: 1 MiB for JSON / RPC (<code>webjs.maxBodyBytes</code> / <code>WEBJS_MAX_BODY_BYTES</code>) and 10 MiB for form / multipart (<code>webjs.maxMultipartBytes</code> / <code>WEBJS_MAX_MULTIPART_BYTES</code>). An over-limit body responds <code>413 Payload Too Large</code> without being buffered whole, so a hostile large upload cannot exhaust memory.</p>
    <p>The HTTP server also sets node:http timeouts to defend against slowloris and hung connections: <code>requestTimeout</code> (30s, <code>webjs.requestTimeoutMs</code> / <code>WEBJS_REQUEST_TIMEOUT_MS</code>), <code>headersTimeout</code> (20s, <code>webjs.headersTimeoutMs</code> / <code>WEBJS_HEADERS_TIMEOUT_MS</code>), and <code>keepAliveTimeout</code> (5s, <code>webjs.keepAliveTimeoutMs</code> / <code>WEBJS_KEEP_ALIVE_TIMEOUT_MS</code>). Per node semantics <code>headersTimeout</code> must be under <code>requestTimeout</code> to fire; an inconsistent config is clamped automatically. A value of <code>0</code> disables any of these (e.g. when an edge proxy already enforces them).</p>

    <h3>Graceful Shutdown</h3>
    <p>On <code>SIGINT</code> or <code>SIGTERM</code>, webjs:</p>
    <ol>
      <li>Stops accepting new connections.</li>
      <li>Closes all SSE (live reload) clients.</li>
      <li>Waits for in-flight requests to drain.</li>
      <li>Exits cleanly after drain completes, or force-exits after a 10-second timeout.</li>
    </ol>
    <p>Unhandled promise rejections are logged but do not crash the process. Uncaught exceptions trigger an orderly shutdown (state may be corrupted, so continuing is unsafe).</p>

    <h3>Health and readiness probes</h3>
    <p>webjs answers two built-in probe endpoints, and the distinction matters under runtime-first boot:</p>
    <pre>GET /__webjs/health    # liveness:  always 200 once the process is listening
GET /__webjs/ready     # readiness: 503 until the instance is fully warm, then 200</pre>
    <p><code>/__webjs/health</code> is <strong>liveness</strong>. It returns <code>200 { "status": "ok" }</code> as soon as the process is accepting connections, so an orchestrator can tell the process is alive. It never waits on the analysis.</p>
    <p><code>/__webjs/ready</code> is <strong>readiness</strong>. Because boot is instant and the whole-app analysis runs lazily on the first request, <code>/ready</code> returns <code>503 { "status": "pending" }</code> until the instance is <strong>fully warm</strong>, then <code>200 { "status": "ok" }</code>. Fully warm means both the deterministic analysis and the first vendor attempt have completed, so the importmap and its build id are settled. Point your <code>readinessProbe</code> at it and the orchestrator holds traffic off an instance until then, instead of routing the first user request into the cold analysis OR into the brief window where the importmap is still resolving. A background warm-up runs automatically once the server is listening, so on a rolling deploy the prior instance keeps serving until the new one is fully warm. The first vendor attempt is bounded by the jspm fetch timeout, so a vendor-CDN hiccup does not hold readiness down indefinitely: the instance becomes ready shortly after the timeout and serves with the resolved-or-best-effort importmap, and a transient failure is re-attempted on the next request.</p>
    <p>Both responses carry <code>Cache-Control: no-store</code>. Use them for Kubernetes probes, Docker HEALTHCHECK, load-balancer health checks, or uptime monitoring.</p>
    <pre># Kubernetes deployment
livenessProbe:
  httpGet:
    path: /__webjs/health
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /__webjs/ready
    port: 8080
  initialDelaySeconds: 3
  periodSeconds: 5</pre>
    <h4>Gating readiness on dependencies (optional)</h4>
    <p>Warm-complete does not by itself prove the database or a queue is reachable: Prisma connects lazily on the first query, not at warm-up. To gate readiness on live dependency health, add a <code>readiness.&#123;js,ts&#125;</code> file at the app root that default-exports an async function. Once the analysis is warm, <code>/ready</code> runs it on every probe; returning <code>false</code> or throwing reports <code>503 { "status": "unready" }</code>, so the orchestrator holds traffic off an instance whose dependencies are down.</p>
    <pre>// readiness.ts
import { prisma } from './lib/prisma.server.ts';

export default async function ready() {
  await prisma.user.findFirst();  // throws if the database is unreachable
  return true;
}</pre>

    <h2>HTTP/2: at the edge, not in webjs</h2>
    <p>webjs delegates TLS termination and HTTP/2 negotiation to whatever sits in front of <code>npm run start</code>. The framework's HTTP server speaks plain HTTP/1.1. ALPN, certificates, and h2 framing are entirely the proxy's concern. Two reasons:</p>
    <ul>
      <li><strong>PaaS already gives you HTTP/2.</strong> Railway, Fly, Render, Vercel, Cloudflare Pages, and Heroku all terminate TLS + HTTP/2 at their edge and proxy plain HTTP/1.1 to your container. Zero framework configuration: you get HTTP/2 to the browser the moment you deploy.</li>
      <li><strong>For bare-VM, reverse proxies do it better.</strong> nginx, Caddy, and Traefik are battle-tested for TLS termination. They handle cert renewal (ACME), OCSP, ALPN, HTTP/3, and h2-to-h1 downgrade more capably than Node's <code>http2</code> module.</li>
    </ul>
    <p>Multiplexed streams and header compression (HPACK) are what make per-file ESM competitive with bundling. <a href="/docs/no-build">No-Build Model</a> explains why, and which transport features matter for the import graph.</p>
    <p><strong>Forwarding 103 Early Hints.</strong> webjs sends a <code>103 Early Hints</code> response carrying <code>Link: rel=modulepreload</code> headers before SSR begins, so the browser can start fetching JS while the server renders. Most major edges (Cloudflare, fly-proxy, Fastly) forward 103 responses to the client transparently. If yours doesn't, the page still works (the headers are just lost) but you skip the head-start. Early Hints are disabled in dev because file churn could send stale URLs.</p>

    <h2>Pluggable Logger</h2>
    <p>webjs includes a minimal logger that writes structured JSON in production and human-readable lines in development:</p>
    <pre># Dev output:
[webjs] webjs dev server ready on http://localhost:8080

# Prod output (one JSON line per event):
{"level":"info","msg":"webjs prod server ready on http://localhost:8080","time":"2026-01-15T10:30:00.000Z"}</pre>
    <p>Replace it with your own logger by passing any object with <code>info</code>, <code>warn</code>, and <code>error</code> methods to <code>createRequestHandler</code>:</p>
    <pre>import { createRequestHandler } from '@webjsdev/server';
import pino from 'pino';

const logger = pino({ level: 'info' });

const app = await createRequestHandler({
  appDir: process.cwd(),
  dev: false,
  logger: {
    info: (msg, meta) =&gt; logger.info(meta, msg),
    warn: (msg, meta) =&gt; logger.warn(meta, msg),
    error: (msg, meta) =&gt; logger.error(meta, msg),
  },
});</pre>

    <h2>Observability: access log, request id, error hook, build-info</h2>
    <p>Day-2 ops needs more than liveness probes. webjs ships four standards-native observability surfaces, all wired at the single response funnel so they apply uniformly across pages, route handlers, server actions, and assets.</p>

    <h3>Per-request access log</h3>
    <p>Every handled request emits ONE structured <code>info</code> line through the pluggable logger after the response is produced, carrying <code>method</code>, <code>path</code>, <code>status</code>, <code>durationMs</code>, and <code>requestId</code>. It never logs request bodies or secrets. In prod the default logger writes it as one JSON object per line; in dev it is a readable line.</p>
    <pre>{"level":"info","msg":"request","time":"2026-06-03T10:30:00.000Z","requestId":"4f1c…","method":"GET","path":"/dashboard","status":200,"durationMs":12.4}</pre>
    <p>The framework's own <code>/__webjs/*</code> probe and static traffic is suppressed from the access log so it does not spam. App routes (including your <code>/api/*</code>) are logged. Swap in pino / your aggregator via the pluggable logger above and these lines flow straight into it.</p>

    <h3>Request id / correlation id (X-Request-Id)</h3>
    <p>Each request gets a correlation id, minted with the native <code>crypto.randomUUID()</code>. An inbound <code>X-Request-Id</code> from a trusted upstream proxy is honored instead (so one trace id propagates across services); a missing or malformed value falls back to a minted id. The id is set on the response as <code>X-Request-Id</code>, included in the access log and the error log, and readable inside any server-side code (pages, layouts, server actions, route handlers, middleware) via <code>requestId()</code>:</p>
    <pre>import { requestId } from '@webjsdev/server';

export async function GET() {
  const id = requestId();   // same id the response's X-Request-Id carries
  return Response.json({ traceId: id });
}</pre>

    <h3>onError hook (APM / Sentry integration point)</h3>
    <p>Register an error sink to forward unhandled errors to your APM. <code>createRequestHandler({ onError })</code> (and <code>startServer({ onError })</code>) calls it whenever the request pipeline catches an unhandled error: the 500 path (a thrown route handler, middleware, or page render), or a server action that throws unexpectedly. The sink receives the original error plus a context object with the <code>request</code>, the <code>requestId</code>, and a coarse <code>phase</code> label, so you can correlate the report with the access log line.</p>
    <pre>import { createRequestHandler } from '@webjsdev/server';
import * as Sentry from '@sentry/node';

const app = await createRequestHandler({
  appDir: process.cwd(),
  onError(error, { request, requestId, phase }) {
    Sentry.captureException(error, { tags: { requestId, phase } });
  },
});</pre>
    <p><strong>The contract is best-effort.</strong> A throwing <code>onError</code> is caught and ignored so it can never crash the response, and the hook is purely additive: webjs's existing behavior (the sanitized 500, with only <code>error.message</code> in prod and never the stack) is unchanged. The hook fires BEFORE the sanitized response is sent, so the sink always sees the real error.</p>

    <h3>Build-info endpoint</h3>
    <p><code>GET /__webjs/version</code> returns JSON describing the live build, alongside the health and readiness probes. A deploy can curl it to confirm which build is serving. It carries no secrets, and it is answered before the analysis warms (like the other probes), so it responds on a cold instance.</p>
    <pre>GET /__webjs/version
{ "version": "0.8.10", "build": "&lt;importmap-hash&gt;", "node": "v24.4.0", "uptime": 38.21 }</pre>
    <p><code>version</code> is the <code>@webjsdev/server</code> framework version, <code>build</code> is the published importmap build id (the same fingerprint the client router reads from <code>data-webjs-build</code> to detect a deploy; empty until the vendor map resolves), <code>node</code> is the running Node version, and <code>uptime</code> is process uptime in seconds. The response carries <code>Cache-Control: no-store</code>.</p>

    <h2>createRequestHandler for Embedding</h2>
    <p>If you need to embed webjs inside an existing server (Express, Fastify, Bun, Deno, serverless), use <code>createRequestHandler</code> directly. It returns a <code>handle(req: Request) =&gt; Promise&lt;Response&gt;</code> function that takes a standard Web API Request and returns a standard Response:</p>
    <pre>import { createRequestHandler } from '@webjsdev/server';

const app = await createRequestHandler({
  appDir: '/path/to/your/app',
  dev: false,
});</pre>

    <h3>Express</h3>
    <pre>import express from 'express';
import { createRequestHandler } from '@webjsdev/server';

const app = await createRequestHandler({ appDir: process.cwd(), dev: false });
const server = express();

server.all('*', async (req, res) =&gt; {
  const url = new URL(req.url, \`http://\${req.headers.host}\`);
  const webReq = new Request(url, {
    method: req.method,
    headers: Object.fromEntries(
      Object.entries(req.headers)
        .filter(([, v]) =&gt; v != null)
        .map(([k, v]) =&gt; [k, Array.isArray(v) ? v.join(',') : String(v)])
    ),
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
    duplex: 'half',
  });
  const resp = await app.handle(webReq);
  res.status(resp.status);
  resp.headers.forEach((v, k) =&gt; res.setHeader(k, v));
  if (resp.body) {
    const reader = resp.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
});

server.listen(8080);</pre>

    <h3>Bun</h3>
    <pre>import { createRequestHandler } from '@webjsdev/server';

const app = await createRequestHandler({ appDir: process.cwd(), dev: false });

Bun.serve({
  port: 8080,
  fetch: (req) =&gt; app.handle(req),
});</pre>

    <h3>Deno</h3>
    <pre>import { createRequestHandler } from '@webjsdev/server';

const app = await createRequestHandler({ appDir: Deno.cwd(), dev: false });

Deno.serve({ port: 8080 }, (req) =&gt; app.handle(req));</pre>

    <h2>Environment Variables</h2>
    <p>webjs reads the following environment variables:</p>
    <ul>
      <li><strong>PORT</strong>: server port (default: 8080). Overridden by <code>--port</code> CLI flag.</li>
      <li><strong>NODE_ENV</strong>: not directly used by webjs (it uses the <code>dev</code> flag from the CLI command), but your app code and dependencies may read it.</li>
    </ul>
    <p>For app-specific environment variables, use <code>process.env</code> in server-side code (pages, server actions, middleware, API routes). These are never exposed to the client.</p>
    <pre># .env at the app root (auto-loaded at boot)
DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
SESSION_SECRET="change-me"
API_KEY="sk-..."</pre>
    <p>webjs auto-loads <code>&lt;appDir&gt;/.env</code> into <code>process.env</code> on boot via Node 24+'s built-in <code>process.loadEnvFile</code>. No <code>dotenv</code> dependency. Shell-exported values take precedence over the file, so production platforms (Railway, Fly, Render, Docker, systemd) keep injecting secrets the same way they already do. See <a href="/docs/configuration">Configuration</a> for the full precedence rules.</p>

    <h2>Docker / Containerisation</h2>
    <p>A minimal Dockerfile for a webjs app:</p>
    <pre>FROM node:23-slim

WORKDIR /app

# Install dependencies (no native build step needed, since webjs ships no bundler)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy app source as-is; the server serves it directly
COPY . .

EXPOSE 8080
HEALTHCHECK CMD curl -f http://localhost:8080/__webjs/health || exit 1

CMD ["npx", "webjs", "start"]</pre>
    <p>Tips:</p>
    <ul>
      <li><code>node:slim</code> works fine. webjs strips TypeScript via Node 24+'s built-in <code>module.stripTypeScriptTypes</code>, so no extra system packages are needed.</li>
      <li><code>npm ci --omit=dev</code> skips dev dependencies. <code>@webjsdev/server</code> is a runtime dependency. webjs is buildless end-to-end: there is no bundler or transpiler at deploy time.</li>
      <li>Set <code>HEALTHCHECK</code> to the built-in health endpoint for container orchestrators.</li>
      <li>For apps with Prisma, add <code>RUN npx prisma generate</code> before the CMD.</li>
      <li>Layer-cache deps separately: copy <code>package.json</code> + <code>package-lock.json</code> and <code>npm ci</code> before copying the rest of the source, so application edits don't bust the deps layer.</li>
    </ul>

    <h2>Reverse Proxy (nginx / Caddy), recommended for HTTP/2</h2>
    <p>For production deployments, a reverse proxy handles TLS termination, HTTP/2, static asset caching, and load balancing. webjs runs as an HTTP/1.1 upstream, and the proxy speaks HTTP/2 to clients.</p>

    <h3>nginx</h3>
    <pre>upstream webjs {
    server 127.0.0.1:8080;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # WebSocket upgrade
    location / {
        proxy_pass http://webjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}</pre>

    <h3>Caddy</h3>
    <pre>example.com {
    reverse_proxy localhost:8080
}</pre>
    <p>Caddy automatically provisions TLS certificates via Let's Encrypt and enables HTTP/2. It also handles WebSocket upgrades transparently.</p>


    <h2>Process Managers</h2>
    <p>For non-containerised deployments, use a process manager to keep webjs running:</p>
    <pre># systemd unit
[Unit]
Description=webjs app
After=network.target

[Service]
Type=simple
User=www
WorkingDirectory=/srv/my-app
ExecStart=/usr/bin/webjs start --port 8080
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=DATABASE_URL=postgresql://...

[Install]
WantedBy=multi-user.target</pre>
    <pre># Or with PM2
pm2 start "webjs start" --name my-app</pre>

    <h2>Deployment Checklist</h2>
    <ul>
      <li>Node 24+ installed (required for the built-in TypeScript type-stripping that the framework uses for both server-side imports and browser-bound <code>.ts</code> files).</li>
      <li><code>npm ci --omit=dev</code> to install only runtime dependencies.</li>
      <li>Run <code>npx prisma generate</code> if you use Prisma.</li>
      <li>No build step. Source <code>.js</code> / <code>.ts</code> files are deployed as-is. TypeScript types are stripped on first request via Node's built-in stripper (whitespace replacement, byte-exact positions, no sourcemap overhead) and cached by mtime.</li>
      <li>Set environment variables (<code>DATABASE_URL</code>, <code>SESSION_SECRET</code>, etc.).</li>
      <li>Use <code>webjs start</code> (not <code>webjs dev</code>) for production.</li>
      <li>Configure health checks against <code>/__webjs/health</code>.</li>
      <li><strong>HTTP/2 at the edge is recommended.</strong> PaaS deploys (Railway, Fly, Render, Vercel, Cloudflare Pages, Heroku) give you HTTP/2 to the browser automatically. For bare-VM deploys, front <code>npm run start</code> with nginx, Caddy, or Traefik.</li>
      <li>Set up log aggregation (webjs outputs structured JSON in production).</li>
    </ul>
  `;
}
