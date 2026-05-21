import { html } from '@webjsdev/core';

export const metadata = { title: 'Configuration | webjs' };

export default function Configuration() {
  return html`
    <h1>Configuration</h1>
    <p>webjs is designed to work with <strong>zero configuration</strong>. File conventions handle routing, TypeScript works out of the box, and the server is pre-configured with sensible defaults. This page documents what you <em>can</em> configure when you need to.</p>

    <h2>CLI Options</h2>
    <h3>webjs dev</h3>
    <pre>webjs dev [--port 3000]</pre>
    <ul>
      <li><code>--port</code>: dev server port (default: <code>3000</code>, or <code>PORT</code> env var)</li>
      <li>File watching via chokidar (automatic)</li>
      <li>Live reload via SSE (<code>/__webjs/events</code>)</li>
      <li>TypeScript files transformed on the fly</li>
      <li>No cache-busting needed, since module loads are busted per request</li>
    </ul>

    <h3>webjs start</h3>
    <pre>webjs start [--port 3000]</pre>
    <ul>
      <li><code>--port</code>: production server port (also honors the <code>PORT</code> env var, default 3000)</li>
      <li>Speaks plain HTTP/1.1. TLS termination + HTTP/2 to the browser is the proxy's job (PaaS edges or nginx/Caddy/Traefik)</li>
      <li>gzip/brotli compression enabled by default</li>
      <li>Static file ETag + Cache-Control headers</li>
      <li>Graceful shutdown on SIGTERM/SIGINT</li>
      <li>JSON logger (structured, one line per event)</li>
    </ul>

    <h3>webjs db</h3>
    <pre>webjs db generate     # prisma generate
webjs db migrate &lt;name&gt;  # prisma migrate dev
webjs db studio       # prisma studio</pre>

    <h2>tsconfig.json</h2>
    <p>Optional but recommended for editor + CI type-checking:</p>
    <pre>{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "checkJs": true,
    "allowJs": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true
  },
  "include": ["app/**/*", "components/**/*", "modules/**/*", "lib/**/*"],
  "exclude": ["node_modules", ".webjs"]
}</pre>
    <p>Key settings:</p>
    <ul>
      <li><code>noEmit</code>: type-check only, no compiled output (preserves no-build)</li>
      <li><code>allowImportingTsExtensions</code>: needed for explicit <code>.ts</code> in imports</li>
      <li><code>checkJs</code>: type-check <code>.js</code> files too (for mixed codebases)</li>
    </ul>

    <h2>package.json (lint rule overrides)</h2>
    <p>The only project-level webjs config that lives in <code>package.json</code> is the <code>"webjs": { "conventions": { … } }</code> block, which disables individual <code>webjs check</code> lint rules. If the block is absent, every default rule is enabled.</p>
    <pre>{
  "webjs": {
    "conventions": {
      "tests-exist": false
    }
  }
}</pre>
    <p>See <a href="/docs/conventions">Conventions &amp; AI Workflow</a> for the rule catalogue, the workflow for AI agents, and what <code>webjs check --rules</code> prints. This page does not duplicate the list; the linter's <code>RULES</code> array is the single source of truth.</p>

    <h2>Environment Variables</h2>
    <p>Use <code>process.env</code> in server-side code (pages, actions, route handlers, middleware). There's no built-in <code>.env</code> loader, so use <code>dotenv</code> or pass vars via the shell:</p>
    <pre>DATABASE_URL=postgres://... webjs start</pre>

    <h3>Server-only env vars (the default)</h3>
    <p>Any environment variable that does not start with <code>WEBJS_PUBLIC_</code> is <strong>server-only</strong>. It is never sent to the browser. <code>DATABASE_URL</code>, <code>AUTH_SECRET</code>, OAuth client secrets, third-party API keys: read them in server actions, route handlers, middleware, or page functions, and pass derived values (not the raw secret) to components.</p>

    <h3>Public env vars (WEBJS_PUBLIC_*)</h3>
    <p>Any env var whose name starts with <code>WEBJS_PUBLIC_</code> is exposed to the browser as <code>process.env.WEBJS_PUBLIC_X</code>. webjs injects an inline script in the SSR'd HTML head that sets <code>window.process.env</code> before any user code or vendor bundle runs. Components can read these directly:</p>
    <pre>// app/.env (loaded via dotenv or shell)
WEBJS_PUBLIC_API_URL=https://api.example.com
WEBJS_PUBLIC_STRIPE_KEY=pk_live_abc
SENTRY_DSN=https://x@sentry.io/y      # server-only, no prefix

// components/checkout.ts
class Checkout extends WebComponent {
  render() {
    return html\`&lt;a href=\${process.env.WEBJS_PUBLIC_API_URL + '/pay'}&gt;Pay&lt;/a&gt;\`;
  }
}</pre>
    <p>This is the no-build equivalent of Next.js's <code>NEXT_PUBLIC_</code> convention. There is no transform step. The value is a real property read on a real <code>window.process.env</code> object in the browser.</p>

    <p><strong>NODE_ENV is always defined in the browser.</strong> The shim sets <code>process.env.NODE_ENV</code> to <code>'development'</code> in <code>webjs dev</code> or <code>'production'</code> in <code>webjs start</code>. Vendor bundles that probe <code>process.env.NODE_ENV</code> (lit, react, others) read the right value with no extra config.</p>

    <p><strong>Naming and safety.</strong> The prefix is fail-closed. An env var without <code>WEBJS_PUBLIC_</code> in its name cannot accidentally reach the browser at runtime, even if a component naively writes <code>process.env.DATABASE_URL</code>. The value will read as <code>undefined</code>, the same way a typo would. There is no way to opt out of the prefix, by design.</p>

    <p><strong>The SSR-time gap, and the lint rule that closes it.</strong> A component's <code>render()</code> runs on the server during SSR. If a component reads <code>process.env.SECRET</code> there and interpolates it into the HTML output, the secret gets shipped to every browser even though the runtime shim does not expose it. To catch this at write time, <code>webjs check</code> ships a <code>no-server-env-in-components</code> rule that flags any <code>process.env.X</code> read in a component file when <code>X</code> is not <code>WEBJS_PUBLIC_*</code> and not <code>NODE_ENV</code>. The fix is always one of: rename to <code>WEBJS_PUBLIC_*</code> if the value is intended for the browser, or read it in a page function / server action / middleware and pass a derived value to the component as an attribute.</p>

    <h2>Programmatic API</h2>
    <pre>import { startServer, createRequestHandler } from '@webjsdev/server';

// Option 1: Full server
await startServer({
  appDir: process.cwd(),
  port: 3000,
  dev: false,
  compress: true,
  http2: false,
  logger: myCustomLogger, // { info, warn, error }
});

// Option 2: Embeddable handler
const app = await createRequestHandler({
  appDir: process.cwd(),
  dev: false,
  logger: myCustomLogger,
});
const resp = await app.handle(new Request('http://x/api/hello'));
</pre>

    <h2>What Can't Be Configured</h2>
    <p>Some things are intentionally fixed:</p>
    <ul>
      <li><strong>Routing conventions</strong>: <code>page.ts</code>, <code>layout.ts</code>, <code>route.ts</code>, <code>middleware.ts</code>, <code>error.ts</code>, <code>not-found.ts</code> are the file names. No aliases.</li>
      <li><strong>Light DOM by default</strong>: components render into light DOM so global CSS and Tailwind utilities apply directly. Opt into shadow DOM per component with <code>static shadow = true</code>. No global toggle.</li>
      <li><strong>CSRF on server actions</strong>: always on for <code>/__webjs/action/*</code> RPC. Can't disable.</li>
      <li><strong>Import map</strong>: auto-generated. Maps <code>@webjsdev/core</code> sub-paths to framework-served URLs and any bare npm imports your client code uses to vendor bundles.</li>
    </ul>
  `;
}
