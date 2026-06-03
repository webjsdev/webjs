import { html } from '@webjsdev/core';
import '../components/copy-cmd.ts';
import { highlight } from '../lib/highlight.ts';

export const metadata = {
  title: 'webjs: the framework your AI agent already knows how to use',
  description: 'AI-first, web-components-first, no-build full-stack framework. File-based routing, server actions, streaming SSR, on web standards. Built for AI agents to read, write, and ship.',
};

const env = (globalThis as any).process?.env ?? {};
const DOCS_URL = env.DOCS_URL || 'https://docs.webjs.com';
const UI_URL = env.UI_URL || 'https://ui.webjs.dev';
const GH_URL = 'https://github.com/webjsdev/webjs';

// No-JS newsletter capture. The closer renders a real `<form method="post">`
// that posts back to this page. With JS off it round-trips natively: this
// action runs server-side, then a 303 Post/Redirect/Get lands on
// `/?subscribed=1` and the page renders the thanks state. With JS on the
// client router enhances the submit into an in-place swap (no reload), and a
// validation failure re-renders this page (422) with the error and the typed
// value preserved. Preview only: no persistence, a real app would store it.
export async function action(ctx: { formData: FormData }) {
  const email = String(ctx.formData?.get('email') || '').trim();
  if (!email || !email.includes('@') || email.length < 3) {
    return { success: false, fieldErrors: { email: 'Please enter a valid email address.' }, values: { email } };
  }
  return { success: true, redirect: '/?subscribed=1#get-updates' };
}

const AGENTS = ['Claude Code', 'Cursor', 'Copilot', 'Antigravity', 'Aider', 'Gemini CLI', 'OpenCode'];

const ICON = {
  bolt: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>`,
  cube: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 7.5 12 3 3 7.5 12 12l9-4.5z"/><path d="M3 7.5v9L12 21V12"/><path d="M21 7.5v9L12 21"/></svg>`,
  layers: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/></svg>`,
  plug: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2v6m6-6v6M7 8h10v3a5 5 0 0 1-10 0V8zm5 8v6"/></svg>`,
  wave: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8c2.5-4 5-4 7.5 0s5 4 7.5 0 3-2 5 0"/><path d="M2 16c2.5-4 5-4 7.5 0s5 4 7.5 0 3-2 5 0"/></svg>`,
  shield: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>`,
};

const PILLARS = [
  { icon: ICON.bolt, title: 'No build step', desc: 'Source files are served as native ES modules. Edit, refresh, see it. TypeScript is stripped by Node 24, no bundler, no compile.' },
  { icon: ICON.cube, title: 'Web components, light DOM', desc: 'A thin reactive base class with html and css tagged templates, signals, and the full lit lifecycle. Light DOM by default so Tailwind just works.' },
  { icon: ICON.layers, title: 'Progressive enhancement', desc: 'Everything renders to real HTML on the server. JavaScript is opt-in per interactive behavior. Dead JS is statically elided and never shipped.' },
  { icon: ICON.plug, title: 'Server actions, rich types', desc: 'Mark a file with use server and import it from the client. Date, Map, Set, BigInt, Blob, and cycles all round-trip through the wire.' },
  { icon: ICON.wave, title: 'Streaming SSR + Suspense', desc: 'Fallbacks flush immediately, deferred data streams in as it resolves. Time to first byte measured in milliseconds.' },
  { icon: ICON.shield, title: 'Built-in essentials', desc: 'Auth, sessions, cache, rate limiting, and WebSockets, with pluggable adapters. The building blocks every app needs, no third-party glue.' },
];

// Reusable warm-gradient text (matches the hero headline accent word).
const GRADTEXT = 'bg-[linear-gradient(105deg,var(--accent),color-mix(in_oklch,var(--accent-live)_72%,var(--fg)))] bg-clip-text text-transparent';

// Framework-weight stats. Measured: gzipped production browser bundle,
// npm package metadata, and framework source line counts. Kept honest
// and comparative against react + react-dom.
const STATS = [
  { big: '~22 KB', label: 'Client runtime, gzipped', sub: 'react + react-dom ship ~99 KB. webjs core is about 4.5x lighter on the wire.' },
  { big: '0', label: 'Runtime dependencies', sub: '@webjsdev/core has none. The whole stack adds only ws, for WebSockets.' },
  { big: '~15k', label: 'Lines of framework code', sub: 'Small enough that an AI agent can read and grep the whole framework, not guess.' },
  { big: 'No build', label: 'Source is the runtime', sub: 'What you read in node_modules is what runs. No bundler, no compile step.' },
];

// Code samples. Plain strings so backticks and ${...} stay literal and never
// enter an html`` body. The SSR highlighter colors them.
const COMPONENT_SAMPLE = [
  "import { WebComponent, html, signal } from '@webjsdev/core';",
  "",
  "class LikeButton extends WebComponent {",
  "  likes = signal(0);",
  "  render() {",
  "    return html`<button @click=${() => this.likes.set(this.likes.get() + 1)}>",
  "      ♥ ${this.likes.get()}",
  "    </button>`;",
  "  }",
  "}",
  "LikeButton.register('like-button');",
].join('\n');

const ACTION_SAMPLE = [
  "'use server';",
  "import { prisma } from '../lib/prisma.server.ts';",
  "",
  "// Import this from a client component. webjs rewrites the",
  "// import into a typed RPC stub. No fetch by hand.",
  "export async function createPost(input) {",
  "  const post = await prisma.post.create({ data: input });",
  "  return { success: true, data: post };",
  "}",
].join('\n');

const PAGE_SAMPLE = [
  "export default async function Post({ params }) {",
  "  const post = await getPost(params.id);",
  "  if (!post) notFound();",
  "  return html`<article>",
  "    <h1>${post.title}</h1>",
  "    <like-button></like-button>",
  "  </article>`;",
  "}",
].join('\n');

const AGENTS_MD = [
  { k: 'h', t: '# AGENTS.md' },
  { k: 'b', t: 'The machine-readable contract every webjs app ships.' },
  { k: 'b', t: '' },
  { k: 'h', t: '## Invariants' },
  { k: 'b', t: '1. Server-only code lives in .server.ts files.' },
  { k: 'b', t: '2. Components register with a hyphenated tag name.' },
  { k: 'b', t: '3. Signals are the default state primitive.' },
  { k: 'b', t: '' },
  { k: 'h', t: '## Code workflow (mandatory)' },
  { k: 'b', t: 'Every change ships with tests, across every layer' },
  { k: 'b', t: 'it touches, plus a webjs check run. Always.' },
];

const TRANSCRIPT = [
  { k: 'cmd', t: 'claude "add a like button to posts"' },
  { k: 'ok', t: 'wrote modules/posts/components/like-button.ts' },
  { k: 'ok', t: 'wrote modules/posts/actions/like.server.ts' },
  { k: 'ok', t: 'wrote modules/posts/actions/like.server.test.ts' },
  { k: 'cmd', t: 'webjs check' },
  { k: 'ok', t: '0 problems' },
  { k: 'cmd', t: 'webjs test' },
  { k: 'ok', t: '7 passing (3 unit, 2 browser, 2 e2e)' },
];

const WIN = 'flex flex-col flex-1 m-0 min-w-0 max-w-full rounded-2xl overflow-hidden border border-border bg-bg-elev shadow-[var(--shadow)]';
const WINBAR = 'flex items-center gap-[7px] px-[14px] py-[10px] border-b border-border bg-[color-mix(in_oklch,var(--color-bg-sunken)_60%,var(--color-bg-elev))]';
const WINNAME = 'ml-2 font-mono font-medium text-[12px] leading-none text-fg-subtle';
const DOTS = html`<span class="w-[11px] h-[11px] rounded-full bg-[#ff5f57]"></span><span class="w-[11px] h-[11px] rounded-full bg-[#febc2e]"></span><span class="w-[11px] h-[11px] rounded-full bg-[#28c840]"></span>`;
const KICKER = 'inline-flex flex-wrap justify-center gap-[10px] font-mono font-semibold text-[12px] leading-[1.4] tracking-[0.18em] uppercase text-accent';
const BTN = 'inline-flex items-center gap-2 px-[22px] py-[13px] rounded-full font-semibold text-[15px] leading-none no-underline border cursor-pointer transition-all duration-[140ms]';
const INSTALL = 'flex items-center gap-2 w-fit max-w-full mx-auto px-[18px] py-[14px] text-left font-mono text-sm leading-[1.6] text-fg-muted rounded-2xl border border-border bg-[color-mix(in_oklch,var(--color-bg-sunken)_70%,transparent)] backdrop-blur-sm shadow-[var(--shadow-sm)]';

function codeWindow(title: string, sample: string) {
  return html`
    <figure class=${WIN}>
      <figcaption class=${WINBAR}>${DOTS}<span class=${WINNAME}>${title}</span></figcaption>
      <pre class="scroll-thin m-0 p-[18px] overflow-x-auto font-mono text-[13px] leading-[1.7] [tab-size:2] flex-1"><code>${highlight(sample)}</code></pre>
    </figure>
  `;
}

export default function LandingPage(ctx: { searchParams?: Record<string, string>; actionData?: any } = {}) {
  const subscribed = ctx.searchParams?.subscribed === '1';
  const emailErr = ctx.actionData?.fieldErrors?.email;
  const emailVal = ctx.actionData?.values?.email || '';
  return html`
    <style>
      .t-com { color: var(--fg-subtle); font-style: italic; }
      .t-str { color: oklch(0.55 0.13 145); }
      .t-kw  { color: oklch(0.55 0.18 25); font-weight: 600; }
      .t-fn  { color: var(--accent); }
      .t-type{ color: oklch(0.55 0.13 250); }
      .t-num { color: oklch(0.58 0.14 70); }
      .t-punc{ color: var(--fg-muted); }
      .t-id  { color: var(--fg); }
      :root[data-theme='dark'] .t-str { color: oklch(0.80 0.15 145); }
      :root[data-theme='dark'] .t-kw  { color: oklch(0.78 0.16 25); }
      :root[data-theme='dark'] .t-type{ color: oklch(0.78 0.13 250); }
      :root[data-theme='dark'] .t-num { color: oklch(0.82 0.14 80); }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme='light']) .t-str { color: oklch(0.80 0.15 145); }
        :root:not([data-theme='light']) .t-kw  { color: oklch(0.78 0.16 25); }
        :root:not([data-theme='light']) .t-type{ color: oklch(0.78 0.13 250); }
        :root:not([data-theme='light']) .t-num { color: oklch(0.82 0.14 80); }
      }
    </style>

    <section class="text-center px-6 pt-[clamp(48px,7vw,96px)] pb-18">
      <div class=${KICKER}>
        <span>AI-first</span><span class="text-fg-subtle">/</span>
        <span>web-components-first</span><span class="text-fg-subtle">/</span>
        <span>no build</span>
      </div>
      <h1 class="font-display font-extrabold text-display leading-[1.04] tracking-[-0.035em] mx-auto mt-6 mb-4 max-w-[16ch] text-balance">
        The framework your <span class="bg-[linear-gradient(105deg,var(--accent),color-mix(in_oklch,var(--accent-live)_72%,var(--fg)))] bg-clip-text text-transparent">AI agent</span> already knows how to use
      </h1>
      <p class="text-lede leading-[1.6] text-fg-muted max-w-[58ch] mx-auto mb-8 text-pretty">
        webjs is built for AI agents from the ground up. Native web components,
        server actions, and streaming SSR, all on web standards. No bundler,
        no config, no guesswork.
      </p>
      <div class="flex gap-3 justify-center flex-wrap mb-8">
        <a class="${BTN} bg-accent text-accent-fg border-transparent shadow-[var(--shadow-glow)] hover:bg-accent-hover hover:-translate-y-0.5" href=${DOCS_URL + '/docs/getting-started'} target="_blank">
          Get started
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
        <a class="${BTN} text-fg border-border-strong bg-[color-mix(in_oklch,var(--color-bg-elev)_60%,transparent)] hover:border-fg-muted hover:-translate-y-0.5" href=${GH_URL} target="_blank">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.58l-.01-2.03c-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.34-1.72-1.34-1.72-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.22 1.84 1.22 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.58-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.23-3.17-.12-.3-.53-1.51.12-3.15 0 0 1-.32 3.3 1.21a11.5 11.5 0 0 1 6 0c2.3-1.53 3.3-1.21 3.3-1.21.65 1.64.24 2.85.12 3.15.77.83 1.23 1.88 1.23 3.17 0 4.53-2.81 5.53-5.49 5.82.43.37.81 1.1.81 2.22l-.01 3.29c0 .33.22.7.83.58A12.01 12.01 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z"/></svg>
          Star on GitHub
        </a>
      </div>
      <div class=${INSTALL}>
        <span class="text-accent select-none">$</span><copy-cmd>npm create webjs@latest my-app</copy-cmd>
      </div>
    </section>

    <section class="py-28">
      <div class="max-w-[1080px] mx-auto px-6">
        <div class="max-w-[720px] mx-auto mb-12 text-center">
          <div class=${KICKER}>Built for agents</div>
          <h2 class="font-display font-bold text-h2 leading-[1.12] tracking-[-0.03em] my-3 text-balance">Your AI writes the code. webjs writes the rules.</h2>
          <p class="text-fg-muted text-[1.05rem] leading-[1.6] m-0">
            Every app ships a machine-readable contract and cross-agent guardrails,
            so the model produces production-quality code without guessing. Tests and
            docs come with every change, enforced, not requested.
          </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          <figure class=${WIN}>
            <figcaption class=${WINBAR}>${DOTS}<span class=${WINNAME}>AGENTS.md</span></figcaption>
            <pre class="m-0 p-[18px] flex-1 font-mono text-[13px] leading-[1.7] whitespace-pre-wrap [overflow-wrap:anywhere]"><code>${AGENTS_MD.map(l => html`<div class=${l.k === 'h' ? 'text-accent font-semibold' : 'text-fg-muted'}>${l.t || ' '}</div>`)}</code></pre>
          </figure>
          <figure class=${WIN}>
            <figcaption class=${WINBAR}>${DOTS}<span class=${WINNAME}>agent session</span></figcaption>
            <pre class="m-0 p-[18px] flex-1 font-mono text-[13px] leading-[1.7] whitespace-pre-wrap [overflow-wrap:anywhere]"><code>${TRANSCRIPT.map(l => l.k === 'cmd'
              ? html`<div class="text-fg"><span class="text-accent">$ </span>${l.t}</div>`
              : html`<div class="text-fg-muted"><span class="text-[oklch(0.66_0.16_150)]">✓ </span>${l.t}</div>`)}</code></pre>
          </figure>
        </div>
        <div class="flex flex-wrap gap-[10px] justify-center mt-8">
          ${AGENTS.map(a => html`<span class="font-mono font-semibold text-[12px] leading-none tracking-[0.04em] uppercase text-accent px-[14px] py-[9px] rounded-full border border-accent-tint bg-accent-tint">${a}</span>`)}
        </div>
      </div>
    </section>

    <section class="py-28">
      <div class="max-w-[1080px] mx-auto px-6">
        <div class="max-w-[720px] mx-auto mb-12 text-center">
          <div class=${KICKER}>Show, don't tell</div>
          <h2 class="font-display font-bold text-h2 leading-[1.12] tracking-[-0.03em] my-3 text-balance">The whole stack, in three files</h2>
          <p class="text-fg-muted text-[1.05rem] leading-[1.6] m-0">A component, a server action, and a page. No build, no boilerplate, all web standards.</p>
        </div>
        <div class="grid gap-4 grid-cols-1 max-w-[560px] mx-auto min-[900px]:grid-cols-3 min-[900px]:max-w-none">
          <div class="flex flex-col min-w-0">
            <p class="font-mono font-semibold text-[11px] leading-[1.4] tracking-[0.12em] uppercase text-fg-subtle mb-[10px] ml-1">Interactive component</p>
            ${codeWindow('components/like-button.ts', COMPONENT_SAMPLE)}
          </div>
          <div class="flex flex-col min-w-0">
            <p class="font-mono font-semibold text-[11px] leading-[1.4] tracking-[0.12em] uppercase text-fg-subtle mb-[10px] ml-1">Server action (RPC)</p>
            ${codeWindow('actions/create-post.server.ts', ACTION_SAMPLE)}
          </div>
          <div class="flex flex-col min-w-0">
            <p class="font-mono font-semibold text-[11px] leading-[1.4] tracking-[0.12em] uppercase text-fg-subtle mb-[10px] ml-1">SSR page</p>
            ${codeWindow('app/posts/[id]/page.ts', PAGE_SAMPLE)}
          </div>
        </div>
      </div>
    </section>

    <section class="py-28">
      <div class="max-w-[1080px] mx-auto px-6">
        <div class="max-w-[720px] mx-auto mb-12 text-center">
          <div class=${KICKER}>Why webjs</div>
          <h2 class="font-display font-bold text-h2 leading-[1.12] tracking-[-0.03em] my-3 text-balance">Modern full-stack, on web standards</h2>
          <p class="text-fg-muted text-[1.05rem] leading-[1.6] m-0">Everything you need to ship, none of the build toolchain you don't.</p>
        </div>
        <div class="grid gap-4 grid-cols-1 min-[560px]:grid-cols-2 min-[900px]:grid-cols-3">
          ${PILLARS.map(p => html`
            <div class="p-6 rounded-2xl border border-border bg-[color-mix(in_oklch,var(--color-bg-elev)_70%,transparent)] transition-[border-color,box-shadow,transform] duration-[240ms] hover:border-border-strong hover:shadow-[var(--shadow)] hover:-translate-y-[3px]">
              <div class="w-10 h-10 grid place-items-center mb-4 rounded-[11px] text-accent bg-accent-tint border border-accent-tint">${p.icon}</div>
              <h3 class="font-display font-bold text-[1.05rem] leading-[1.3] tracking-[-0.01em] mt-0 mb-2">${p.title}</h3>
              <p class="m-0 text-sm leading-[1.6] text-fg-muted">${p.desc}</p>
            </div>
          `)}
        </div>
      </div>
    </section>

    <section class="py-28">
      <div class="max-w-[1080px] mx-auto px-6">
        <div class="max-w-[720px] mx-auto mb-12 text-center">
          <div class=${KICKER}>Small by design</div>
          <h2 class="font-display font-bold text-h2 leading-[1.12] tracking-[-0.03em] my-3 text-balance">Light enough to read, fast enough to ship</h2>
          <p class="text-fg-muted text-[1.05rem] leading-[1.6] m-0">No bundler and no React runtime mean a tiny payload on the wire and a framework you can read end to end. The full source sits in your node_modules; the browser gets a minified bundle.</p>
        </div>
        <div class="grid gap-4 grid-cols-1 min-[560px]:grid-cols-2 min-[900px]:grid-cols-4">
          ${STATS.map(s => html`
            <div class="p-6 text-center rounded-2xl border border-border bg-[color-mix(in_oklch,var(--color-bg-elev)_70%,transparent)] transition-[border-color,box-shadow] duration-[240ms] hover:border-border-strong hover:shadow-[var(--shadow)]">
              <div class="font-display font-extrabold leading-none tracking-[-0.03em] text-[clamp(1.9rem,1.3rem+1.6vw,2.7rem)] ${GRADTEXT}">${s.big}</div>
              <div class="mt-3 font-semibold text-[0.95rem]">${s.label}</div>
              <p class="mt-1.5 m-0 text-[13px] leading-[1.55] text-fg-muted">${s.sub}</p>
            </div>
          `)}
        </div>
        <p class="mt-8 mx-auto max-w-[680px] text-center text-[1.02rem] leading-[1.6] text-fg-muted">Familiar from day one. webjs uses Next.js-style file routing and lit-style web components, the proven ergonomics you and your AI agents already have the muscle memory for.</p>
        <p class="mt-6 mx-auto max-w-[680px] text-center text-fg-subtle text-[12px] leading-[1.5]">Gzipped production sizes. <code class="font-mono">@webjsdev/core</code> is ~0.9 MB unpacked vs ~7.5 MB for react + react-dom, and the framework source is about 5% of Next.js's. JSDoc-typed JavaScript, no build step.</p>
      </div>
    </section>

    <section class="py-28">
      <div class="max-w-[1080px] mx-auto px-6">
        <div class="max-w-[720px] mx-auto mb-12 text-center">
          <div class=${KICKER}>One framework, three templates</div>
          <h2 class="font-display font-bold text-h2 leading-[1.12] tracking-[-0.03em] my-3 text-balance">Start where you are</h2>
        </div>
        <div class="grid gap-4 grid-cols-1 max-w-[560px] mx-auto min-[900px]:grid-cols-3 min-[900px]:max-w-none">
          <div class="flex flex-col gap-3 p-6 min-w-0 rounded-2xl border border-border bg-bg-elev">
            <span class="font-mono font-semibold text-[10px] leading-none tracking-[0.16em] uppercase text-accent">Full-stack</span>
            <h3 class="font-display font-bold text-[1.15rem] leading-[1.25] m-0">Pages + API + components</h3>
            <p class="m-0 flex-1 text-[13.5px] leading-[1.6] text-fg-muted">SSR pages, web components, server actions, Prisma, auth, and streaming. The default.</p>
            <pre class="scroll-thin m-0 px-[14px] py-3 overflow-x-auto rounded-[10px] border border-border bg-bg-sunken font-mono text-[12px] leading-[1.6] text-fg-muted">app/page.ts
components/counter.ts
actions/posts.server.ts</pre>
            <div class="font-mono text-[12.5px] leading-[1.6] text-fg-muted max-w-full min-w-0"><copy-cmd>npm create webjs@latest my-app</copy-cmd></div>
          </div>
          <div class="flex flex-col gap-3 p-6 min-w-0 rounded-2xl border border-border bg-bg-elev">
            <span class="font-mono font-semibold text-[10px] leading-none tracking-[0.16em] uppercase text-accent">API only</span>
            <h3 class="font-display font-bold text-[1.15rem] leading-[1.25] m-0">Just route handlers</h3>
            <p class="m-0 flex-1 text-[13.5px] leading-[1.6] text-fg-muted">Skip pages. File-based routing, middleware, rate limiting, and WebSockets. Zero frontend.</p>
            <pre class="scroll-thin m-0 px-[14px] py-3 overflow-x-auto rounded-[10px] border border-border bg-bg-sunken font-mono text-[12px] leading-[1.6] text-fg-muted">app/api/users/route.ts
app/api/chat/route.ts
middleware.ts</pre>
            <div class="font-mono text-[12.5px] leading-[1.6] text-fg-muted max-w-full min-w-0"><copy-cmd>npm create webjs@latest my-api -- --template api</copy-cmd></div>
          </div>
          <div class="flex flex-col gap-3 p-6 min-w-0 rounded-2xl border border-border bg-bg-elev">
            <span class="font-mono font-semibold text-[10px] leading-none tracking-[0.16em] uppercase text-accent">SaaS</span>
            <h3 class="font-display font-bold text-[1.15rem] leading-[1.25] m-0">Auth + dashboard</h3>
            <p class="m-0 flex-1 text-[13.5px] leading-[1.6] text-fg-muted">Login, signup, sessions, a protected dashboard, and a User model wired up out of the box.</p>
            <pre class="scroll-thin m-0 px-[14px] py-3 overflow-x-auto rounded-[10px] border border-border bg-bg-sunken font-mono text-[12px] leading-[1.6] text-fg-muted">app/(auth)/login/page.ts
app/dashboard/page.ts
lib/session.server.ts</pre>
            <div class="font-mono text-[12.5px] leading-[1.6] text-fg-muted max-w-full min-w-0"><copy-cmd>npm create webjs@latest my-saas -- --template saas</copy-cmd></div>
          </div>
        </div>
      </div>
    </section>

    <section class="py-28 text-center" id="get-updates">
      <div class="max-w-[1080px] mx-auto px-6">
        <div class="max-w-[760px] mx-auto p-[clamp(32px,5vw,64px)] rounded-[22px] border border-border-strong bg-[color-mix(in_oklch,var(--accent-live)_7%,var(--color-bg-elev))] shadow-[var(--shadow-glow)]">
          <h2 class="font-display font-extrabold text-h2 leading-[1.1] tracking-[-0.03em] mt-0 mb-3">Ship a feature with the tests already written</h2>
          <p class="text-fg-muted mx-auto mb-8 max-w-[46ch]">Scaffold a full-stack app in one command, point your agent at it, and go.</p>
          <div class=${INSTALL}>
            <span class="text-accent select-none">$</span><copy-cmd>npm create webjs@latest my-app</copy-cmd>
          </div>
          ${subscribed
            ? html`
                <p class="inline-flex items-center gap-[9px] mt-6 px-[22px] py-[13px] rounded-full font-semibold text-[15px] leading-none text-accent border border-accent-tint bg-accent-tint">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                  Thanks. You are on the list.
                </p>`
            : html`
                <form class="flex gap-[10px] justify-center flex-wrap mt-6" method="post" action="/">
                  <input type="email" name="email" required placeholder="you@company.com" aria-label="Email for updates" value=${emailVal}
                    class="px-4 py-3 min-w-[240px] rounded-full border border-border-strong bg-bg text-fg font-sans text-sm leading-none focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)]">
                  <button class="${BTN} bg-accent text-accent-fg border-transparent shadow-[var(--shadow-glow)] hover:bg-accent-hover hover:-translate-y-0.5" type="submit">Keep me posted</button>
                  ${emailErr
                    ? html`<span class="w-full font-mono text-[12px] leading-[1.5] text-[oklch(0.64_0.2_25)] mt-1">${emailErr}</span>`
                    : html`<span class="w-full font-mono text-[12px] leading-[1.5] text-fg-subtle mt-1">No spam. Just shipping updates.</span>`}
                </form>`}
        </div>
      </div>
    </section>

    <footer class="mt-28 border-t border-border py-12 px-6">
      <div class="max-w-[1080px] mx-auto flex items-center justify-between gap-6 flex-wrap">
        <a class="inline-flex items-center gap-[9px] no-underline text-fg font-display font-extrabold text-base leading-none tracking-[-0.02em]" href="/">
          <span class="w-5 h-5 rounded-md bg-gradient-to-br from-accent-live to-[color-mix(in_oklch,var(--accent-live)_55%,var(--fg))]"></span>webjs
        </a>
        <nav class="flex gap-4 flex-wrap">
          <a class="text-fg-muted no-underline text-[13.5px] hover:text-accent" href=${GH_URL} target="_blank">GitHub</a>
          <a class="text-fg-muted no-underline text-[13.5px] hover:text-accent" href=${DOCS_URL + '/docs/getting-started'} target="_blank">Docs</a>
          <a class="text-fg-muted no-underline text-[13.5px] hover:text-accent" href=${UI_URL} target="_blank">UI</a>
          <a class="text-fg-muted no-underline text-[13.5px] hover:text-accent" href="/blog">Blog</a>
          <a class="text-fg-muted no-underline text-[13.5px] hover:text-accent" href="/changelog">Changelog</a>
        </nav>
      </div>
      <div class="w-full text-center mt-6 text-fg-subtle text-[12.5px]">Built with webjs. No build step, no bundler, served as native ES modules.</div>
    </footer>
  `;
}
