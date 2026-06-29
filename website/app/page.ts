import { html } from '@webjsdev/core';
import '#components/copy-cmd.ts';
import '#components/code-showcase.ts';
import { DOCS_URL, UI_URL, EXAMPLE_BLOG_URL, GH_URL, NEW_TAB } from '#lib/links.ts';
import { highlight } from '#lib/highlight.ts';
import { PE_COMPONENT, SSR_OUTPUT } from '#lib/samples.ts';

const ICON = {
  bolt: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>`,
  cube: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 7.5 12 3 3 7.5 12 12l9-4.5z"/><path d="M3 7.5v9L12 21V12"/><path d="M21 7.5v9L12 21"/></svg>`,
  layers: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/></svg>`,
  plug: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2v6m6-6v6M7 8h10v3a5 5 0 0 1-10 0V8zm5 8v6"/></svg>`,
  wave: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8c2.5-4 5-4 7.5 0s5 4 7.5 0 3-2 5 0"/><path d="M2 16c2.5-4 5-4 7.5 0s5 4 7.5 0 3-2 5 0"/></svg>`,
  shield: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>`,
};

const PILLARS = [
  { icon: ICON.bolt, title: 'No build step', desc: 'Source files are served as native ES modules. Edit, refresh, see it. TypeScript is stripped by the runtime, no bundler, no compile. Runs on Node 24+ or Bun (scaffold a Bun app with bun create webjs, run it with bun --bun run dev).' },
  { icon: ICON.cube, title: 'Web components, light DOM', desc: 'A thin reactive base class with html and css tagged templates, signals, and the full lit lifecycle. Light DOM by default so Tailwind just works.' },
  { icon: ICON.layers, title: 'Progressive enhancement', desc: 'Everything renders to real HTML on the server. JavaScript is opt-in per interactive behavior. Dead JS is statically elided and never shipped.' },
  { icon: ICON.plug, title: 'Server actions, rich types', desc: 'Mark a file with use server and import it from the client. Date, Map, Set, BigInt, Blob, and cycles all round-trip through the wire.' },
  { icon: ICON.wave, title: 'Async render + streaming Suspense', desc: 'A component awaits its own server data into the first paint, co-located, no prop-drilling. Wrap a slow region in webjs-suspense to stream it, fallback first, data after, progressively on navigation too.' },
  { icon: ICON.shield, title: 'Built-in essentials', desc: 'Auth, sessions, cache, rate limiting, and WebSockets, with pluggable adapters. The building blocks every app needs, no third-party glue.' },
];



const STATS = [
  { big: '~29 KB', label: 'Client runtime, gzipped', sub: 'A minimal Next.js client bundle is ~99 KB gzipped including React. WebJs is completely self-sufficient at ~29 KB gzipped, 3.4x lighter on the wire.' },
  { big: '0 build', label: 'Instant Agent Loops', sub: 'No compilation or bundlers. AI agents can execute edits, run tests, and verify outputs in browser in milliseconds.' },
  { big: 'Standards', label: 'Web Components', sub: 'AI models write components reliably because they target standard-aligned Web Component lifecycles.' },
  { big: 'Context', label: 'LLM Context Friendly', sub: 'With under 6.5k lines of client runtime code and ~16k LOC for the entire client + server codebase, excluding comments, the stack fits inside any LLM context window.' },
];

const PE_CHIPS = ['No hydration runtime', 'Content reads', 'Links navigate', 'Forms submit', 'Display components ship 0 KB'];

const WIN = 'flex flex-col flex-1 m-0 min-w-0 max-w-full rounded-2xl overflow-hidden border border-[var(--editor-border)] bg-[var(--editor-bg)] shadow-2xl';
const WINBAR = 'flex items-center gap-[7px] px-[14px] py-[10px] border-b border-[var(--editor-border)] bg-[var(--editor-tab-bg)]';
const WINNAME = 'ml-2 font-mono font-medium text-[12px] leading-none text-fg-subtle';
const DOTS = html`<span class="w-[11px] h-[11px] rounded-full bg-[#ff5f57]"></span><span class="w-[11px] h-[11px] rounded-full bg-[#febc2e]"></span><span class="w-[11px] h-[11px] rounded-full bg-[#28c840]"></span>`;
const KICKER = 'inline-flex flex-wrap justify-center gap-[10px] font-mono font-semibold text-[12px] leading-[1.4] tracking-[0.18em] uppercase text-accent';

function codeWindow(title: string, sample: string, badge?: string) {
  return html`
    <figure class=${WIN}>
      <figcaption class=${WINBAR}>
        ${DOTS}
        <span class=${WINNAME}>${title}</span>
        ${badge ? html`<span class="ml-auto text-[9px] font-mono font-extrabold tracking-wider uppercase px-2 py-0.5 rounded bg-white/5 border border-white/10 text-fg-subtle">${badge}</span>` : ''}
      </figcaption>
      <pre class="scroll-thin m-0 p-[18px] overflow-x-auto font-mono text-[13px] leading-[1.7] [tab-size:2] flex-1 text-fg-muted" tabindex="0" aria-label=${title + ' code sample'}><code>${highlight(sample)}</code></pre>
    </figure>
  `;
}

export default function LandingPage() {
  return html`
    <style>
      .t-com { color: var(--fg-subtle); font-style: italic; }
      .t-str { color: var(--code-str); }
      .t-kw  { color: var(--code-kw); font-weight: 600; }
      .t-fn  { color: var(--code-fn); }
      .t-type{ color: var(--code-type); }
      .t-num { color: var(--code-num); }
      .t-ok  { color: var(--code-ok); }
      .t-punc{ color: var(--code-punc); }
      .t-id  { color: var(--code-text); }
    </style>

    <main id="main" tabindex="-1" class="focus:outline-none relative z-10">
      <!-- Hero Section -->
      <section class="text-center px-6 pt-[clamp(64px,9vw,120px)] pb-16 md:pb-24 max-w-[1200px] mx-auto">
        <div class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-border bg-bg-elev/40 backdrop-blur-md text-xs font-semibold text-fg hover:border-zinc-700 hover:bg-bg-subtle transition-all cursor-pointer mb-6 select-none shadow-[var(--shadow-sm)] active:scale-95">
          <span class="bg-fg text-bg text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full leading-none">New</span>
          <span>Introducing webjs redesign: built for standard web speed</span>
          <svg class="w-3.5 h-3.5 text-fg-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </div>
        
        <h1 class="font-display font-black text-[clamp(2.8rem,6vw,5.5rem)] leading-[1.02] tracking-[-0.04em] max-w-[16ch] mx-auto mt-2 mb-6 text-balance text-fg">
          Build on the web platform
        </h1>
        
        <p class="text-lede leading-relaxed text-fg-muted max-w-[62ch] mx-auto mb-10 text-pretty">
          WebJs is a full-stack framework for the AI era built on web components,
          SSR, and progressive enhancement, with zero build step. Standards that
          outlast frameworks. Fits inside any LLM context window with zero-build
          code that AI agents can read end-to-end directly from node_modules. Runs
          on Node 24+ or Bun.
        </p>
        
        <div class="flex gap-4 justify-center flex-wrap mb-10">
          <a class="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-fg text-bg hover:bg-fg-muted hover:shadow-[0_0_25px_rgba(255,255,255,0.18)] transition-all active:scale-[0.97] shadow-[var(--shadow)]" href=${DOCS_URL + '/docs/getting-started'} target="_blank" rel="noopener noreferrer">
            Get started
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>${NEW_TAB}
          </a>
          <a class="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm border border-border bg-bg-subtle/30 backdrop-blur-sm text-fg hover:border-border-strong hover:bg-bg-sunken/55 transition-all active:scale-[0.97]" href=${DOCS_URL + '/docs/components'} target="_blank" rel="noopener noreferrer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 7.5 12 3 3 7.5 12 12l9-4.5z"/><path d="M3 7.5v9L12 21V12"/><path d="M21 7.5v9L12 21"/></svg>
            Why web components${NEW_TAB}
          </a>
        </div>

        <div class="flex justify-center">
          <div class="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border bg-bg-elev/40 backdrop-blur-sm font-mono text-sm text-fg-muted w-fit max-w-full select-all shadow-[var(--shadow-sm)]">
            <span class="text-accent select-none" aria-hidden="true">$</span><copy-cmd>npm create webjs@latest my-app</copy-cmd>
          </div>
        </div>

        <div class="mt-20 border-t border-border/40 pt-10">
          <p class="text-[9px] font-bold uppercase tracking-[0.25em] text-fg-subtle mb-6">BUILT FOR THE MODERN WEB STANDARDS PLATFORM</p>
          <div class="flex flex-wrap gap-x-12 gap-y-6 justify-center items-center text-fg-subtle opacity-50 hover:opacity-85 transition-opacity duration-300 select-none">
            <span class="font-display font-extrabold text-[12px] tracking-widest uppercase">HTML5</span>
            <span class="font-display font-extrabold text-[12px] tracking-widest uppercase">CSS3</span>
            <span class="font-display font-extrabold text-[12px] tracking-widest uppercase">ES Modules</span>
            <span class="font-display font-extrabold text-[12px] tracking-widest uppercase">Web Components</span>
            <span class="font-display font-extrabold text-[12px] tracking-widest uppercase">Node.js</span>
            <span class="font-display font-extrabold text-[12px] tracking-widest uppercase">Bun</span>
          </div>
        </div>
      </section>

      <!-- Code Showcase Section -->
      <section class="py-16 md:py-24 border-t border-border bg-bg-subtle/20">
        <div class="max-w-[1000px] mx-auto px-6">
          <div class="max-w-[720px] mx-auto mb-12 text-center">
            <div class=${KICKER}>Show, don't tell</div>
            <h2 class="font-display font-black text-3xl sm:text-4xl leading-tight tracking-tight my-3 text-balance">The whole stack, in three files</h2>
            <p class="text-fg-muted text-sm sm:text-base leading-relaxed m-0">An interactive component, a server action, and a page. Zero build, zero boilerplate, all web standards.</p>
          </div>
          <code-showcase></code-showcase>
        </div>
      </section>

      <!-- Progressive Enhancement Section -->
      <section class="py-16 md:py-24 border-t border-border">
        <div class="max-w-[1080px] mx-auto px-6">
          <div class="max-w-[720px] mx-auto mb-12 text-center">
            <div class=${KICKER}>Progressive enhancement</div>
            <h2 class="font-display font-black text-3xl sm:text-4xl leading-tight tracking-tight my-3 text-balance">Real HTML first. JavaScript only when it earns it.</h2>
            <p class="text-fg-muted text-sm sm:text-base leading-relaxed m-0">
              Pages and components render to real HTML on the server, so the page
              reads, links navigate, and forms submit before a single script loads.
              There is no hydration runtime to pay for, and dead JavaScript is
              statically elided, never shipped.
            </p>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div class="flex flex-col min-w-0">
              <p class="font-mono font-semibold text-[11px] leading-[1.4] tracking-[0.12em] uppercase text-fg-subtle mb-[10px] ml-1">The component you write</p>
              ${codeWindow('components/like-button.ts', PE_COMPONENT, 'TypeScript Source')}
            </div>
            <div class="flex flex-col min-w-0">
              <p class="font-mono font-semibold text-[11px] leading-[1.4] tracking-[0.12em] uppercase text-fg-subtle mb-[10px] ml-1">What the browser receives (JS off)</p>
              ${codeWindow('view-source', SSR_OUTPUT, '0 KB JavaScript')}
            </div>
          </div>
          <div class="flex flex-wrap gap-[10px] justify-center mt-8">
            ${PE_CHIPS.map(c => html`<span class="font-mono font-semibold text-[11px] leading-none tracking-[0.04em] uppercase text-fg px-[14px] py-[9px] rounded-full border border-border bg-bg-elev/40 backdrop-blur-sm shadow-[var(--shadow-sm)] hover:border-zinc-700 hover:bg-bg-subtle transition-all duration-[140ms]">${c}</span>`)}
          </div>
        </div>
      </section>

      <!-- Bento Grid (Why webjs) -->
      <section class="py-16 md:py-24 border-t border-border bg-bg-subtle/30">
        <div class="max-w-[1080px] mx-auto px-6">
          <div class="max-w-[720px] mx-auto mb-16 text-center">
            <div class=${KICKER}>Why webjs</div>
            <h2 class="font-display font-black text-3xl sm:text-4xl leading-tight tracking-tight my-3 text-balance">Modern full-stack, on web standards</h2>
            <p class="text-fg-muted text-sm sm:text-base leading-relaxed m-0">Everything you need to ship, none of the build toolchain you don't.</p>
          </div>
          <div class="grid gap-px overflow-hidden rounded-2xl border border-border bg-border grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 shadow-[var(--shadow-sm)]">
            
            <!-- Widget 1: Zero Build -->
            <div class="group p-6 bg-bg hover:bg-bg-subtle/30 transition-all duration-200 flex flex-col justify-between h-full">
              <div class="mb-6">
                <h3 class="font-display font-bold text-[1.05rem] leading-[1.3] tracking-[-0.02em] mt-0 mb-2">Zero Build Step</h3>
                <p class="m-0 text-xs sm:text-sm leading-[1.6] text-fg-muted">Source files run directly in Node or Bun. Save a file, refresh the browser instantly. No compilation, no bundler overhead.</p>
              </div>
              <div class="bg-[var(--editor-sidebar-bg)] border border-[var(--editor-border)] rounded-xl p-3.5 font-mono text-[11px] leading-[1.6] text-[var(--editor-fg)]">
                <div class="flex items-center gap-1.5 text-fg-subtle mb-2 border-b border-[var(--editor-border)] pb-1.5 select-none">
                  <span class="w-2 h-2 rounded-full bg-green-500"></span>
                  <span>bun dev</span>
                </div>
                <div>
                  <span class="text-fg-subtle">$</span> bun run dev<br>
                  <span class="text-fg-subtle">Ready on http://localhost:5001</span><br>
                  <span class="text-green-600 dark:text-green-400">⚡ page.ts reloaded in 3ms</span>
                </div>
              </div>
            </div>

            <!-- Widget 2: Web Components -->
            <div class="group p-6 bg-bg hover:bg-bg-subtle/30 transition-all duration-200 flex flex-col justify-between h-full">
              <div class="mb-6">
                <h3 class="font-display font-bold text-[1.05rem] leading-[1.3] tracking-[-0.02em] mt-0 mb-2">Light DOM Web Components</h3>
                <p class="m-0 text-xs sm:text-sm leading-[1.6] text-fg-muted">Standard Lit-like component lifecycle, but rendering to Light DOM. CSS utilities like Tailwind styling just work naturally.</p>
              </div>
              <div class="bg-[var(--editor-sidebar-bg)] border border-[var(--editor-border)] rounded-xl p-3.5 font-mono text-[11px] leading-[1.5] select-none text-[var(--editor-fg)]">
                <div class="text-[var(--code-punc)]">&lt;<span class="text-[var(--code-tag)]">like-button</span>&gt;</div>
                <div class="pl-4 text-[var(--code-punc)]">&lt;<span class="text-[var(--code-tag)]">button</span> <span class="text-[var(--code-attr)]">class</span>=<span class="text-[var(--code-str)]">"text-white bg-black"</span>&gt;</div>
                <div class="pl-8 text-[var(--code-text)]">Like</div>
                <div class="pl-4 text-[var(--code-punc)]">&lt;/<span class="text-[var(--code-tag)]">button</span>&gt;</div>
                <div class="text-[var(--code-punc)]">&lt;/<span class="text-[var(--code-tag)]">like-button</span>&gt;</div>
              </div>
            </div>

            <!-- Widget 3: Server Actions -->
            <div class="group p-6 bg-bg hover:bg-bg-subtle/30 transition-all duration-200 flex flex-col justify-between h-full">
              <div class="mb-6">
                <h3 class="font-display font-bold text-[1.05rem] leading-[1.3] tracking-[-0.02em] mt-0 mb-2">Server Actions (RPC)</h3>
                <p class="m-0 text-xs sm:text-sm leading-[1.6] text-fg-muted">Mark a file with <code>"use server"</code> and import it. All complex types (Map, Set, BigInt, Blob) serialize cleanly across the wire.</p>
              </div>
              <div class="bg-[var(--editor-sidebar-bg)] border border-[var(--editor-border)] rounded-xl p-3.5 flex items-center justify-between text-[10px] font-mono select-none text-[var(--editor-fg)]">
                <div class="text-fg-subtle px-2 py-1 bg-[var(--editor-bg)] rounded border border-[var(--editor-border)]">Client View</div>
                <div class="flex-1 flex items-center justify-center relative">
                  <span class="h-px bg-[var(--editor-border)] flex-1 mx-2"></span>
                  <span class="absolute text-[8px] bg-[var(--editor-sidebar-bg)] text-fg-subtle px-1 border border-[var(--editor-border)] rounded">RPC</span>
                </div>
                <div class="text-fg-subtle px-2 py-1 bg-[var(--editor-bg)] rounded border border-[var(--editor-border)]">Server Action</div>
              </div>
            </div>

            <!-- Widget 4: Streaming Suspense -->
            <div class="group p-6 bg-bg hover:bg-bg-subtle/30 transition-all duration-200 flex flex-col justify-between h-full">
              <div class="mb-6">
                <h3 class="font-display font-bold text-[1.05rem] leading-[1.3] tracking-[-0.02em] mt-0 mb-2">Streaming Suspense</h3>
                <p class="m-0 text-xs sm:text-sm leading-[1.6] text-fg-muted">Stream slow regions progressively. The shell paints instantly, fallbacks render, and async data fills in as it resolves.</p>
              </div>
              <div class="bg-[var(--editor-sidebar-bg)] border border-[var(--editor-border)] rounded-xl p-3.5 flex flex-col gap-2 text-[var(--editor-fg)]">
                <div class="h-3 w-1/3 bg-[var(--editor-border)] rounded animate-pulse"></div>
                <div class="h-8 w-full bg-[var(--editor-bg)] rounded border border-[var(--editor-border)] flex items-center px-3 gap-2 select-none">
                  <span class="w-1.5 h-1.5 rounded-full bg-fg-subtle animate-ping"></span>
                  <span class="text-[9px] font-mono text-fg-subtle">Streaming data chunk...</span>
                </div>
              </div>
            </div>

            <!-- Widget 5: Progressive Enhancement -->
            <div class="group p-6 bg-bg hover:bg-bg-subtle/30 transition-all duration-200 flex flex-col justify-between h-full">
              <div class="mb-6">
                <h3 class="font-display font-bold text-[1.05rem] leading-[1.3] tracking-[-0.02em] mt-0 mb-2">Progressive Enhancement</h3>
                <p class="m-0 text-xs sm:text-sm leading-[1.6] text-fg-muted">Real HTML first. Links navigate, forms submit, and pages read before JavaScript loads. No hydration overhead.</p>
              </div>
              <div class="bg-[var(--editor-sidebar-bg)] border border-[var(--editor-border)] rounded-xl p-3.5 flex flex-wrap gap-1.5 justify-center select-none text-[var(--editor-fg)]">
                <span class="px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-[9px] font-mono rounded">No Hydration Lock</span>
                <span class="px-2 py-1 bg-[var(--editor-bg)] border border-[var(--editor-border)] text-fg-subtle text-[9px] font-mono rounded">Static Elision</span>
              </div>
            </div>

            <!-- Widget 6: Built-in Essentials -->
            <div class="group p-6 bg-bg hover:bg-bg-subtle/30 transition-all duration-200 flex flex-col justify-between h-full">
              <div class="mb-6">
                <h3 class="font-display font-bold text-[1.05rem] leading-[1.3] tracking-[-0.02em] mt-0 mb-2">Built-in Essentials</h3>
                <p class="m-0 text-xs sm:text-sm leading-[1.6] text-fg-muted">Auth, sessions, cache, rate limits, and websockets are built right in. Pluggable adapters, zero glue.</p>
              </div>
              <div class="bg-[var(--editor-sidebar-bg)] border border-[var(--editor-border)] rounded-xl p-2.5 flex flex-col gap-1.5 font-mono text-[9px] text-[var(--editor-fg)] select-none">
                <div class="flex justify-between items-center px-2 py-1 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded"><span>Auth & Sessions</span> <span class="text-green-500">✓</span></div>
                <div class="flex justify-between items-center px-2 py-1 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded"><span>Rate Limiting</span> <span class="text-green-500">✓</span></div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <!-- Stats Section -->
      <section class="py-16 md:py-24 border-t border-border">
        <div class="max-w-[1080px] mx-auto px-6">
          <div class="max-w-[720px] mx-auto mb-16 text-center">
            <div class=${KICKER}>Small by design</div>
            <h2 class="font-display font-black text-3xl sm:text-4xl leading-tight tracking-tight my-3 text-balance">Light enough for AI</h2>
            <p class="text-fg-muted text-sm sm:text-base leading-relaxed m-0">A zero build step means your source code is what runs directly in the browser. Because the framework itself ships without compilation layers, AI agents can read and understand the entire webjs source code end-to-end directly from node_modules.</p>
          </div>
          
          <div class="grid gap-px bg-border grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-2xl border border-border overflow-hidden shadow-xl">
            ${STATS.map(s => html`
              <div class="p-8 text-center bg-bg-elev hover:bg-bg-subtle/30 transition-colors">
                <div class="font-display font-extrabold leading-none tracking-[-0.03em] text-[clamp(1.9rem,1.3rem+1.6vw,2.7rem)] text-fg">${s.big}</div>
                <div class="mt-3 font-semibold text-[0.95rem] text-fg">${s.label}</div>
                <p class="mt-1.5 m-0 text-[13px] leading-[1.55] text-fg-muted">${s.sub}</p>
              </div>
            `)}
          </div>
          
          <p class="mt-12 mx-auto max-w-[680px] text-center text-sm sm:text-base leading-relaxed text-fg-muted">Familiar from day one. WebJs uses Next.js style file-based routing and lit-style web components, conventions AI agents already know.</p>
          <p class="mt-6 mx-auto max-w-[680px] text-center text-fg-subtle text-[11px] leading-relaxed">Gzipped production sizes. While a Next.js app ships a client bundle of ~340 KB unpacked (~99 KB gzipped) containing react, react-dom, and Next.js's own runtime, <code class="font-mono">@webjsdev/core</code> is entirely self-sufficient at 91 KB unpacked (~29 KB gzipped) with zero external runtime dependencies and no build step.</p>
        </div>
      </section>

      <!-- Templates Section -->
      <section class="py-16 md:py-24 border-t border-border bg-bg-subtle/20" id="templates">
        <div class="max-w-[1080px] mx-auto px-6">
          <div class="max-w-[720px] mx-auto mb-16 text-center">
            <div class=${KICKER}>One framework, three templates</div>
            <h2 class="font-display font-black text-3xl sm:text-4xl leading-tight tracking-tight my-3 text-balance">Start where you are</h2>
          </div>
          <div class="grid gap-6 grid-cols-1 max-w-[560px] mx-auto min-[900px]:grid-cols-3 min-[900px]:max-w-none">
            <div class="flex flex-col gap-4 p-6 min-w-0 rounded-2xl border border-border bg-bg-elev/40 backdrop-blur-md hover:border-zinc-700 hover:bg-bg-elev/80 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.15)] shadow-[var(--shadow-sm)]">
              <span class="font-mono font-bold text-[10px] leading-none tracking-[0.16em] uppercase text-fg-subtle">Full-stack</span>
              <h3 class="font-display font-bold text-[1.15rem] leading-[1.25] m-0">Pages + API + components</h3>
              <p class="m-0 text-xs sm:text-sm leading-[1.6] text-fg-muted">SSR pages, web components, server actions, Drizzle, auth, and streaming. The default.</p>
              <pre class="scroll-thin m-0 px-[14px] py-3 overflow-x-auto rounded-lg border border-border bg-bg-sunken font-mono text-[12px] leading-[1.6] text-fg-muted" tabindex="0" aria-label="Example files">app/page.ts
components/counter.ts
actions/posts.server.ts</pre>
              <div class="cmd-foot pt-2 mt-auto font-mono text-[12.5px] leading-[1.6] text-fg-muted max-w-full min-w-0"><copy-cmd>npm create webjs@latest my-app</copy-cmd></div>
            </div>
            
            <div class="flex flex-col gap-4 p-6 min-w-0 rounded-2xl border border-border bg-bg-elev/40 backdrop-blur-md hover:border-zinc-700 hover:bg-bg-elev/80 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.15)] shadow-[var(--shadow-sm)]">
              <span class="font-mono font-bold text-[10px] leading-none tracking-[0.16em] uppercase text-fg-subtle">API only</span>
              <h3 class="font-display font-bold text-[1.15rem] leading-[1.25] m-0">Just route handlers</h3>
              <p class="m-0 text-xs sm:text-sm leading-[1.6] text-fg-muted">Skip pages. File-based routing, middleware, rate limiting, and WebSockets. Zero frontend.</p>
              <pre class="scroll-thin m-0 px-[14px] py-3 overflow-x-auto rounded-lg border border-border bg-bg-sunken font-mono text-[12px] leading-[1.6] text-fg-muted" tabindex="0" aria-label="Example files">app/api/users/route.ts
app/api/chat/route.ts
middleware.ts</pre>
              <div class="cmd-foot pt-2 mt-auto font-mono text-[12.5px] leading-[1.6] text-fg-muted max-w-full min-w-0"><copy-cmd>npm create webjs@latest my-api -- --template api</copy-cmd></div>
            </div>
            
            <div class="flex flex-col gap-4 p-6 min-w-0 rounded-2xl border border-border bg-bg-elev/40 backdrop-blur-md hover:border-zinc-700 hover:bg-bg-elev/80 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.15)] shadow-[var(--shadow-sm)]">
              <span class="font-mono font-bold text-[10px] leading-none tracking-[0.16em] uppercase text-fg-subtle">SaaS</span>
              <h3 class="font-display font-bold text-[1.15rem] leading-[1.25] m-0">Auth + dashboard</h3>
              <p class="m-0 text-xs sm:text-sm leading-[1.6] text-fg-muted">Login, signup, sessions, a protected dashboard, and a User model wired up out of the box.</p>
              <pre class="scroll-thin m-0 px-[14px] py-3 overflow-x-auto rounded-lg border border-border bg-bg-sunken font-mono text-[12px] leading-[1.6] text-fg-muted" tabindex="0" aria-label="Example files">app/(auth)/login/page.ts
app/dashboard/page.ts
lib/session.server.ts</pre>
              <div class="cmd-foot pt-2 mt-auto font-mono text-[12.5px] leading-[1.6] text-fg-muted max-w-full min-w-0"><copy-cmd>npm create webjs@latest my-saas -- --template saas</copy-cmd></div>
            </div>
          </div>
          <p class="mt-10 mx-auto max-w-[680px] text-center text-fg-subtle text-xs sm:text-sm leading-relaxed">Prefer Bun? Add <code class="font-mono bg-bg-subtle border border-border px-1.5 py-0.5 rounded text-fg">--runtime bun</code> to any template, or run <code class="font-mono bg-bg-subtle border border-border px-1.5 py-0.5 rounded text-fg">bun create webjs my-app</code> to flavor the scaffold for Bun automatically.</p>
        </div>
      </section>

      <!-- Get Started Banner -->
      <section class="py-20 text-center" id="get-started">
        <div class="max-w-[1080px] mx-auto px-6">
          <div class="max-w-[760px] mx-auto p-[clamp(32px,6vw,64px)] rounded-[24px] border border-border-strong bg-gradient-to-b from-bg-elev to-bg-subtle shadow-2xl relative overflow-hidden">
            <div class="absolute inset-0 bg-radial-gradient(circle at 50% 0%, var(--accent-tint) 0%, transparent 60%) pointer-events-none opacity-40"></div>
            <div class="relative z-10">
              <h2 class="font-display font-black text-3xl sm:text-4xl leading-tight tracking-tight mt-0 mb-3 text-fg">Start building on the platform</h2>
              <p class="text-fg-muted mx-auto mb-8 max-w-[46ch] text-sm sm:text-base leading-relaxed">Scaffold a full-stack app in one command, with pages, an API, components, and a database wired up.</p>
              <div class="flex items-center gap-2.5 w-fit max-w-full mx-auto px-4 py-3 text-left font-mono text-sm leading-[1.6] text-fg-muted rounded-xl border border-border bg-bg-sunken mb-8">
                <span class="text-accent select-none" aria-hidden="true">$</span><copy-cmd>npm create webjs@latest my-app</copy-cmd>
              </div>
              <div class="flex gap-3 justify-center flex-wrap">
                <a class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-fg text-bg hover:bg-fg-muted transition-all active:scale-[0.98]" href=${DOCS_URL + '/docs/getting-started'} target="_blank" rel="noopener noreferrer">
                  Get Started
                </a>
                <a class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border border-border bg-bg-subtle/80 text-fg hover:border-border-strong hover:bg-bg-sunken transition-all active:scale-[0.98]" href=${DOCS_URL} target="_blank" rel="noopener noreferrer">Read the docs${NEW_TAB}</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="mt-24 border-t border-border py-16 px-6 bg-bg-subtle/30 relative z-10">
      <div class="max-w-[1080px] mx-auto">
        <nav class="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12" aria-label="Footer">
          <!-- Product -->
          <div class="flex flex-col gap-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-fg">Product</h4>
            <a class="text-fg-muted hover:text-accent no-underline text-sm transition-colors" href=${DOCS_URL + '/docs/getting-started'} target="_blank" rel="noopener noreferrer">Docs</a>
            <a class="text-fg-muted hover:text-accent no-underline text-sm transition-colors" href=${UI_URL} target="_blank" rel="noopener noreferrer">UI Components</a>
            <a class="text-fg-muted hover:text-accent no-underline text-sm transition-colors" href="#templates">Templates</a>
            <a class="text-fg-muted hover:text-accent no-underline text-sm transition-colors" href=${EXAMPLE_BLOG_URL} target="_blank" rel="noopener noreferrer">Showcase</a>
          </div>
          <!-- Resources -->
          <div class="flex flex-col gap-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-fg">Resources</h4>
            <a class="text-fg-muted hover:text-accent no-underline text-sm transition-colors" href="/blog">Blog</a>
            <a class="text-fg-muted hover:text-accent no-underline text-sm transition-colors" href="/changelog">Changelog</a>
            <a class="text-fg-muted hover:text-accent no-underline text-sm transition-colors" href=${GH_URL + '/releases'} target="_blank" rel="noopener noreferrer">Releases</a>
          </div>
          <!-- Community -->
          <div class="flex flex-col gap-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-fg">Community</h4>
            <a class="text-fg-muted hover:text-accent no-underline text-sm transition-colors" href=${GH_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
            <a class="text-fg-muted hover:text-accent no-underline text-sm transition-colors" href=${GH_URL + '/discussions'} target="_blank" rel="noopener noreferrer">Discussions</a>
          </div>
          <!-- Framework -->
          <div class="flex flex-col gap-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-fg">webjs</h4>
            <p class="m-0 text-xs text-fg-muted leading-relaxed">Build on the platform, not against it. Modern web components full-stack framework.</p>
          </div>
        </nav>
        
        <div class="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-fg-subtle text-xs">
          <div>&copy; 2026 webjs. All rights reserved.</div>
          <div class="flex items-center gap-1">
            Built with webjs <svg class="heart" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </div>
        </div>
      </div>
    </footer>
  `;
}
