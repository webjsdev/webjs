import { html } from '@webjsdev/core';

export const metadata = { title: 'Runtime (Node & Bun) | webjs' };

export default function Runtime() {
  return html`
    <h1>Runtime</h1>
    <p>webjs runs on <strong>Node 24+</strong> or <strong>Bun</strong>. The same app source runs on either; the framework picks a runtime-neutral path internally and only the listener shell, the type stripper, and a few built-ins differ. Deno is a planned target (the listener seam is already runtime-neutral), not yet supported. This page is the single reference for the per-runtime commands and differences; other pages link here rather than repeat them.</p>

    <p>Related reading:</p>
    <ul>
      <li><a href="/docs/getting-started">Getting Started</a> for scaffolding an app.</li>
      <li><a href="/docs/no-build">No-Build Model</a> for how source is served.</li>
      <li><a href="/docs/deployment">Deployment</a> for shipping a container.</li>
    </ul>

    <h2>Node vs Bun at a glance</h2>
    <table>
      <thead>
        <tr><th>Area</th><th>Node 24+</th><th>Bun</th><th>Deno</th></tr>
      </thead>
      <tbody>
        <tr><td>Install</td><td><code>npm install</code></td><td>no manual install (zero-install fast path; transparent install for non-latest deps)</td><td>planned</td></tr>
        <tr><td>Run</td><td><code>npm run dev</code> / <code>npm run start</code></td><td><code>bun run dev</code> / <code>bun run start</code></td><td>planned</td></tr>
        <tr><td>Listener</td><td><code>node:http</code> shell</td><td>native <code>Bun.serve</code> (about 1.9x req/s on the listening path)</td><td>planned</td></tr>
        <tr><td>TypeScript stripping</td><td>built-in <code>module.stripTypeScriptTypes</code></td><td><code>amaro</code></td><td>planned</td></tr>
        <tr><td>SQLite driver</td><td>built-in <code>node:sqlite</code></td><td>built-in <code>bun:sqlite</code></td><td>planned</td></tr>
        <tr><td>Hot reload</td><td><code>node --watch</code></td><td><code>bun --hot</code></td><td>planned</td></tr>
        <tr><td>WebSocket</td><td>the <code>ws</code> library</td><td>native <code>Bun.serve</code> (bridged to the same API)</td><td>planned</td></tr>
        <tr><td>103 Early Hints</td><td>yes</td><td>no (<code>Bun.serve</code> has no informational-response API)</td><td>planned</td></tr>
      </tbody>
    </table>
    <p>Either way the <code>.ts</code> stripping is position-preserving with no sourcemap, and the bytes the browser fetches are identical. The 103 Early Hints gap only costs a small first-load latency edge where your edge forwards 103, never correctness (the modulepreload hints still ship in the document head).</p>

    <h2>Node (the default)</h2>
    <p>Scaffold with <code>webjs create my-app</code> (Node is the default runtime). Then:</p>
    <pre>npm install
npm run dev      # or: npm run start</pre>
    <p>Node 24+ is required: the built-in TypeScript stripper (<code>module.stripTypeScriptTypes</code>, stable from Node 24) and recursive <code>fs.watch</code> need it. The CLI's <code>assertNodeVersion()</code> preflight enforces the floor.</p>

    <h2>Bun</h2>
    <p>Scaffold with <code>webjs create my-app --runtime bun</code>, or <code>bun create webjs my-app</code> (the runtime is auto-detected from the invoking package manager). Then:</p>
    <pre>bun run dev      # or: bun run start  (no manual install step)</pre>
    <p>A Bun app needs <strong>no manual <code>bun install</code></strong>: its <code>dev</code> / <code>start</code> / <code>db</code> scripts run through a generated <code>webjs-bun.mjs</code> bootstrap under <code>bun --bun</code>. The bootstrap imports the CLI by bare specifier, so Bun's auto-install resolves <code>@webjsdev/*</code> and your latest-in-range dependencies on demand. <code>bun --bun</code> overrides the <code>webjs</code> bin's Node shebang so the server runs on Bun, where it selects the native <code>Bun.serve</code> listener and strips types via <code>amaro</code>.</p>
    <p><code>bun create</code> does <strong>not</strong> run an install on Bun. A latest-in-range dep serves immediately on the zero-install fast path. A non-latest dep (a prerelease, an exact pin, or a version a committed <code>bun.lock</code> pins) cannot be served zero-install, because Bun auto-install is latest-only, so webjs runs a one-time <strong>transparent <code>bun install</code></strong> at boot for it and serves from <code>node_modules</code> (installed mode) thereafter. Run <code>bun install</code> yourself anytime for pinned versions across machines or editor type intelligence (without a local <code>node_modules</code> the editor has no type files). The Node-targeted tooling scripts (<code>test</code> / <code>check</code> / <code>typecheck</code>) still expect an install.</p>

    <h3>Version resolution: zero-install fast path vs transparent install</h3>
    <p>With no <code>node_modules</code>, Bun's runtime auto-install is <strong>latest-only</strong>: it resolves a <strong>bare</strong> import to the dependency's latest version (latest-in-range for an inline range) and <strong>ignores the <code>package.json</code> range and any <code>bun.lock</code></strong> (both apply only to <code>bun install</code>). webjs's <code>onLoad</code> transform rewrites a declared dep's bare specifier to an inline one Bun <em>does</em> honor, but only a <strong>range</strong> is safe: an inline EXACT, non-latest specifier (<code>is-odd@2.0.0</code> when latest is 3.x, <code>drizzle-orm@1.0.0-rc.3</code> while latest is on the 0.4x line) ENOENTs on a cold cache, so the transform forwards the declared RANGE (<code>zod@^3.20.0</code> picks the highest matching <code>3.x</code>), not the <code>bun.lock</code> exact. So zero-install is <strong>latest-in-range, not reproducible</strong>. The rewrite is server-side only and a no-op when <code>node_modules</code> exists. On by default. Opt out with <code>WEBJS_PIN=0</code> or <code>{ "webjs": { "pin": false } }</code>.</p>
    <p>A version that <strong>cannot</strong> be served that way (a prerelease, an exact pin, a protocol range, a wildcard, a dist-tag, or anything a committed <code>bun.lock</code> pins for reproducibility) is served by a one-time <strong>transparent <code>bun install</code></strong>: at boot webjs classifies the declared deps and, when one needs it, runs <code>bun install</code> before listening, then resolves from <code>node_modules</code> in installed mode (the next boot reuses it and is fast). An all-latest-in-range app serves immediately and converges via a detached background install. The install is serialized by a lock marker, uses <code>--frozen-lockfile</code> when a lock is present, and is fail-open (offline degrades to the zero-install fast path). <code>webjs db</code> and <code>webjs test --browser</code> run the same install first on a zero-install box.</p>
    <p>The <strong>browser importmap shares the same version source</strong> under zero-install. The jspm importmap normally reads a vendor's version off <code>node_modules</code>, which is absent here, so a browser-bound <code>import dayjs from 'dayjs'</code> in an interactive component would otherwise get no importmap entry and 404. So when the on-disk read finds nothing, the importmap falls back to the <code>bun.lock</code> exact else the <code>package.json</code> semver (jspm resolves a range), so the server and the browser load a vendor at one version. A committed <code>bun.lock</code> keeps the two identical.</p>
    <p>The scaffold ships <strong>idiomatic caret ranges</strong>: <code>webjs create</code> writes <code>@webjsdev/*</code> and <code>pg</code> as <code>^</code> ranges served zero-install at latest-in-range. <code>drizzle-orm</code> / <code>drizzle-kit</code> stay <strong>exact</strong> at the <code>1.0.0-rc.3</code> line: that line is a prerelease, which cannot be served zero-install at all, so it is the canonical transparent-install trigger (the committed <code>bun.lock</code> plus the boot install serve it reproducibly in installed mode).</p>

    <h3>Reproducibility</h3>
    <p>For reproducible, pinned dependencies run <code>bun install</code> (it materializes <code>node_modules</code> from the lockfile, which the runtime then uses). The scaffold's Bun Dockerfile keeps an explicit <code>bun install</code> on purpose: a production image should be immutable and self-contained, with no registry fetch at boot. Zero-install is a dev-iteration convenience (fast start, latest-resolved deps), not a reproducibility mechanism.</p>

    <h2>Future runtimes</h2>
    <p>The server's listener selection is a runtime-neutral seam: <code>startServer</code> chooses the <code>Bun.serve</code> shell on Bun and the <code>node:http</code> shell on Node through the same seam, which is designed to also host a <code>Deno.serve</code> or an embedded adapter later. When Deno support lands it will appear here. Edge runtimes with no filesystem are a separate, later target.</p>
  `;
}
