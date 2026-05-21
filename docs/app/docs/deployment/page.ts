import { html } from '@webjsdev/core';

export const metadata = { title: 'Deployment | webjs' };

export default function Deployment() {
  return html`
    <h1>Deployment</h1>
    <p>webjs runs as a standard Node.js server. There is no static export, no serverless adapter, no edge runtime. Deploy it anywhere you can run Node 24+ (the minimum is set by Node's built-in TypeScript type-stripping): a VPS, a container, a PaaS like Fly.io or Railway, or behind a reverse proxy on bare metal.</p>

    <h2>Dev vs Prod</h2>
    <p>webjs has two modes, controlled by the CLI command:</p>
    <pre># Development: live reload, no compression, no caching, verbose errors
webjs dev [--port 3000]

# Production: compression, ETags, cache headers, graceful shutdown
webjs start [--port 3000]</pre>
    <p>Key differences:</p>
    <ul>
      <li><strong>Dev:</strong> chokidar watches your source tree and triggers live reload via SSE. TypeScript files are served with <code>Cache-Control: no-cache</code>. Errors include full stack traces. No compression.</li>
      <li><strong>Prod:</strong> no file watcher, no SSE endpoint. Static files get ETags and <code>Cache-Control: public, max-age=3600</code>. Auto-vendored npm packages get <code>max-age=31536000, immutable</code>. Gzip and Brotli compression are enabled. Error responses omit stack traces.</li>
    </ul>

    <h2>No build step</h2>
    <div role="note" style="border-left:4px solid var(--accent,#3b82f6);padding:1rem 1.25rem;background:var(--bg-elev);border-radius:.25rem;margin:1.25rem 0">
      <p style="margin:0 0 .5rem;font-weight:600">Recommended for production: HTTP/2 at the edge</p>
      <p style="margin:0">webjs's per-file-ESM model rides HTTP/2 multiplex to be competitive with bundling. <strong>PaaS edges already serve HTTP/2 for free.</strong> Railway, Fly, Render, Vercel, Cloudflare Pages, Netlify, and Heroku all terminate TLS + HTTP/2 at the edge and proxy plain HTTP/1.1 to your container. For bare-VM deploys, put nginx, Caddy, or Traefik in front to do the same job. <code>webjs start</code> itself only speaks plain HTTP/1.1, so TLS termination is the proxy's responsibility, not the framework's.</p>
    </div>
    <p>The same <code>.js</code> / <code>.ts</code> source files that ran in <code>webjs dev</code> run in <code>webjs start</code>. There is no compile, bundle, or "prepare for production" phase. Production performance comes from HTTP/2 multiplex plus SSR-time <code>modulepreload</code> hints, not concatenation.</p>
    <p>The full mechanism (importmap, module graph, vendor bundling, 103 Early Hints, granular cache invalidation) lives in <a href="/docs/no-build">No-Build Model</a>. This page covers the deployment-side concerns.</p>

    <h2>Production Features</h2>

    <h3>Compression</h3>
    <p>In production mode, webjs automatically negotiates <code>Accept-Encoding</code> and compresses responses with Brotli (quality 4) or Gzip (level 6). Compression applies to text-based content types: HTML, JavaScript, JSON, CSS, SVG, XML. Binary assets (images, fonts) are served uncompressed.</p>

    <h3>ETags and Cache Headers</h3>
    <p>Static files are served with a SHA-1 ETag and a 1-hour <code>max-age</code>. Auto-vendored npm packages at <code>/__webjs/vendor/&lt;pkg&gt;.js</code> are served with <code>max-age=31536000, immutable</code> since their content is addressed by hash. In dev, all files use <code>Cache-Control: no-cache</code>.</p>

    <h3>Graceful Shutdown</h3>
    <p>On <code>SIGINT</code> or <code>SIGTERM</code>, webjs:</p>
    <ol>
      <li>Stops accepting new connections.</li>
      <li>Closes all SSE (live reload) clients.</li>
      <li>Waits for in-flight requests to drain.</li>
      <li>Exits cleanly after drain completes, or force-exits after a 10-second timeout.</li>
    </ol>
    <p>Unhandled promise rejections are logged but do not crash the process. Uncaught exceptions trigger an orderly shutdown (state may be corrupted, so continuing is unsafe).</p>

    <h3>Health Probes</h3>
    <p>webjs exposes built-in health check endpoints:</p>
    <pre>GET /__webjs/health    # { "status": "ok" }
GET /__webjs/ready     # { "status": "ok" }</pre>
    <p>Both return <code>200 OK</code> with <code>Cache-Control: no-store</code>. Use them for Kubernetes liveness and readiness probes, Docker HEALTHCHECK, load balancer health checks, or uptime monitoring.</p>
    <pre># Kubernetes deployment
livenessProbe:
  httpGet:
    path: /__webjs/health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /__webjs/ready
    port: 3000
  initialDelaySeconds: 3
  periodSeconds: 5</pre>

    <h2>HTTP/2: at the edge, not in webjs</h2>
    <p>webjs delegates TLS termination and HTTP/2 negotiation to whatever sits in front of <code>webjs start</code>. The framework's HTTP server speaks plain HTTP/1.1. ALPN, certificates, and h2 framing are entirely the proxy's concern. Two reasons:</p>
    <ul>
      <li><strong>PaaS already gives you HTTP/2.</strong> Railway, Fly, Render, Vercel, Cloudflare Pages, Netlify, and Heroku all terminate TLS + HTTP/2 at their edge and proxy plain HTTP/1.1 to your container. Zero framework configuration: you get HTTP/2 to the browser the moment you deploy.</li>
      <li><strong>For bare-VM, reverse proxies do it better.</strong> nginx, Caddy, and Traefik are battle-tested for TLS termination. They handle cert renewal (ACME), OCSP, ALPN, HTTP/3, and h2-to-h1 downgrade more capably than Node's <code>http2</code> module.</li>
    </ul>
    <p>Multiplexed streams and header compression (HPACK) are what make per-file ESM competitive with bundling. <a href="/docs/no-build">No-Build Model</a> explains why, and which transport features matter for the import graph.</p>
    <p><strong>Forwarding 103 Early Hints.</strong> webjs sends a <code>103 Early Hints</code> response carrying <code>Link: rel=modulepreload</code> headers before SSR begins, so the browser can start fetching JS while the server renders. Most major edges (Cloudflare, fly-proxy, Fastly) forward 103 responses to the client transparently. If yours doesn't, the page still works (the headers are just lost) but you skip the head-start. Early Hints are disabled in dev because file churn could send stale URLs.</p>

    <h2>Pluggable Logger</h2>
    <p>webjs includes a minimal logger that writes structured JSON in production and human-readable lines in development:</p>
    <pre># Dev output:
[webjs] webjs dev server ready on http://localhost:3000

# Prod output (one JSON line per event):
{"level":"info","msg":"webjs prod server ready on http://localhost:3000","time":"2026-01-15T10:30:00.000Z"}</pre>
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

server.listen(3000);</pre>

    <h3>Bun</h3>
    <pre>import { createRequestHandler } from '@webjsdev/server';

const app = await createRequestHandler({ appDir: process.cwd(), dev: false });

Bun.serve({
  port: 3000,
  fetch: (req) =&gt; app.handle(req),
});</pre>

    <h3>Deno</h3>
    <pre>import { createRequestHandler } from '@webjsdev/server';

const app = await createRequestHandler({ appDir: Deno.cwd(), dev: false });

Deno.serve({ port: 3000 }, (req) =&gt; app.handle(req));</pre>

    <h2>Environment Variables</h2>
    <p>webjs reads the following environment variables:</p>
    <ul>
      <li><strong>PORT</strong>: server port (default: 3000). Overridden by <code>--port</code> CLI flag.</li>
      <li><strong>NODE_ENV</strong>: not directly used by webjs (it uses the <code>dev</code> flag from the CLI command), but your app code and dependencies may read it.</li>
    </ul>
    <p>For app-specific environment variables, use <code>process.env</code> in server-side code (pages, server actions, middleware, API routes). These are never exposed to the client.</p>
    <pre># .env (load with dotenv or your deployment platform)
DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
SESSION_SECRET="change-me"
API_KEY="sk-..."</pre>
    <p>webjs does not have built-in <code>.env</code> file loading. Use <a href="https://www.npmjs.com/package/dotenv">dotenv</a>, your platform's secrets management, or pass variables via your process manager.</p>

    <h2>Docker / Containerisation</h2>
    <p>A minimal Dockerfile for a webjs app:</p>
    <pre>FROM node:23-slim

WORKDIR /app

# Install dependencies (no native build step needed, since webjs ships no bundler)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy app source as-is; the server serves it directly
COPY . .

EXPOSE 3000
HEALTHCHECK CMD curl -f http://localhost:3000/__webjs/health || exit 1

CMD ["npx", "webjs", "start"]</pre>
    <p>Tips:</p>
    <ul>
      <li><code>node:slim</code> works fine. The primary TypeScript stripper is Node 24+'s built-in <code>module.stripTypeScriptTypes</code>, so no extra system packages are needed for the common case.</li>
      <li><code>npm ci --omit=dev</code> skips dev dependencies. <code>@webjsdev/server</code> is a runtime dependency, which keeps the esbuild fallback available for the rare third-party file that uses non-erasable TypeScript syntax. See <a href="/docs/no-build">No-Build Model</a> for when the fallback kicks in.</li>
      <li>Set <code>HEALTHCHECK</code> to the built-in health endpoint for container orchestrators.</li>
      <li>For apps with Prisma, add <code>RUN npx prisma generate</code> before the CMD.</li>
      <li>Layer-cache deps separately: copy <code>package.json</code> + <code>package-lock.json</code> and <code>npm ci</code> before copying the rest of the source, so application edits don't bust the deps layer.</li>
    </ul>

    <h2>Reverse Proxy (nginx / Caddy), recommended for HTTP/2</h2>
    <p>For production deployments, a reverse proxy handles TLS termination, HTTP/2, static asset caching, and load balancing. webjs runs as an HTTP/1.1 upstream, and the proxy speaks HTTP/2 to clients.</p>

    <h3>nginx</h3>
    <pre>upstream webjs {
    server 127.0.0.1:3000;
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
    reverse_proxy localhost:3000
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
ExecStart=/usr/bin/webjs start --port 3000
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
      <li><strong>HTTP/2 at the edge is recommended.</strong> PaaS deploys (Railway, Fly, Render, Vercel, Cloudflare Pages, Netlify, Heroku) give you HTTP/2 to the browser automatically. For bare-VM deploys, front <code>webjs start</code> with nginx, Caddy, or Traefik.</li>
      <li>Set up log aggregation (webjs outputs structured JSON in production).</li>
    </ul>
  `;
}
