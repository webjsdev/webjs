import { html } from '@webjsdev/core';

export const metadata = { title: 'No-Build Model | webjs' };

export default function NoBuild() {
  return html`
    <h1>No-Build Model</h1>
    <p>webjs has no bundler, no <code>webjs build</code> command, no output directory. The <code>.js</code> and <code>.ts</code> files you edit are the files the browser fetches. <code>npm run dev</code> and <code>npm run start</code> run the same source. This page is the canonical reference for how it works in practice and why per-file ESM at production scale is competitive with bundling.</p>

    <p>Related reading:</p>
    <ul>
      <li><a href="/docs/typescript">TypeScript</a> covers the type stripper in detail.</li>
      <li><a href="/docs/deployment">Deployment</a> covers HTTP/2 termination, reverse proxies, and Docker.</li>
      <li><a href="/docs/architecture">Architecture</a> covers the request lifecycle at a higher level.</li>
    </ul>

    <h2>The model</h2>
    <p>webjs serves source as native ES modules over HTTP. The browser walks the import graph one file at a time, the server transforms each file lazily on first request, and an in-memory cache keyed by mtime makes subsequent requests instant. There is no concatenation, no minification, no chunk graph, no "prepare for production" phase. The Rails 7+ <a href="https://github.com/rails/importmap-rails">importmap-rails</a> + Hotwire pipeline is the closest analogue.</p>

    <table>
      <thead>
        <tr><th>Question</th><th>Answer</th></tr>
      </thead>
      <tbody>
        <tr><td>Is there a build step I run?</td><td>No. <code>npm run dev</code> and <code>npm run start</code> serve source directly.</td></tr>
        <tr><td>Is there a build step the framework runs?</td><td>Per-file type stripping for <code>.ts</code>, on first request, cached by mtime. That is the only transform.</td></tr>
        <tr><td>What about npm packages?</td><td>Auto-bundled per-package on first reference. See <strong>Bare specifiers</strong> below.</td></tr>
        <tr><td>How does the browser resolve <code>import '@webjsdev/core'</code>?</td><td>An <code>&lt;script type="importmap"&gt;</code> emitted in <code>&lt;head&gt;</code> maps the specifier to a URL.</td></tr>
        <tr><td>Won't N small files be slow?</td><td>HTTP/2 multiplex makes per-file serving competitive with bundling. SSR-time modulepreload hints make it parallel.</td></tr>
        <tr><td>What does this gain me?</td><td>What you read is what runs. Granular cache invalidation. Zero build-config files. Edit-and-refresh dev loop.</td></tr>
      </tbody>
    </table>

    <h2>Request lifecycle (per JS file)</h2>
    <ol>
      <li>Browser parses HTML, finds <code>&lt;script type="module" src="/app/page.ts"&gt;</code> (or follows an <code>import</code> from one that was already loaded).</li>
      <li>Server receives the request. Reads the file from disk.</li>
      <li>If the file is <code>.ts</code> / <code>.mts</code>, runs Node 24+'s built-in <code>module.stripTypeScriptTypes</code>. This is whitespace replacement: every <code>(line, column)</code> in the source maps to the same position in the output, so no sourcemap is needed and stack traces are byte-exact. Falls back to esbuild (rare in practice) only when the file uses non-erasable syntax (<code>enum</code>, <code>namespace</code> with values, parameter properties, legacy decorators. The scaffolded <code>tsconfig.json</code> turns on <code>erasableSyntaxOnly: true</code> by default, which rejects all of these in your own code at edit time. And almost no npm package ships <code>.ts</code> source anyway. Published packages compile to <code>.js</code> with sidecar <code>.d.ts</code> type files, which the runtime serves as plain JavaScript with no transform. The fallback realistically fires only for a monorepo-internal package that publishes raw TypeScript with non-erasable syntax, or when you explicitly opt out of the flag).</li>
      <li>Result is cached in memory keyed by <code>(absolute path, mtime)</code>. A file edit invalidates naturally.</li>
      <li>Response is served as <code>application/javascript</code> with appropriate cache headers (no-cache in dev, ETag + 1h max-age in prod).</li>
      <li>Browser executes the module, encounters its imports, repeat from step 1 for each.</li>
    </ol>

    <h2>The importmap</h2>
    <p>An <code>&lt;script type="importmap"&gt;</code> is emitted in every SSR response's <code>&lt;head&gt;</code>. It tells the browser how to resolve every bare specifier (anything that isn't a relative <code>./foo</code> or absolute <code>/bar</code>) to a real URL. webjs ships a minimal map and extends it dynamically as your app references new npm packages:</p>
    <pre>&lt;script type="importmap"&gt;
{
  "imports": {
    "@webjsdev/core":               "/__webjs/core/index.js",
    "@webjsdev/core/":              "/__webjs/core/src/",
    "@webjsdev/core/client-router": "/__webjs/core/src/router-client.js",
    "@webjsdev/core/directives":    "/__webjs/core/src/directives.js",
    "@webjsdev/core/context":       "/__webjs/core/src/context.js",
    "@webjsdev/core/task":          "/__webjs/core/src/task.js",
    "@webjsdev/core/testing":       "/__webjs/core/src/testing.js",
    "@webjsdev/core/lazy-loader":   "/__webjs/core/src/lazy-loader.js",
    "dayjs":                        "/__webjs/vendor/dayjs.js",
    "zod":                          "/__webjs/vendor/zod.js"
  }
}
&lt;/script&gt;</pre>
    <p>The browser resolves every <code>import 'dayjs'</code> through this map. You never write a build config that says "alias dayjs to its dist file". The framework owns the registry, you write idiomatic ESM.</p>

    <h2>Module graph and modulepreload hints</h2>
    <p>At server startup, webjs walks your app source and builds an in-memory graph of <code>file → Set&lt;imported files&gt;</code>. The walker parses <code>import</code> statements with a regex, resolves relative paths, and records every edge. Bare specifiers (npm deps) are not in the graph; they're handled separately.</p>
    <p>When the SSR pipeline renders a page, it computes the components on that page plus their transitive dependencies, and emits one <code>&lt;link rel="modulepreload"&gt;</code> per file:</p>
    <pre>&lt;link rel="modulepreload" href="/app/page.ts"&gt;
&lt;link rel="modulepreload" href="/components/post-card.ts"&gt;
&lt;link rel="modulepreload" href="/components/avatar.ts"&gt;
&lt;link rel="modulepreload" href="/lib/format-date.ts"&gt;</pre>
    <p>This converts a sequential <code>import</code> waterfall into a parallel fetch. The browser fires every request as soon as the HTML head is parsed, well before <code>&lt;script type="module"&gt;</code> at the bottom would have discovered them.</p>
    <p>Server-only modules (filename matches <code>.server.{js,ts}</code> or content has a <code>'use server'</code> directive) are excluded from preload hints. They never reach the browser as source. Lazy components (<code>static lazy = true</code>) are also excluded, since they load on viewport entry via IntersectionObserver, not page load.</p>

    <h2>103 Early Hints</h2>
    <p>In production, when a GET or HEAD request matches a page route, webjs sends a <code>103 Early Hints</code> response <em>before</em> SSR begins. The hints carry <code>Link: &lt;url&gt;; rel=modulepreload</code> headers for the page's modules:</p>
    <pre>HTTP/1.1 103 Early Hints
Link: &lt;/app/page.ts&gt;; rel=modulepreload
Link: &lt;/components/post-card.ts&gt;; rel=modulepreload
...

HTTP/1.1 200 OK
Content-Type: text/html
...</pre>
    <p>The browser starts fetching JS modules while the server is still rendering HTML. By the time the document parser reaches the import statements, those files are already in cache. Most major edges (Cloudflare, fly-proxy, Fastly) forward 103 responses to the client. Early Hints are disabled in dev because file churn could send stale URLs before a rebuild.</p>

    <h2>Bare specifiers (npm packages)</h2>
    <p>The browser can't resolve <code>import dayjs from 'dayjs'</code> on its own. webjs handles this with a Vite-style <code>optimizeDeps</code> step that runs at server startup and on file-watcher rebuilds:</p>
    <ol>
      <li>Scan every <code>.js</code> / <code>.ts</code> file under the app for bare import specifiers (skipping <code>node_modules</code>, <code>.server.{js,ts}</code> files, and <code>'use server'</code> modules).</li>
      <li>For each discovered package, add an importmap entry: <code>{ "dayjs": "/__webjs/vendor/dayjs.js" }</code>.</li>
      <li>On first request to <code>/__webjs/vendor/dayjs.js</code>, bundle the package with esbuild (ESM, ES2022, browser target, inlined transitive deps) and cache the result in memory.</li>
      <li>Serve with <code>Cache-Control: public, max-age=31536000, immutable</code> in production. The vendor URL acts as a content-addressed hash since dependencies don't change between deploys.</li>
    </ol>
    <p>Native modules and server-only packages (<code>node:*</code>, <code>@prisma/client</code>) fail the bundle silently and never get an importmap entry. That's the right behaviour: server packages should never reach the browser.</p>

    <h2>Why auto-bundle vendor deps in a no-build framework?</h2>
    <p>This is an architectural decision worth calling out. A stricter "browser-native ESM only" interpretation of no-build would refuse to run any bundler ever, including for npm packages, and would push importmap management onto the user. Rails 7+ with <code>importmap-rails</code> is the canonical example. Every time you install a dependency, you run <code>bin/importmap pin &lt;pkg&gt;</code>, pick a CDN provider, and hope the package's published artifact resolves cleanly in the browser. In practice you also debug mixed CJS/ESM bundles, <code>require()</code> calls in code that claims to be ESM, missing file extensions, and transitive deps that aren't ESM at all. That manual loop is a real DX tax, and it shows up the moment any team tries to scale the model.</p>
    <p>webjs makes the deliberate trade of running esbuild internally on the user's behalf. The bundler is a private implementation detail. You never invoke it, never see its config, never run it as a deploy-time step. Each vendor bundle is produced lazily on first request and cached for the process lifetime, then served with <code>immutable</code> cache headers so the browser never re-downloads it. <code>import dayjs from 'dayjs'</code> works the moment you <code>npm install dayjs</code>, with no other action required.</p>
    <p>The framework itself stays no-build in the sense that matters most. Source equals runtime for <code>@webjsdev/*</code> packages and for your own app code, no compile step before deploy, no output directory, no bundle hashes to invalidate. We use a known-good bundler at one well-defined boundary (third-party npm) so the no-build promise extends to the parts of the ecosystem that aren't ready to be served as-is.</p>

    <h2>Browser-side env vars without a build step</h2>
    <p>Next.js exposes <code>NEXT_PUBLIC_*</code> to the browser via build-time static substitution. webjs has no build step, so it can't substitute literals into source. Instead, the SSR pipeline emits an inline <code>&lt;script&gt;</code> in the document head, before the importmap and any module code:</p>
    <pre>&lt;script&gt;
  window.process = window.process || {};
  window.process.env = Object.assign(window.process.env || {}, {
    "WEBJS_PUBLIC_API_URL": "https://api.example.com",
    "NODE_ENV": "production"
  });
&lt;/script&gt;</pre>
    <p>After that runs, <code>process.env.WEBJS_PUBLIC_X</code> is a real property read on a real object in the browser. No transform, no substitution, no build step. Same source equals runtime invariant as everything else on this page.</p>
    <p>Only env vars with the <code>WEBJS_PUBLIC_</code> prefix cross the wire. Everything else stays on the server. <code>NODE_ENV</code> is also defined so vendor bundles that probe it (lit, react, etc.) run cleanly in the browser. Full user-facing docs in <a href="/docs/configuration">Configuration</a>.</p>

    <h2>Granular cache invalidation</h2>
    <p>The killer feature of the no-build model is what happens between two deploys. With a bundler, edit one component and the entire bundle's content hash changes, so every user re-downloads everything. With per-file ESM:</p>
    <ul>
      <li>The file you edited has new content. Its URL stays the same; the ETag changes.</li>
      <li>Every other file in your app is byte-identical to the previous deploy. The browser's HTTP cache validates with a 304 and serves the cached copy.</li>
      <li>npm package URLs (<code>/__webjs/vendor/&lt;pkg&gt;.js</code>) are <code>immutable</code> and never invalidate unless you upgrade the package.</li>
    </ul>
    <p>Result: a typo fix in one component re-downloads exactly one file. A dependency upgrade re-downloads exactly one vendor bundle. A full deploy that touches two components costs two file downloads, not a megabyte of cache-busted bundle.</p>

    <h2>HTTP/2 at the edge</h2>
    <p>Per-file ESM is competitive with bundling only over HTTP/2 (or HTTP/3). On HTTP/1.1 the browser limits concurrent connections per origin to six, so a hundred-file page serializes into sixteen waves. On HTTP/2 the same hundred files multiplex over one TCP connection, with header compression amortizing the per-request overhead.</p>
    <p>webjs delegates TLS termination and HTTP/2 negotiation to the proxy in front of it. <code>webjs start</code> itself speaks plain HTTP/1.1 to its upstream. The full deployment story (PaaS edges, nginx, Caddy, Traefik configs) lives in the <a href="/docs/deployment">Deployment</a> doc.</p>

    <h2>Dev vs prod</h2>
    <table>
      <thead>
        <tr><th>Aspect</th><th>Dev (<code>webjs dev</code>)</th><th>Prod (<code>webjs start</code>)</th></tr>
      </thead>
      <tbody>
        <tr><td>TS stripping</td><td>Same: <code>module.stripTypeScriptTypes</code></td><td>Same</td></tr>
        <tr><td>Mtime cache</td><td>Cleared on file change via chokidar</td><td>Persists for process lifetime</td></tr>
        <tr><td>Vendor cache</td><td>Cleared on rebuild</td><td>Persists for process lifetime</td></tr>
        <tr><td>Cache-Control</td><td><code>no-cache</code></td><td><code>max-age=3600</code> (source), <code>immutable</code> (vendor)</td></tr>
        <tr><td>103 Early Hints</td><td>Disabled (stale URL risk)</td><td>Enabled</td></tr>
        <tr><td>Compression</td><td>Off</td><td>Brotli/Gzip negotiated</td></tr>
        <tr><td>Live reload</td><td>SSE-driven full page reload</td><td>n/a</td></tr>
      </tbody>
    </table>

    <h2>When this falls down</h2>
    <p>The no-build model is well-suited to apps that fit the framework's assumptions. Concrete limitations to be aware of:</p>
    <ul>
      <li><strong>HTTP/1.1 only deploys are slow.</strong> If you can't put a reverse proxy or PaaS edge in front, per-file ESM will serialize on connection limits. Either accept the latency, deploy on PaaS, or front <code>webjs start</code> with nginx / Caddy.</li>
      <li><strong>Very large apps with deep import graphs.</strong> The modulepreload hint list grows with transitive deps. On a page that touches a hundred files, you ship a hundred preload links. Browsers handle this fine; some CDNs cap header size around 8 KB, which is a soft ceiling of roughly 80 preloads per page. The framework deduplicates against the boot script's imports to keep the list tight.</li>
      <li><strong>Non-erasable TypeScript in third-party deps.</strong> A <code>.ts</code> file in <code>node_modules</code> that uses <code>enum</code>, parameter properties, or other non-erasable syntax triggers the esbuild fallback. The fallback ships inline sourcemaps and costs roughly 3x wire bytes for that one file. Doubly rare in practice: published npm packages almost always ship compiled <code>.js</code> + <code>.d.ts</code>, not raw TypeScript, so the runtime never sees a <code>.ts</code> file from <code>node_modules</code> to begin with. The realistic trigger is a monorepo-internal workspace package that exports <code>.ts</code> source with non-erasable syntax (raw <code>.ts</code> using only erasable syntax goes through the primary stripper just fine).</li>
      <li><strong>Tree-shaking is per-file, not bundle-wide.</strong> If you import a large utility module for one function, the whole module ships. Either import named symbols from a more focused entry point, or accept it. The mtime cache means repeat fetches are free, so the cost is one-time.</li>
    </ul>
    <p>None of these are show-stoppers, and none of them benefit from introducing a bundler. The framework is explicitly designed to make per-file ESM the right answer at production scale.</p>

    <h2>What is deliberately not in scope</h2>
    <ul>
      <li><strong>No <code>webjs build</code> command.</strong> Production performance comes from HTTP/2 multiplex + modulepreload hints, not concatenation. There is no plan to add one.</li>
      <li><strong>No per-route code splitting beyond what the browser already does.</strong> The import graph already loads each module on demand. Modulepreload hints are emitted per-route at SSR time, so the browser fetches exactly the files that route needs.</li>
      <li><strong>No Vite-grade HMR.</strong> Web components can only be <code>customElements.define</code>'d once per page, so the dev server does a full reload via SSE. Reloads are sub-100ms in practice.</li>
    </ul>
    <p>If a large-app performance problem ever materializes, the answer will be tightening the modulepreload graph or adopting per-route importmap scopes natively in the browser. Not reintroducing a build step.</p>
  `;
}
