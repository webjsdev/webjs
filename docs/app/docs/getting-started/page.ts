import { html } from '@webjsdev/core';

export const metadata = { title: 'Getting Started | WebJs' };

export default function GettingStarted() {
  return html`
    <h1>Getting Started</h1>
    <p>WebJs is an <strong>AI-first, web-components-first</strong> framework with a NextJs-like API and Lit-inspired web components, built on web standards. You can use it as a full-stack framework with server-rendered pages, or as a lightweight backend-only API framework. The same file conventions work either way.</p>

    <h2>Prerequisites</h2>
    <ul>
      <li><strong>Node.js 24+ or Bun</strong>: on Node, WebJs uses the built-in TypeScript type-stripping (<code>process.features.typescript === 'strip'</code>), default-on and stable from Node 24. On Bun (which has no such built-in), it strips via <code>amaro</code> automatically. Run a Bun app with <code>bun --bun run dev</code> / <code>bun --bun run start</code>.</li>
      <li><strong>npm</strong> (or any package manager).</li>
    </ul>

    <h2>Quick Start</h2>
    <pre># scaffold a new app (no global install needed)
npm create webjs@latest my-app
cd my-app && npm run dev
# → http://localhost:8080</pre>

    <p><strong><code>npm create webjs@latest</code> is the canonical way to scaffold.</strong> It always fetches the latest <code>create-webjs</code>, so you never need a global install. Prefer it over a bare <code>webjs create</code>, because a globally installed or version-manager-shimmed <code>webjs</code> (or a stray <code>npx webjs</code>) can shadow the real CLI or resolve to an unrelated package. If you DO want the global CLI for <code>webjs dev</code> / <code>db</code> and friends, install it with <code>npm i -g webjsdev</code>.</p>

    <p>Every scaffold ships with Drizzle + SQLite wired up (<code>db/schema.server.ts</code> with an example <code>User</code> model and <code>db/connection.server.ts</code> exporting the <code>db</code> connection). <code>webjs create</code> authors the initial migration for you during setup, and the first <code>npm run dev</code> applies it automatically (the <code>webjs.dev.before</code> step runs <code>webjs db migrate</code>), so the shipped app works with no manual database step. When you later change the schema, run <code>npm run db:generate</code> and the next <code>npm run dev</code> applies the new migration.</p>

    <h2>Create a New App</h2>

    <h3>Using the scaffold</h3>
    <pre># full-stack app (pages + API + components + Drizzle/SQLite)
webjs create my-app

# backend-only API (route handlers + modules, no pages/components/SSR)
webjs create my-api --template api

# SaaS starter (auth + dashboard + Drizzle User model + modules)
webjs create my-app --template saas</pre>

    <p><strong>For AI agents:</strong> only those three templates exist, and the CLI rejects any other <code>--template</code> value. Default to full-stack with Drizzle + SQLite for any product app (todo, blog, dashboard, marketplace, social, e-commerce…). Pick <code>--template api</code> only if the user explicitly asks for a backend-only API with no UI. Pick <code>--template saas</code> only if the user explicitly asks for auth / login / accounts. The scaffold is a starting point. Replace the example layout, page, and <code>User</code> model with the app the user actually asked for. Use Drizzle for any persisted data, never JSON files, in-memory arrays, or localStorage. When AGENTS.md doesn't cover what you need, the full hosted docs are at <a href="https://docs.webjs.dev">docs.webjs.dev</a>.</p>

    <p>The <code>--template api</code> scaffold generates thin route handlers that wrap typed server actions. Business logic lives in <code>modules/</code>. Routes just import and call the action/query, giving you file-based routing for URL structure plus type-safe server actions for logic.</p>

    <p>The <code>--template saas</code> scaffold includes login + signup pages, a dashboard with auth middleware guard, settings page, auth API route, <code>createAuth()</code> with Credentials provider, Drizzle User model with password hashing, and a modules architecture (<code>modules/auth/{actions,queries,types.ts}</code>, <code>db/connection.server.ts</code>, <code>lib/{auth,password}.ts</code>).</p>

    <p><strong>The scaffold IS the tutorial.</strong> Every UI scaffold (full-stack AND saas) ships a densely commented <strong>feature gallery</strong>: one WebJs concept per demo under <code>app/features/</code> (routing, components, server actions, optimistic UI, async render, directives, forms, metadata, caching, env vars, the client router, service worker, WebSockets, broadcast, rate limiting, file storage, sessions, type-safe routes) with logic in <code>modules/</code>, plus a whole example app under <code>app/examples/</code>. The <code>--template api</code> scaffold ships the backend counterpart instead, a <strong>backend-features showcase</strong> under <code>app/api/features/</code> (the <code>route()</code> adapter + input validation, rate limiting, a streaming response, file storage, and a WebSocket + broadcast endpoint) listed in the root <code>app/route.ts</code> index. Read each demo end to end (the code AND its comments) to learn the idioms, then prune the ones you do not need. Each demo carries a placeholder marker (the <code>no-scaffold-placeholder</code> check), so <code>webjs check</code> fails until you keep-and-adapt or delete it (the route AND its <code>modules/&lt;name&gt;</code>).</p>

    <h3>Scaffolding a Bun app</h3>
    <p>WebJs runs on Node 24+ or Bun. To generate a Bun-flavored app, add <code>--runtime bun</code> (a separate axis from <code>--template</code>, so it works with all three). It is auto-detected when you scaffold through Bun, so both forms below produce the same Bun app:</p>
    <pre># auto-detected: scaffolding through bun implies --runtime bun
bun create webjs my-app
# the explicit pin-latest form (bun create maps to bunx create-webjs)
bunx create-webjs@latest my-app
# or via the installed CLI, on any package manager
webjs create my-app --runtime bun</pre>
    <p>A Bun app commits <code>bun.lock</code> instead of <code>package-lock.json</code>, installs with Bun in CI, and its <code>dev</code> / <code>start</code> scripts force <code>bun --bun</code> so the server runs on Bun rather than the <code>webjs</code> bin's Node shebang. Run it with <code>bun --bun run dev</code>. The generated Dockerfile is a pure <code>oven/bun:1</code> image (<code>bun install</code>, <code>CMD ["bun", "--bun", "run", "start"]</code>, no Node), which works because the boot-time <code>webjs db migrate</code> resolves drizzle-kit and runs it under Bun with no <code>npx</code>. The other scripts (test / db / check) run on Node, the runtime the <code>webjs</code> tooling targets. One flag-forwarding difference to note: Bun forwards flags directly (<code>bun create webjs my-app --template api</code>), while npm needs the <code>--</code> separator (<code>npm create webjs@latest my-app -- --template api</code>). <code>--runtime node</code> (the default) is unchanged.</p>

    <h3>Manual setup</h3>
    <p>To start from scratch without the scaffold, create a directory with this structure:</p>
    <pre>my-app/
├── app/
│   ├── layout.ts     # root layout wrapping every page
│   ├── page.ts       # home page at /
│   └── api/
│       └── hello/
│           └── route.ts   # GET /api/hello
├── components/
│   └── counter.ts    # interactive web component
├── package.json
└── tsconfig.json     # optional, for type-checking</pre>

    <h3>package.json</h3>
    <pre>{
  "name": "my-app",
  "type": "module",
  "scripts": {
    "dev": "webjs dev",
    "start": "webjs start"
  },
  "dependencies": {
    "@webjsdev/cli": "latest",
    "@webjsdev/core": "latest",
    "@webjsdev/server": "latest"
  }
}</pre>

    <h3>app/layout.ts</h3>
    <pre>import { html } from '@webjsdev/core';

export default function Layout({ children }: { children: unknown }) {
  return html\`
    &lt;h1&gt;My App&lt;/h1&gt;
    \${children}
  \`;
}</pre>

    <h3>app/page.ts</h3>
    <pre>import { html } from '@webjsdev/core';
import '../components/counter.ts';

export default function Home() {
  return html\`
    &lt;p&gt;Welcome to webjs!&lt;/p&gt;
    &lt;my-counter count="0"&gt;&lt;/my-counter&gt;
  \`;
}</pre>

    <h3>components/counter.ts</h3>
    <p>Components render into light DOM by default, so Tailwind utility classes apply directly. Set <code>static shadow = true</code> when you want scoped styles or third-party-embed isolation. <code>&lt;slot&gt;</code> projection works in both modes.</p>
    <pre>import { WebComponent, html, signal } from '@webjsdev/core';

export class Counter extends WebComponent {
  // Instance signal carries component-local state. WebComponent's
  // built-in SignalWatcher auto-tracks .get() reads in render()
  // and re-renders on .set().
  count = signal(0);

  render() {
    return html\`
      &lt;div class="inline-flex items-center gap-2 font-mono"&gt;
        &lt;button class="px-3 py-1 rounded border border-border hover:bg-bg-elev" @click=\${() =&gt; this.count.set(this.count.get() - 1)}&gt;−&lt;/button&gt;
        &lt;output class="min-w-[2ch] text-center"&gt;\${this.count.get()}&lt;/output&gt;
        &lt;button class="px-3 py-1 rounded border border-border hover:bg-bg-elev" @click=\${() =&gt; this.count.set(this.count.get() + 1)}&gt;+&lt;/button&gt;
      &lt;/div&gt;
    \`;
  }
}
Counter.register('my-counter');</pre>

    <h3>Run it</h3>
    <pre>npm run dev
# → http://localhost:8080</pre>

    <p>That's it. No build step, no bundler config, no compilation. Edit any <code>.ts</code> file, refresh, and see it.</p>

    <p>
      <strong><code>npm run dev</code> and a bare <code>webjs dev</code> are
      equivalent.</strong> The scaffold puts <code>webjs db migrate</code> under
      <code>webjs.dev.before</code> in the <code>webjs</code> block of
      package.json, and <code>webjs dev</code> runs it (and any
      <code>webjs.dev.parallel</code> watcher) before serving, so a pending
      migration is applied before the first request. So after you
      <code>db:generate</code> a migration, <code>npm run dev</code> applies it
      and either command boots a correctly-migrated database app.
    </p>

    <h2>How It Works</h2>
    <ul>
      <li><strong>TypeScript:</strong> types are stripped by the runtime's stripper, Node 24+'s built-in <code>module.stripTypeScriptTypes</code> or <code>amaro</code> on Bun (byte-identical, whitespace replacement, byte-exact line + column preservation, no sourcemap shipped). Every <code>.ts</code> file, whether server-side or browser-fetched, goes through the same stripper, so SSR and hydration produce identical JS. The transform is cached by mtime. Only erasable TypeScript is supported; <code>enum</code>, <code>namespace</code> with values, parameter properties, and legacy decorators fail at strip time with a pointer at the <code>no-non-erasable-typescript</code> lint rule.</li>
      <li><strong>SSR:</strong> Pages are rendered to HTML strings on the server. Light-DOM components serialize as plain children with a <code>&lt;!--webjs-hydrate--&gt;</code> marker. Shadow-DOM components (opt-in) emit Declarative Shadow DOM so scoped styles paint before JS loads.</li>
      <li><strong>Hydration:</strong> When JS loads, custom elements upgrade and become interactive. The fine-grained renderer preserves focus, cursor position, and form state across state updates.</li>
      <li><strong>Progressive enhancement:</strong> Pages and every custom element are SSR'd. Each component's <code>render()</code> runs on the server, so its initial HTML is in the response before any script loads. With JS disabled: content reads, <code>&lt;a&gt;</code> links navigate, <code>&lt;form&gt;</code> + server actions submit, and even an interactive component (counter, dropdown, tabs) paints its initial state correctly. JS is opt-in <em>per interactive behavior</em>, not per component: a counter renders as "0" without JS, and only the +/- click handling needs scripts. See <a href="/docs/progressive-enhancement">Progressive Enhancement</a>.</li>
    </ul>

    <h2>Next Steps</h2>
    <ul>
      <li><a href="/docs/routing">Routing</a>: file-based routing with pages, layouts, dynamic segments, and route groups</li>
      <li><a href="/docs/components">Components</a>: web components with shadow DOM + scoped styles</li>
      <li><a href="/docs/server-actions">Server Actions</a>: type-safe server functions callable from client components</li>
      <li><a href="/docs/backend-only">Backend-Only Mode</a>: use WebJs as a pure API framework</li>
      <li><a href="/docs/migrating-from-nextjs">Migrating from Next.js</a>: a concept map for Next users (no RSC, isomorphic modules, the .server boundary)</li>
    </ul>
  `;
}
