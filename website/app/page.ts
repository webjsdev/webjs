import { html } from '@webjskit/core';

export const metadata = {
  title: 'webjs: AI-first, web-components-first, no-build web framework',
  description: 'AI-first, web-components-first framework. File-based routing, server actions, streaming SSR: built on web standards. Designed for AI agents to read, write, and ship.',
};

// URLs for the sibling apps. Read at SSR time so they reflect whatever
// environment the website is running in: `webjs dev` uses the default
// ports; deployments override DOCS_URL / BLOG_URL with real URLs.
// Guarded against `process` being undefined because this file also
// loads on the client during hydration: an unguarded access crashes
// the module and prevents custom elements (e.g. <theme-toggle>) from
// upgrading.
const env = (globalThis as any).process?.env ?? {};
const DOCS_URL = env.DOCS_URL || 'http://localhost:4000';
const BLOG_URL = env.BLOG_URL || 'http://localhost:3456';
const UI_URL   = env.UI_URL   || 'https://ui.webjs.dev';
const STORY_URL = 'https://heyvivek.com/i-built-a-tiny-in-size-not-in-power-full-stack-framework-for-the-ai-era-i-call-it-webjs';

const FEATURES = [
  { icon: '🤖', title: 'AI-First Development', desc: 'Designed from the ground up for AI agents. AGENTS.md contract, cross-agent guardrails (.cursorrules, .windsurfrules, copilot-instructions.md), auto-generated tests and docs, opinionated conventions: LLMs produce production-quality code without guesswork.' },
  { icon: '⚡', title: 'No Build Step', desc: 'Source files are served to the browser as native ES modules. Edit a .ts file, refresh, see it. No webpack, no Vite, no compile step. Auto-vendor bundling for npm packages via import maps.' },
  { icon: '🧱', title: 'Web Components · Light DOM by Default', desc: 'Standard HTML custom elements with a thin reactive base class: html`` / css`` tagged templates, static properties, ReactiveController, Task and Context controllers. Light DOM is the default so Tailwind and global CSS apply directly; flip static shadow = true for scoped styles or embed isolation. Both modes SSR fully (light DOM as direct HTML, shadow DOM via DSD) and hydrate with zero flash.' },
  { icon: '🪟', title: '<slot> in Light DOM, Full Shadow-DOM Parity', desc: 'webjs is the only web-components framework that gives you the complete <slot> surface in light DOM: named slots, fallback content, assignedNodes() / assignedElements() / assignedSlot, slotchange events, first-wins resolution, and {flatten: true} forwarding. The same render() template works whether static shadow is true or false: no rewrite when you switch modes. Lit ties slot APIs to a shadow root (open issue lit/lit-element#553 has tracked the request for years); Stencil polyfills light-DOM slots but documents known fallback / mixed-tree gaps. SSR projects authored children directly into the rendered HTML so progressive enhancement works with JS disabled.' },
  { icon: '🪜', title: 'Progressive Enhancement by Default', desc: 'Pages and every web component are SSR’d to real HTML: each component’s render() runs on the server, so its initial markup is in the response before any script loads. With JS disabled: content reads, <a> links navigate, <form> server actions submit, and display-only custom elements look right. JavaScript is opt-in per interactive behavior, not per component: a counter renders as "0" without JS: only the +/- click handling needs scripts. The HTML is the floor; @click and setState interactivity are layered on top.' },
  { icon: '💡', title: 'Editor Intelligence', desc: '@webjskit/ts-plugin gives VS Code and Neovim type-checked html`` templates, custom-element go-to-definition, attribute auto-complete from static properties, and silenced "Unknown tag" diagnostics for Class.register("tag") elements.' },
  { icon: '🎨', title: 'Tailwind CSS by Default', desc: 'The scaffold ships with the Tailwind browser runtime and @theme design tokens: color palette, font families, fluid type scale, and motion durations wired into Tailwind classes. Dedup repeated class bundles with small JS helpers in app/_utils/ui.ts that run at SSR time. Custom CSS still supported: no hard Tailwind dependency.' },
  { icon: '🧩', title: 'AI-First Component Library', desc: 'Webjs UI ships 32 primitives written for AI agents, not for human dev ergonomics. Two-tier composition: pure class-helper functions (buttonClass, cardClass, inputClass) compose with raw native elements, plus a small set of stateful custom elements (ui-dialog, ui-tabs, ui-popover, ui-dropdown-menu) only where the browser needs state. Source-copied into your project: you own it. Zero third-party runtime deps. Visit ui.webjs.dev.' },
  { icon: '📁', title: 'File-Based Routing', desc: 'Pages, layouts, route handlers, error boundaries, and loading states from the file system: page.ts, layout.ts, route.ts, error.ts, loading.ts (auto-Suspense), not-found.ts (nested), middleware.ts, [param], [...slug], [[...optional]], (groups), and metadata routes (sitemap.ts, robots.ts). Familiar if you have used the NextJs App Router.' },
  { icon: '🔄', title: 'Server Actions, rich types on the wire', desc: 'Import a .server.ts function from a client component: it auto-rewrites into a type-safe RPC stub. Date, Map, Set, BigInt, TypedArray, Blob, File, FormData, and reference cycles all round-trip as their real types via webjs\'s built-in ESM serializer.' },
  { icon: '🌊', title: 'Streaming SSR + Suspense', desc: 'Fallback content flushes immediately. Deferred data streams in as it resolves. TTFB measured in milliseconds, not seconds.' },
  { icon: '🔌', title: 'WebSocket Built In', desc: 'Export a WS function from any route.ts and it becomes a WebSocket endpoint. connectWS() on the client auto-reconnects with exponential backoff.' },
  { icon: '🛡️', title: 'Built-in Essentials', desc: 'Auth (OAuth + credentials + JWT), sessions (cookie or Redis-backed), cache() for queries, HTTP Cache-Control for pages, WebSocket broadcast, rate limiting: the building blocks every app needs, without third-party dependencies.' },
  { icon: '📝', title: 'TypeScript or JSDoc', desc: 'Full-stack type safety with .ts files or JSDoc annotations. The dev server transforms TypeScript on the fly via esbuild: same transformer for SSR and hydration, full TS feature support, no build step you run.' },
  { icon: '🧪', title: 'Testing Built In', desc: 'webjs test runs server + browser tests (WTR + Playwright). webjs check validates conventions. webjs create scaffolds test directories and example tests. AI agents auto-generate tests with every feature.' },
  { icon: '🔀', title: 'Git Workflow Guardrails', desc: 'Branch checking before edits, merge approval with delete/keep prompt, no AI attribution in commits, auto-rebase before work. Enforced via hooks for Claude Code, config files for Cursor/Windsurf/Copilot.' },
  { icon: '📐', title: 'Opinionated Conventions', desc: 'Modules architecture, one-function-per-file actions, CONVENTIONS.md with overridable rules, webjs check validator. AI agents produce consistent code across teams.' },
];

export default function LandingPage() {
  return html`
    <style>
      .hero {
        max-width: 900px;
        margin: 0 auto;
        padding: var(--sp-8) var(--sp-5) var(--sp-7);
        text-align: center;
      }
      .hero .rubric {
        font: 600 13px/1.4 var(--font-mono);
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--fg-muted);
        margin-bottom: var(--sp-5);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        column-gap: 8px;
        row-gap: 2px;
      }
      .hero .rubric > span { white-space: nowrap; }
      .hero .rubric .name {
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: var(--accent);
      }
      .hero .rubric .sep { color: var(--fg-subtle); }
      .hero h1 {
        font: 700 var(--fs-display)/1.05 var(--font-serif);
        letter-spacing: -0.03em;
        margin: 0 0 var(--sp-5);
        text-wrap: balance;
      }
      .hero p {
        font-size: var(--fs-lede);
        line-height: 1.55;
        color: var(--fg-muted);
        max-width: 60ch;
        margin: 0 auto var(--sp-6);
      }
      .hero-actions {
        display: flex;
        gap: var(--sp-3);
        justify-content: center;
        flex-wrap: wrap;
      }
      .hero-actions a {
        display: inline-block;
        padding: var(--sp-3) var(--sp-5);
        border-radius: 999px;
        font: 600 14px/1 var(--font-sans);
        text-decoration: none;
        transition: background var(--t-fast), border-color var(--t-fast);
      }
      .hero-actions .primary {
        background: var(--accent);
        color: var(--accent-fg);
      }
      .hero-actions .primary:hover { background: var(--accent-hover); }
      .hero-actions .secondary {
        background: transparent;
        color: var(--fg-muted);
        border: 1px solid var(--border-strong);
      }
      .hero-actions .secondary:hover { color: var(--fg); border-color: var(--fg-muted); }

      .install {
        max-width: 520px;
        margin: 0 auto var(--sp-8);
        padding: var(--sp-4);
        background: var(--bg-sunken);
        border: 1px solid var(--border);
        border-radius: var(--rad);
        font: 14px/1.6 var(--font-mono);
        color: var(--fg-muted);
        text-align: left;
        overflow-x: auto;
      }
      .install .comment { color: var(--fg-subtle); }
      .install .cmd { color: var(--fg); }
      /* On narrow viewports the box would stretch full-width and its
         left/right border + rounded corners would visibly clip the
         screen edges. Drop the side borders + radius so it reads as a
         clean full-bleed band; top/bottom borders still separate it. */
      @media (max-width: 560px) {
        .install {
          border-left: none;
          border-right: none;
          border-radius: 0;
        }
      }

      .features {
        max-width: 900px;
        margin: 0 auto;
        padding: 0 var(--sp-5) var(--sp-8);
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--sp-4);
      }
      .feature {
        padding: var(--sp-5);
        background: var(--bg-elev);
        border: 1px solid var(--border);
        border-radius: var(--rad-lg);
        transition: border-color var(--t), box-shadow var(--t);
        min-width: 0;
      }
      .feature:hover { border-color: var(--border-strong); box-shadow: var(--shadow); }
      .feature .icon { font-size: 24px; margin-bottom: var(--sp-2); }
      .feature h3 {
        font-size: 1rem;
        font-weight: 700;
        margin: 0 0 var(--sp-2);
        color: var(--fg);
      }
      .feature p {
        font-size: 14px;
        line-height: 1.55;
        color: var(--fg-muted);
        margin: 0;
      }

      .modes {
        max-width: 900px;
        margin: 0 auto;
        padding: 0 var(--sp-5) var(--sp-8);
      }
      .modes h2 {
        font: 700 var(--fs-h2)/1.2 var(--font-serif);
        letter-spacing: -0.02em;
        text-align: center;
        margin: 0 0 var(--sp-5);
      }
      .mode-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--sp-4);
      }
      @media (max-width: 600px) { .mode-grid { grid-template-columns: 1fr; } }
      .mode-card {
        padding: var(--sp-5) var(--sp-6);
        background: var(--bg-elev);
        border: 1px solid var(--border);
        border-radius: var(--rad-lg);
        /* allow grid track to shrink below min-content of the <pre> inside */
        min-width: 0;
      }
      .mode-card .rubric {
        font: 600 10px/1 var(--font-mono);
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--accent);
        margin-bottom: var(--sp-2);
      }
      .mode-card h3 {
        font: 700 1.2rem/1.25 var(--font-serif);
        margin: 0 0 var(--sp-3);
      }
      .mode-card p {
        font-size: 14px;
        line-height: 1.6;
        color: var(--fg-muted);
        margin: 0 0 var(--sp-3);
      }
      .mode-card pre {
        margin: 0;
        padding: var(--sp-3);
        border-radius: var(--rad-sm);
        background: var(--bg-sunken);
        border: 1px solid var(--border);
        font: 13px/1.5 var(--font-mono);
        overflow-x: auto;
      }

      footer {
        max-width: 900px;
        margin: 0 auto;
        padding: var(--sp-7) var(--sp-5);
        border-top: 1px solid var(--border);
        text-align: center;
        font-size: 13px;
        color: var(--fg-subtle);
      }
      footer a { color: var(--accent); text-decoration: none; }
      footer a:hover { text-decoration: underline; }
    </style>

    <section class="hero">
      <div class="rubric">
        <span class="name">webjs</span>
        <span class="sep">·</span>
        <span>ai-first</span>
        <span class="sep">·</span>
        <span>web-components-first</span>
        <span class="sep">·</span>
        <span>no build</span>
      </div>
      <h1>The web framework built for AI agents</h1>
      <p>
        WebJs is built for AI agents from the ground up.
        You get native web components, server actions, streaming SSR.
        Built on web standards. No bundler, no config, no magic.
      </p>
      <div class="hero-actions">
        <a class="primary" href=${DOCS_URL + '/docs/getting-started'} target="_blank">Get Started</a>
        <a class="secondary" href="https://github.com/vivek7405/webjs" target="_blank">GitHub</a>
        <a class="secondary" href=${BLOG_URL} target="_blank">Example Blog</a>
      </div>
    </section>

    <div class="install">
      <span class="comment"># install once</span><br>
      <span class="cmd">npm i -g @webjskit/cli</span><br>
      <br>
      <span class="comment"># scaffold a new app</span><br>
      <span class="cmd">webjs create my-app</span><br>
      <span class="cmd">cd my-app && npm install && npm run dev</span><br>
      <span class="comment"># → http://localhost:3000</span><br>
      <br>
      <span class="comment"># or backend-only API</span><br>
      <span class="cmd">webjs create my-api --template api</span><br>
      <br>
      <span class="comment"># or SaaS starter (auth + dashboard + Prisma)</span><br>
      <span class="cmd">webjs create my-app --template saas</span>
    </div>

    <div class="features">
      ${FEATURES.map(f => html`
        <div class="feature">
          <div class="icon">${f.icon}</div>
          <h3>${f.title}</h3>
          <p>${f.desc}</p>
        </div>
      `)}
    </div>

    <section class="modes">
      <h2>One framework, two modes</h2>
      <div class="mode-grid">
        <div class="mode-card">
          <div class="rubric">Full-Stack</div>
          <h3>Pages + API + Components</h3>
          <p>
            SSR pages with web components, server actions, Prisma, auth,
            WebSockets, streaming. Everything you need for a complete app.
          </p>
          <pre>app/page.ts             → SSR page
app/api/posts/route.ts  → REST endpoint
components/counter.ts   → interactive UI
actions/posts.server.ts → server action</pre>
        </div>
        <div class="mode-card">
          <div class="rubric">Backend-Only</div>
          <h3>Just API Routes</h3>
          <p>
            Skip pages entirely. Use webjs as a lightweight API framework
            with file-based routing, middleware, rate limiting, WebSockets,
            and TypeScript. Zero frontend required.
          </p>
          <pre>app/api/users/route.ts     → CRUD
app/api/auth/middleware.ts → rate limit
app/api/chat/route.ts      → WebSocket
middleware.ts              → global auth</pre>
        </div>
      </div>
    </section>

    <section class="modes">
      <h2>Built for AI agents</h2>
      <div class="mode-grid">
        <div class="mode-card">
          <div class="rubric">Cross-agent guardrails</div>
          <h3>Every AI agent, same standards</h3>
          <p>
            <code>webjs create</code> scaffolds config files for Claude Code
            (<code>.claude/settings.json</code> + hooks), Cursor (<code>.cursorrules</code>),
            Windsurf (<code>.windsurfrules</code>), and GitHub Copilot
            (<code>.github/copilot-instructions.md</code>). Every agent gets the same
            rules: auto-generate tests, auto-update docs, check branch before coding,
            ask before merging, no AI attribution in commits.
          </p>
        </div>
        <div class="mode-card">
          <div class="rubric">AGENTS.md</div>
          <h3>The machine-readable contract</h3>
          <p>
            Every webjs app ships <code>AGENTS.md</code> with the full API surface,
            directive decision guide, lifecycle hooks, controller patterns, and
            step-by-step recipes. <code>CONVENTIONS.md</code> adds overridable
            project rules. AI agents read both before making any change.
          </p>
        </div>
        <div class="mode-card">
          <div class="rubric">Autonomous mode</div>
          <h3>Sandbox-safe defaults</h3>
          <p>
            In bypass-permissions mode, agents auto-decide: create feature branches,
            rebase before starting, generate meaningful commits, fix failing tests,
            delete feature branches after merge. Same quality bar, with no blocking on questions.
          </p>
        </div>
        <div class="mode-card">
          <div class="rubric">Testing &amp; conventions</div>
          <h3>Quality enforced, not requested</h3>
          <p>
            <code>webjs test</code> runs server + browser tests (WTR + Playwright). <code>webjs check</code>
            validates conventions (actions in modules, components registered, tests exist).
            AI agents run both automatically, so the user never has to ask for tests or docs.
          </p>
        </div>
      </div>
    </section>

    <footer>
      <p>
        <a href="https://github.com/vivek7405/webjs" target="_blank">GitHub</a> ·
        <a href=${DOCS_URL + '/docs/getting-started'} target="_blank">Docs</a> ·
        <a href=${UI_URL} target="_blank">UI</a> ·
        <a href=${DOCS_URL + '/docs/ai-first'} target="_blank">AI-First</a> ·
        <a href=${BLOG_URL} target="_blank">Example Blog</a> ·
        <a href=${STORY_URL} target="_blank" rel="noopener noreferrer">Webjs Story</a>
      </p>
    </footer>
  `;
}
