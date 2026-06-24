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
        <tr><td>Install</td><td><code>npm install</code></td><td>optional (zero-install via auto-install)</td><td>planned</td></tr>
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
    <pre>bun run dev      # or: bun run start  (no install step required)</pre>
    <p>A Bun app is <strong>zero-install</strong>: its <code>dev</code> / <code>start</code> / <code>db</code> scripts run through a generated <code>webjs-bun.mjs</code> bootstrap under <code>bun --bun</code>. The bootstrap imports the CLI by bare specifier, so Bun's auto-install resolves <code>@webjsdev/*</code> and your dependencies on demand. <code>bun --bun</code> overrides the <code>webjs</code> bin's Node shebang so the server runs on Bun, where it selects the native <code>Bun.serve</code> listener and strips types via <code>amaro</code>.</p>
    <p><code>bun create</code> does <strong>not</strong> run an install on Bun: the scaffold skips it, so <code>bun run dev</code> starts immediately. <code>bun install</code> is optional. Run it when you want pinned, reproducible versions (it materializes <code>node_modules</code> from the lockfile) or editor type intelligence (without a local <code>node_modules</code> the editor has no type files). Pass <code>--install</code> to opt into the create-time install. The Node-targeted tooling scripts (<code>test</code> / <code>check</code> / <code>typecheck</code>) still expect an install.</p>

    <h3>Version resolution under zero-install</h3>
    <p>With no <code>node_modules</code>, Bun's runtime auto-install resolves each bare import to the dependency's <strong>absolute latest</strong> version. It <strong>ignores the <code>package.json</code> range and any <code>bun.lock</code></strong> (both apply only to <code>bun install</code>, not the on-the-fly runtime path). Verified on Bun 1.3.14: <code>^3.20.0</code>, even with a <code>bun.lock</code> pinning an older version, resolves to the latest major. The one exception is an <strong>exact</strong> <code>package.json</code> pin (<code>"zod": "3.22.4"</code>): an <code>onLoad</code> transform rewrites the bare specifier to an inline-versioned one (<code>zod</code> becomes <code>zod@3.22.4</code>), which Bun honors (an exact inline version resolves; a range or dist-tag does not). So under zero-install, exact pins hold while ranges and the lockfile go to latest. The rewrite is server-side only and a no-op when <code>node_modules</code> exists. On by default. Opt out with <code>WEBJS_PIN=0</code> or <code>{ "webjs": { "pin": false } }</code>.</p>
    <p>The scaffold leans on this for consistency: <code>webjs create</code> ships <strong>exact-pinned</strong> dependencies (<code>@webjsdev/*</code> and <code>drizzle-orm</code>, #692), so a fresh app resolves <strong>identical versions on npm and bun</strong>, and a Bun zero-install app runs those exact versions (not latest). A dependency you add later with a <code>^</code> range follows the rule above (bun zero-install resolves it to latest), so run <code>bun install</code> or pin it exact if you need it frozen.</p>

    <h3>Reproducibility</h3>
    <p>For reproducible, pinned dependencies run <code>bun install</code> (it materializes <code>node_modules</code> from the lockfile, which the runtime then uses). The scaffold's Bun Dockerfile keeps an explicit <code>bun install</code> on purpose: a production image should be immutable and self-contained, with no registry fetch at boot. Zero-install is a dev-iteration convenience (fast start, latest-resolved deps), not a reproducibility mechanism.</p>

    <h2>Future runtimes</h2>
    <p>The server's listener selection is a runtime-neutral seam: <code>startServer</code> chooses the <code>Bun.serve</code> shell on Bun and the <code>node:http</code> shell on Node through the same seam, which is designed to also host a <code>Deno.serve</code> or an embedded adapter later. When Deno support lands it will appear here. Edge runtimes with no filesystem are a separate, later target.</p>
  `;
}
