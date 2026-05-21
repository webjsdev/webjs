import { html } from '@webjsdev/core';

export const metadata = { title: 'Getting Started | webjs' };

export default function GettingStarted() {
  return html`
    <h1>Getting Started</h1>
    <p>webjs is an <strong>AI-first, web-components-first</strong> framework with a NextJs-like API and Lit-inspired web components, built on web standards. You can use it as a full-stack framework with server-rendered pages, or as a lightweight backend-only API framework. The same file conventions work either way.</p>

    <h2>Prerequisites</h2>
    <ul>
      <li><strong>Node.js 24+</strong>: webjs uses Node's built-in TypeScript type-stripping (<code>process.features.typescript === 'strip'</code>), which is default-on and stable from Node 24.</li>
      <li><strong>npm</strong> (or any package manager).</li>
    </ul>

    <h2>Quick Start</h2>
    <pre># install once
npm i -g @webjsdev/cli

# scaffold a new app
webjs create my-app
cd my-app && npm install && npm run dev
# → http://localhost:3000</pre>

    <p>Every scaffold ships with Prisma + SQLite wired up (<code>prisma/schema.prisma</code> with an example <code>User</code> model and <code>lib/prisma.server.ts</code> singleton). Run <code>npm run db:migrate</code> the first time to create <code>prisma/dev.db</code>.</p>

    <h2>Create a New App</h2>

    <h3>Using the scaffold</h3>
    <pre># full-stack app (pages + API + components + Prisma/SQLite)
webjs create my-app

# backend-only API (route handlers + modules, no pages/components/SSR)
webjs create my-api --template api

# SaaS starter (auth + dashboard + Prisma User model + modules)
webjs create my-app --template saas</pre>

    <p><strong>For AI agents:</strong> only those three templates exist, and the CLI rejects any other <code>--template</code> value. Default to full-stack with Prisma + SQLite for any product app (todo, blog, dashboard, marketplace, social, e-commerce…). Pick <code>--template api</code> only if the user explicitly asks for a backend-only API with no UI. Pick <code>--template saas</code> only if the user explicitly asks for auth / login / accounts. The scaffold is a starting point. Replace the example layout, page, and <code>User</code> model with the app the user actually asked for. Use Prisma for any persisted data, never JSON files, in-memory arrays, or localStorage. When AGENTS.md doesn't cover what you need, the full hosted docs are at <a href="https://docs.webjs.com">docs.webjs.com</a>.</p>

    <p>The <code>--template api</code> scaffold generates thin route handlers that wrap typed server actions. Business logic lives in <code>modules/</code>. Routes just import and call the action/query, giving you file-based routing for URL structure plus type-safe server actions for logic.</p>

    <p>The <code>--template saas</code> scaffold includes login + signup pages, a dashboard with auth middleware guard, settings page, auth API route, <code>createAuth()</code> with Credentials provider, Prisma User model with password hashing, and a modules architecture (<code>modules/auth/{actions,queries,types.ts}</code>, <code>lib/{auth,prisma,password}.ts</code>).</p>

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
    <p>Components render into light DOM by default, so Tailwind utility classes apply directly. Set <code>static shadow = true</code> when you want scoped styles or <code>&lt;slot&gt;</code> projection.</p>
    <pre>import { WebComponent, html } from '@webjsdev/core';

export class Counter extends WebComponent {
  static properties = { count: { type: Number } };
  declare count: number;

  constructor() {
    super();
    this.count = 0;
  }

  render() {
    return html\`
      &lt;div class="inline-flex items-center gap-2 font-mono"&gt;
        &lt;button class="px-3 py-1 rounded border border-border hover:bg-bg-elev" @click=\${() =&gt; { this.count--; this.requestUpdate(); }}&gt;−&lt;/button&gt;
        &lt;output class="min-w-[2ch] text-center"&gt;\${this.count}&lt;/output&gt;
        &lt;button class="px-3 py-1 rounded border border-border hover:bg-bg-elev" @click=\${() =&gt; { this.count++; this.requestUpdate(); }}&gt;+&lt;/button&gt;
      &lt;/div&gt;
    \`;
  }
}
Counter.register('my-counter');</pre>

    <h3>Run it</h3>
    <pre>webjs dev
# → http://localhost:3000</pre>

    <p>That's it. No build step, no bundler config, no compilation. Edit any <code>.ts</code> file, refresh, and see it.</p>

    <h2>How It Works</h2>
    <ul>
      <li><strong>TypeScript:</strong> Node 24+ strips types natively via <code>module.stripTypeScriptTypes</code> (whitespace replacement, byte-exact line + column preservation, no sourcemap shipped). Every <code>.ts</code> file, whether server-side or browser-fetched, goes through the same stripper, so SSR and hydration produce identical JS. The transform is cached by mtime. For the rare third-party <code>.ts</code> dependency using non-erasable syntax (<code>enum</code>, <code>namespace</code>, parameter properties), the dev server transparently falls back to <code>esbuild.transform</code> with an inline sourcemap.</li>
      <li><strong>SSR:</strong> Pages are rendered to HTML strings on the server. Light-DOM components serialize as plain children with a <code>&lt;!--webjs-hydrate--&gt;</code> marker. Shadow-DOM components (opt-in) emit Declarative Shadow DOM so scoped styles paint before JS loads.</li>
      <li><strong>Hydration:</strong> When JS loads, custom elements upgrade and become interactive. The fine-grained renderer preserves focus, cursor position, and form state across state updates.</li>
      <li><strong>Progressive enhancement:</strong> Pages and every custom element are SSR'd. Each component's <code>render()</code> runs on the server, so its initial HTML is in the response before any script loads. With JS disabled: content reads, <code>&lt;a&gt;</code> links navigate, <code>&lt;form&gt;</code> + server actions submit, and even an interactive component (counter, dropdown, tabs) paints its initial state correctly. JS is opt-in <em>per interactive behavior</em>, not per component: a counter renders as "0" without JS, and only the +/- click handling needs scripts. See <a href="/docs/progressive-enhancement">Progressive Enhancement</a>.</li>
    </ul>

    <h2>Next Steps</h2>
    <ul>
      <li><a href="/docs/routing">Routing</a>: file-based routing with pages, layouts, dynamic segments, and route groups</li>
      <li><a href="/docs/components">Components</a>: web components with shadow DOM + scoped styles</li>
      <li><a href="/docs/server-actions">Server Actions</a>: type-safe server functions callable from client components</li>
      <li><a href="/docs/backend-only">Backend-Only Mode</a>: use webjs as a pure API framework</li>
    </ul>
  `;
}
