import { html } from '@webjsdev/core';

export const metadata = { title: 'Runtime (Node & Bun) | WebJs' };

export default function Runtime() {
  return html`
    <h1>Runtime</h1>
    <p>WebJs runs on <strong>Node 24+</strong> or <strong>Bun</strong>. The same app source runs on either; the framework picks a runtime-neutral path internally and only the listener shell, the type stripper, and a few built-ins differ. Deno is a planned target (the listener seam is already runtime-neutral), not yet supported. This page is the single reference for the per-runtime commands and differences; other pages link here rather than repeat them.</p>

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
        <tr><td>Install</td><td><code>npm install</code></td><td><code>bun install</code> (required, like Node)</td><td>planned</td></tr>
        <tr><td>Run</td><td><code>npm run dev</code> / <code>npm run start</code></td><td><code>bun run dev</code> / <code>bun run start</code></td><td>planned</td></tr>
        <tr><td>Listener</td><td><code>node:http</code> shell</td><td>native <code>Bun.serve</code> (about 1.9x req/s on the listening path)</td><td>planned</td></tr>
        <tr><td>TypeScript stripping</td><td>built-in <code>module.stripTypeScriptTypes</code></td><td><code>amaro</code></td><td>planned</td></tr>
        <tr><td>SQLite driver</td><td>built-in <code>node:sqlite</code></td><td>built-in <code>bun:sqlite</code></td><td>planned</td></tr>
        <tr><td>Hot reload</td><td>in place, in one long-lived process</td><td>in place, in one long-lived process</td><td>planned</td></tr>
        <tr><td>WebSocket</td><td>the <code>ws</code> library</td><td>native <code>Bun.serve</code> (bridged to the same API)</td><td>planned</td></tr>
        <tr><td>103 Early Hints</td><td>yes</td><td>no (<code>Bun.serve</code> has no informational-response API)</td><td>planned</td></tr>
        <tr><td>Dev edit to a page / layout</td><td>refreshes in place, no reload</td><td>refreshes in place, no reload</td><td>planned</td></tr>
      </tbody>
    </table>
    <p>The in-place dev refresh needs the server process to <strong>survive</strong> the edit, and on both runtimes it does. A page or layout never hydrates, so a freshly rendered page is the complete truth for it and the client router can swap it in without a reload, keeping your scroll position and the hydrated state of components outside the changed region. The server classifies the changed file and puts the verdict on the live-reload event, so it needs a process that is still alive to do the classifying.</p>
    <p>The dev server stays ONE process for the whole session on both runtimes. On Node, a module resolve hook gives an edited module and every module that imports it a new URL, so the next request evaluates exactly that chain again (a <code>db/</code> schema, a <code>route.ts</code>, middleware and <code>*.server.ts</code> files included) while every other module keeps its instance and its state: sessions in the memory store, <code>cache()</code> entries, an open WebSocket. On Bun, <code>bun --hot</code> re-runs the CLI on a change, and the first server keeps running and only re-reads the app's modules, so nothing starts twice and memory stays flat however many edits you make. App modules are loaded fresh from disk on every reload, an editor's atomic save included. In the browser, a served module that imports a changed module asks for it at a new versioned URL, so the tab reaches the edited code while every untouched module keeps its instance.</p>
    <p>Only a file that a running process reads once restarts the server: <code>.env</code>, <code>package.json</code>, a lockfile, <code>instrumentation.*</code> and <code>env.*</code>. The restarted server reads the edited <code>.env</code> (on Bun too), and the tab reloads once.</p>

    <h3>What each dev edit does</h3>
    <p>Each saved file gets the lightest update that is still correct, and a burst of edits takes the strongest one any of them needs. Every update logs one line in the browser console, so you can always tell which one ran.</p>
    <table>
      <thead>
        <tr><th>Edit</th><th>What the tab does</th><th>Console</th></tr>
      </thead>
      <tbody>
        <tr><td>a page file</td><td>re-renders the page on the server and morphs it in place</td><td><code>[webjs] page updated in place (&lt;file&gt;)</code></td></tr>
        <tr><td>a layout, or a server-only module (<code>lib/</code>, <code>modules/</code>, <code>db/</code>, a <code>*.server.ts</code> file, <code>route.ts</code>, middleware)</td><td>re-renders the whole body in place</td><td><code>[webjs] layout updated in place (&lt;file&gt;)</code></td></tr>
        <tr><td>a component, or a browser module only components import</td><td>hot-swaps the component class, keeping its state (see <a href="/docs/components">Components</a>)</td><td><code>[webjs] hot-swapped &lt;my-tag&gt; (&lt;file&gt;)</code></td></tr>
        <tr><td>a <code>.css</code> file outside the module graph (a <code>public/</code> stylesheet, a Tailwind input)</td><td>swaps the stylesheets in place, no re-render</td><td><code>[webjs] stylesheets refreshed (&lt;file&gt;)</code></td></tr>
        <tr><td><code>.env</code>, <code>package.json</code>, a lockfile, <code>instrumentation.*</code>, <code>env.*</code></td><td>the server restarts and the tab reloads once</td><td><code>[webjs] full reload: server-restarted</code></td></tr>
        <tr><td>anything else: a new or deleted file, another <code>public/</code> asset, a browser module a page imports directly, a component edit the hot swap refuses</td><td>a full reload</td><td><code>[webjs] full reload: &lt;reason&gt; (&lt;file&gt;)</code></td></tr>
      </tbody>
    </table>
    <p>The full-reload line is printed by the page that loads after the reload, so it survives the reload it explains, and its reason names the rule that forced it. When an edit breaks a page render, the error overlay goes up over the last good page instead of replacing it, and the edit that fixes it applies in place.</p>

    <p>The supervisor is part of <code>webjs dev</code> itself (it replaced <code>node --watch</code>), and it is built so the preview does not stay down. A file in a watched directory that the dev server cannot read or watch (for example the temporary file <code>sed -i</code> creates when another user runs it, or a file deleted while it was being watched) logs one <code>file watcher skipped</code> warning, and the server keeps serving and reloading. Editor temporary and swap files are ignored, and a temporary file renamed over a source file counts as an edit to that file. If the server process crashes, the supervisor starts it again on the next file change, or by itself after a short wait (0.5s, then up to 10s for repeated crashes), and an open tab waits for it however long that takes, logging <code>[webjs] waiting for the dev server...</code> once, before it reloads. On both runtimes the supervisor restarts the server only for the restart files above.</p>

    <p>Either way the <code>.ts</code> stripping is position-preserving with no sourcemap, and the bytes the browser fetches are identical. The 103 Early Hints gap only costs a small first-load latency edge where your edge forwards 103, never correctness (the modulepreload hints still ship in the document head).</p>

    <h2>Node (the default)</h2>
    <p>Scaffold with <code>webjs create my-app</code> (Node is the default runtime). Then:</p>
    <code-block>npm install
npm run dev      # or: npm run start</code-block>
    <p>Node 24+ is required: the built-in TypeScript stripper (<code>module.stripTypeScriptTypes</code>, stable from Node 24) and recursive <code>fs.watch</code> need it. The CLI's <code>assertNodeVersion()</code> preflight enforces the floor.</p>

    <h2>Bun</h2>
    <p>Scaffold with <code>webjs create my-app --runtime bun</code>, or <code>bun create webjs my-app</code> (the runtime is auto-detected from the invoking package manager). Then:</p>
    <code-block>bun install
bun run dev      # or: bun run start</code-block>
    <p>A Bun app installs with <code>bun install</code> (like Node), then runs on Bun: its <code>dev</code> / <code>start</code> / <code>db</code> scripts force <code>bun --bun</code>, which overrides the <code>webjs</code> bin's Node shebang so the server runs on Bun, where it selects the native <code>Bun.serve</code> listener and strips types via <code>amaro</code>. The dependencies resolve from <code>node_modules</code>, the same as Node.</p>
    <p>The install also gives editor type intelligence (the editor reads the <code>.d.ts</code> files in <code>node_modules</code>).</p>

    <h3>Install model and reproducibility</h3>
    <p>A Bun app commits a <code>bun.lock</code> (the Bun analog of <code>package-lock.json</code>) for reproducible, offline installs. The scaffold's Bun Dockerfile runs <code>bun install</code> and serves on Bun via <code>CMD ["bun", "--bun", "run", "start"]</code>.</p>

    <h2>Future runtimes</h2>
    <p>The server's listener selection is a runtime-neutral seam: <code>startServer</code> chooses the <code>Bun.serve</code> shell on Bun and the <code>node:http</code> shell on Node through the same seam, which is designed to also host a <code>Deno.serve</code> or an embedded adapter later. When Deno support lands it will appear here. Edge runtimes with no filesystem are a separate, later target.</p>
  `;
}
