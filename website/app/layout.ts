import { html, cspNonce } from '@webjsdev/core';
import '@webjsdev/core/client-router';
import '../components/theme-toggle.ts';
import '../components/cursor-glow.ts';

/**
 * Root layout for the redesigned marketing site.
 *
 * Styling is Tailwind-first: chrome and structure use utility classes,
 * with the design tokens declared once in the foundation <style> below
 * and exposed to Tailwind via @theme in public/input.css. Only the
 * genuinely un-utility-expressible pieces stay as CSS: the @property
 * animated accent + keyframes, the prefers-reduced-motion clamp, the
 * fixed glow layer, the hover-only scrollbar (`.scroll-thin`), and the
 * <details> icon swap. Everything else is Tailwind.
 *
 * Sibling app URLs are read from env so the same code works across
 * `webjs dev` and any deployment target. Guarded against `process` being
 * undefined because this module also loads on the client during hydration.
 */
const env = (globalThis as any).process?.env ?? {};
const DOCS_URL = env.DOCS_URL || 'https://docs.webjs.com';
const UI_URL = env.UI_URL || 'https://ui.webjs.dev';
const GH_URL = 'https://github.com/webjsdev/webjs';

const TITLE = 'webjs: the AI-first, web-components-first, no-build web framework';
const DESCRIPTION = 'The framework your AI agent already knows how to use. Native web components, server actions, streaming SSR, on web standards. No build step, no bundler, no guesswork.';

const NAV = [
  { label: 'Docs', href: DOCS_URL + '/docs/getting-started', ext: true },
  { label: 'UI', href: UI_URL, ext: true },
  { label: 'Blog', href: '/blog', ext: false },
  { label: 'Changelog', href: '/changelog', ext: false },
  { label: 'GitHub', href: GH_URL, ext: true },
];

export function generateMetadata(ctx: { url: string }) {
  const origin = new URL(ctx.url).origin;
  const image = `${origin}/public/og.png`;
  return {
    title: TITLE,
    description: DESCRIPTION,
    openGraph: {
      type: 'website',
      title: TITLE,
      description: DESCRIPTION,
      url: origin,
      image,
      'image:width': '1200',
      'image:height': '630',
      'image:alt': TITLE,
      'site_name': 'webjs',
    },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, image },
  };
}

const navLink = 'text-fg-muted no-underline font-medium text-sm px-[11px] py-2 rounded-lg transition-colors duration-[140ms] hover:text-fg hover:bg-bg-subtle';
const panelLink = 'text-fg-muted no-underline font-medium text-sm px-3 py-[10px] rounded-[9px] hover:text-fg hover:bg-bg-subtle';

export default function RootLayout({ children }: { children: unknown }) {
  const nonce = cspNonce();
  return html`
    <link rel="icon" href="/public/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/public/favicon.png" type="image/png">
    <link rel="apple-touch-icon" href="/public/favicon.png">

    <!-- Self-hosted fonts (declared via @font-face in input.css). Preload the
         above-the-fold weights so they fetch in parallel with the stylesheet:
         the hero headline (Inter Tight 800), body text (Inter 400), and the
         nav / button weight (Inter 600). -->
    <link rel="preload" href="/public/fonts/inter-tight-800.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/public/fonts/inter-400.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/public/fonts/inter-600.woff2" as="font" type="font/woff2" crossorigin>

    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-3RC87HXJ3P" nonce="${nonce}"></script>
    <script nonce="${nonce}">
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-3RC87HXJ3P');
    </script>

    <script nonce="${nonce}">
      (function(){
        try {
          var t = localStorage.getItem('webjs_theme');
          if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
        } catch (_) {}
      })();
      document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var a = t.closest('.mobile-menu a');
        if (a) { var d = a.closest('details'); if (d) d.removeAttribute('open'); return; }
        var open = document.querySelectorAll('.mobile-menu[open]');
        for (var i = 0; i < open.length; i++) if (!open[i].contains(t)) open[i].removeAttribute('open');
      });
    </script>

    <link rel="stylesheet" href="/public/tailwind.css">
    <style>
      /* Foundation tokens + effects that Tailwind utilities cannot express. */
      @property --accent-live { syntax: '<color>'; inherits: true; initial-value: oklch(0.63 0.17 50); }
      @keyframes accent-drift {
        0%   { --accent-live: oklch(0.63 0.17 44); }
        34%  { --accent-live: oklch(0.67 0.17 60); }
        67%  { --accent-live: oklch(0.60 0.18 33); }
        100% { --accent-live: oklch(0.63 0.17 44); }
      }
      :root {
        color-scheme: light dark;
        --fg:            oklch(0.20 0.018 60);
        --fg-muted:      oklch(0.44 0.02 60);
        --fg-subtle:     oklch(0.50 0.02 65);
        --bg:            oklch(0.985 0.008 75);
        --bg-elev:       oklch(1 0 0);
        --bg-subtle:     oklch(0.96 0.008 75);
        --bg-sunken:     oklch(0.93 0.01 70);
        --border:        oklch(0.88 0.012 70 / 0.9);
        --border-strong: oklch(0.78 0.014 70 / 0.95);
        --accent:        oklch(0.54 0.16 52);
        --accent-hover:  oklch(0.5 0.16 52);
        --accent-fg:     oklch(1 0 0);
        --heart:         oklch(0.64 0.22 6);
        --accent-tint:   color-mix(in oklch, var(--accent-live) 14%, transparent);
        --glow-strength: 0.16;
        --font-display: 'Inter Tight', 'Inter', system-ui, -apple-system, sans-serif;
        --font-sans:    'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        --font-mono:    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
        --shadow-sm: 0 1px 2px oklch(0.5 0.06 55 / 0.08);
        --shadow:    0 8px 30px oklch(0.5 0.08 55 / 0.10), 0 2px 6px oklch(0.5 0.06 55 / 0.06);
        --shadow-glow: 0 0 0 1px var(--accent-tint), 0 14px 50px color-mix(in oklch, var(--accent-live) 18%, transparent);
        --t-fast: 140ms; --t: 240ms;
        animation: accent-drift 16s ease-in-out infinite;
      }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme='light']) {
          --heart: oklch(0.74 0.18 6);
          --fg: oklch(0.95 0.012 70); --fg-muted: oklch(0.74 0.02 65); --fg-subtle: oklch(0.66 0.02 60);
          --bg: oklch(0.155 0.012 55); --bg-elev: oklch(0.20 0.014 55); --bg-subtle: oklch(0.18 0.013 55); --bg-sunken: oklch(0.12 0.01 55);
          --border: oklch(0.30 0.016 58 / 0.85); --border-strong: oklch(0.42 0.018 58 / 0.9);
          --accent: oklch(0.74 0.15 55); --accent-hover: oklch(0.82 0.15 55); --accent-fg: oklch(0.16 0.02 55);
          --glow-strength: 0.32;
          --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.4);
          --shadow: 0 10px 40px oklch(0 0 0 / 0.5), 0 2px 6px oklch(0 0 0 / 0.35);
        }
      }
      :root[data-theme='dark'] {
        color-scheme: dark;
        --heart: oklch(0.74 0.18 6);
        --fg: oklch(0.95 0.012 70); --fg-muted: oklch(0.74 0.02 65); --fg-subtle: oklch(0.66 0.02 60);
        --bg: oklch(0.155 0.012 55); --bg-elev: oklch(0.20 0.014 55); --bg-subtle: oklch(0.18 0.013 55); --bg-sunken: oklch(0.12 0.01 55);
        --border: oklch(0.30 0.016 58 / 0.85); --border-strong: oklch(0.42 0.018 58 / 0.9);
        --accent: oklch(0.74 0.15 55); --accent-hover: oklch(0.82 0.15 55); --accent-fg: oklch(0.16 0.02 55);
        --glow-strength: 0.32;
        --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.4);
        --shadow: 0 10px 40px oklch(0 0 0 / 0.5), 0 2px 6px oklch(0 0 0 / 0.35);
      }
      :root[data-theme='light'] { color-scheme: light; }
      @media (prefers-reduced-motion: reduce) {
        :root { animation: none; --accent-live: oklch(0.63 0.17 50); }
        *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
      }
      html, body { margin: 0; }
      html { scroll-behavior: smooth; }
      body {
        background: var(--bg); color: var(--fg);
        font: 400 16px/1.65 var(--font-sans);
        -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; overflow-x: hidden;
        transition: background var(--t) cubic-bezier(0.3,0,0.3,1), color var(--t) cubic-bezier(0.3,0,0.3,1);
      }
      ::selection { background: var(--accent-tint); color: var(--fg); }
      @keyframes heart-pump {
        0%, 40%, 100% { transform: scale(1); }
        10% { transform: scale(1.3); }
        20% { transform: scale(1); }
        30% { transform: scale(1.18); }
      }
      .heart {
        display: inline-block; width: 1.15em; height: 1.15em;
        vertical-align: -0.18em; color: var(--heart);
        animation: heart-pump 1.4s ease-in-out infinite;
        transform-origin: center;
      }
      .glow-layer {
        position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background:
          radial-gradient(58% 44% at 50% -4%, color-mix(in oklch, var(--accent-live) calc(var(--glow-strength) * 100%), transparent), transparent 72%),
          radial-gradient(40% 36% at 88% 8%, color-mix(in oklch, var(--accent-live) calc(var(--glow-strength) * 60%), transparent), transparent 70%);
      }
      /* JS-opt-in motion. The host of cursor-glow is the layer, and its
         move handler sets --cg-x / --cg-y / --cg-on. scroll-reveal adds the
         reveal-ready class, so a data-reveal section is hidden only when JS
         is present, and visible otherwise. */
      cursor-glow {
        position: fixed; inset: 0; z-index: 0; pointer-events: none;
        opacity: var(--cg-on, 0); transition: opacity 500ms ease;
        background: radial-gradient(460px 460px at var(--cg-x, 50%) var(--cg-y, 26%), color-mix(in oklch, var(--accent-live) 13%, transparent), transparent 72%);
      }
      .reveal-ready [data-reveal] { opacity: 0; transform: translateY(18px); transition: opacity 600ms ease, transform 600ms ease; }
      .reveal-ready [data-reveal].is-revealed { opacity: 1; transform: none; }
      @media (prefers-reduced-motion: reduce) {
        cursor-glow { display: none; }
        .reveal-ready [data-reveal] { opacity: 1; transform: none; transition: none; }
      }
      .scroll-thin { scrollbar-width: thin; scrollbar-color: transparent transparent; transition: scrollbar-color var(--t); }
      .scroll-thin:hover { scrollbar-color: color-mix(in oklch, var(--fg-subtle) 70%, transparent) transparent; }
      .scroll-thin::-webkit-scrollbar { height: 8px; width: 8px; }
      .scroll-thin::-webkit-scrollbar-track { background: transparent; }
      .scroll-thin::-webkit-scrollbar-thumb { background: transparent; border-radius: 999px; transition: background var(--t); }
      .scroll-thin:hover::-webkit-scrollbar-thumb { background: color-mix(in oklch, var(--fg-subtle) 60%, transparent); }
      .scroll-thin::-webkit-scrollbar-thumb:hover { background: var(--fg-muted); }
      .mobile-menu > summary { list-style: none; }
      .mobile-menu > summary::-webkit-details-marker { display: none; }
      .mobile-menu .close-icon { display: none; }
      .mobile-menu[open] .open-icon { display: none; }
      .mobile-menu[open] .close-icon { display: inline-block; }
      /* Host sizing for the copy-cmd custom element (utilities cannot
         target the host from inside the component). Everything else in
         copy-cmd is Tailwind. The tag name is written without angle
         brackets on purpose: a literal element tag inside this style
         block is rendered as a real component by the SSR pass. */
      copy-cmd { display: block; flex: 1; min-width: 0; max-width: 100%; }
      /* Template-card commands hide the horizontal scrollbar entirely (no
         track, no gutter, even on hover), so all three sit flush at the same
         bottom baseline with no reserved strip. The command stays scrollable
         (wheel / touch / drag) and the copy button copies the full text. */
      .cmd-foot copy-cmd [data-copy-text] { overflow-x: auto; scrollbar-width: none; }
      .cmd-foot copy-cmd [data-copy-text]::-webkit-scrollbar { display: none; }
    </style>

    <div class="glow-layer" aria-hidden="true"></div>
    <cursor-glow aria-hidden="true"></cursor-glow>

    <div class="relative z-[3] text-center font-medium text-[13px] leading-[1.4] py-[9px] px-4 border-b border-border bg-accent-tint">
      <span class="font-mono font-bold text-[10px] leading-none tracking-[0.12em] uppercase text-accent-hover bg-accent-tint rounded-full px-2 py-[3px] mr-2 align-middle">New</span>
      <a href=${UI_URL} target="_blank" rel="noopener noreferrer" class="text-accent-hover font-semibold no-underline hover:underline">Introducing the AI-first component library &rarr;</a>
    </div>

    <header class="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_oklch,var(--color-bg)_78%,transparent)] border-b border-border">
      <div class="max-w-[1080px] mx-auto px-6 py-[13px] flex items-center gap-4">
        <a class="mr-auto inline-flex items-center gap-[9px] no-underline text-fg font-display font-extrabold text-[17px] leading-none tracking-[-0.02em]" href="/">
          <span class="w-[22px] h-[22px] rounded-[7px] bg-gradient-to-br from-accent-live to-[color-mix(in_oklch,var(--accent-live)_55%,var(--fg))] shadow-[0_2px_10px_var(--accent-tint)]"></span>
          webjs
        </a>

        <nav class="hidden md:flex items-center gap-0.5">
          ${NAV.map(n => html`<a class=${navLink} href=${n.href} target=${n.ext ? '_blank' : '_self'} rel=${n.ext ? 'noopener noreferrer' : ''}>${n.label}</a>`)}
        </nav>

        <div class="flex items-center gap-3">
          <theme-toggle></theme-toggle>
          <details class="mobile-menu relative md:hidden">
            <summary class="cursor-pointer w-[38px] h-[38px] inline-flex items-center justify-center rounded-[9px] text-fg-muted hover:bg-bg-subtle hover:text-fg" aria-label="Toggle navigation">
              <svg class="open-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
              <svg class="close-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </summary>
            <nav class="absolute right-0 top-[calc(100%+10px)] min-w-[210px] flex flex-col gap-0.5 bg-bg-elev border border-border rounded-[14px] shadow-[var(--shadow)] p-2 z-50">
              ${NAV.map(n => html`<a class=${panelLink} href=${n.href} target=${n.ext ? '_blank' : '_self'} rel=${n.ext ? 'noopener noreferrer' : ''}>${n.label}</a>`)}
            </nav>
          </details>
        </div>
      </div>
    </header>

    <div class="relative z-[1]">
      ${children}
    </div>
  `;
}
