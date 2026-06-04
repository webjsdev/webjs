import { html, cspNonce } from '@webjsdev/core';
import '@webjsdev/core/client-router';
import '../components/theme-toggle.ts';
import { DOCS_URL, UI_URL, EXAMPLE_BLOG_URL, GH_URL, NEW_TAB } from '../lib/links.ts';

/**
 * Root layout for the redesigned marketing site.
 *
 * Styling is Tailwind-first: chrome and structure use utility classes,
 * with the design tokens declared once in the foundation <style> below
 * and exposed to Tailwind via @theme in public/input.css. Only the
 * genuinely un-utility-expressible pieces stay as CSS: the glow cross-fade
 * and heart-pump keyframes, the prefers-reduced-motion clamp, the fixed glow
 * layer, the hover-only scrollbar (`.scroll-thin`), and the <details> icon
 * swap. Everything else is Tailwind.
 *
 * Shared link config (DOCS_URL / UI_URL / EXAMPLE_BLOG_URL / GH_URL / NEW_TAB) lives in
 * lib/links.ts, imported here and by app/page.ts.
 */

const TITLE = 'webjs: the framework your AI agent already knows how to use';
const DESCRIPTION = 'AI-first, web-components-first, no-build full-stack framework. File-based routing, server actions, streaming SSR, on web standards. Built for AI agents to read, write, and ship.';

const NAV = [
  { label: 'Docs', href: DOCS_URL + '/docs/getting-started', ext: true },
  { label: 'UI', href: UI_URL, ext: true },
  { label: 'Demo', href: EXAMPLE_BLOG_URL, ext: true },
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
         two above-the-fold families so they fetch in parallel with the
         stylesheet: the display face (Inter Tight, hero headline) and the body
         face (Inter). Each is one variable file covering all weights. The hero
         install command is the one above-the-fold monospace text, but JetBrains
         Mono is deliberately not preloaded. The preload budget stays on the two
         LCP text faces, and the ui-monospace fallback is close enough that the
         late swap on a single command line is negligible. -->
    <link rel="preload" href="/public/fonts/inter-tight.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/public/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>

    <!-- Warm the analytics connection so the async gtag handshake (and the
         beacon to google-analytics.com it then opens) overlaps head parse
         instead of starting cold when the script tag is discovered. -->
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
    <link rel="dns-prefetch" href="https://www.google-analytics.com">

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
      // Pause every infinite animation (the two cross-fading glow layers and
      // the footer heart) while the tab is hidden so nothing repaints in the
      // background. A class is used because animation-play-state does not
      // inherit, so an inline style on <html> would miss descendant animations.
      document.addEventListener('visibilitychange', function () {
        document.documentElement.classList.toggle('paused', document.hidden);
      });
      document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var a = t.closest('.mobile-menu a');
        if (a) { var d = a.closest('details'); if (d) d.removeAttribute('open'); return; }
        var open = document.querySelectorAll('.mobile-menu[open]');
        for (var i = 0; i < open.length; i++) if (!open[i].contains(t)) open[i].removeAttribute('open');
      });
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var open = document.querySelectorAll('.mobile-menu[open]');
        for (var i = 0; i < open.length; i++) {
          open[i].removeAttribute('open');
          var s = open[i].querySelector('summary');
          if (s) s.focus();
        }
      });
    </script>

    <link rel="stylesheet" href="/public/tailwind.css">
    <style>
      /* Foundation tokens + effects that Tailwind utilities cannot express. */
      /* The breathing glow is two static-gradient layers cross-faded via
         opacity (a compositor-only property), so it never triggers a repaint.
         The accent color itself is static, so its consumers (tints, shadows,
         the gradient text) do not repaint either. */
      @keyframes glow-fade-a { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      @keyframes glow-fade-b { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
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
        --accent-live:   oklch(0.63 0.17 50);
        --glow-a:        oklch(0.63 0.17 44);
        --glow-b:        oklch(0.62 0.18 60);
        --accent-tint:   color-mix(in oklch, var(--accent-live) 14%, transparent);
        --glow-strength: 0.16;
        --font-display: 'Inter Tight', 'Inter', system-ui, -apple-system, sans-serif;
        --font-sans:    'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        --font-serif:   ui-serif, 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, Cambria, serif;
        --font-mono:    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
        --shadow-sm: 0 1px 2px oklch(0.5 0.06 55 / 0.08);
        --shadow:    0 8px 30px oklch(0.5 0.08 55 / 0.10), 0 2px 6px oklch(0.5 0.06 55 / 0.06);
        --shadow-glow: 0 0 0 1px var(--accent-tint), 0 14px 50px color-mix(in oklch, var(--accent-live) 18%, transparent);
        --t: 240ms;
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
      /* Hidden-tab pause (the .paused class is toggled on a visibilitychange).
         Covers the heart and the two cross-fading glow layers. */
      :root.paused .heart,
      :root.paused .glow-layer::before,
      :root.paused .glow-layer::after { animation-play-state: paused; }
      .glow-layer { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
      /* No will-change: the running opacity animation already promotes these
         to their own layer, so a permanent hint would just be the MDN
         long-lived-will-change anti-pattern. */
      .glow-layer::before, .glow-layer::after {
        content: ''; position: absolute; inset: 0;
      }
      .glow-layer::before {
        background:
          radial-gradient(58% 44% at 50% -4%, color-mix(in oklch, var(--glow-a) calc(var(--glow-strength) * 100%), transparent), transparent 72%),
          radial-gradient(40% 36% at 88% 8%, color-mix(in oklch, var(--glow-a) calc(var(--glow-strength) * 60%), transparent), transparent 70%);
        animation: glow-fade-a 16s ease-in-out infinite;
      }
      .glow-layer::after {
        background:
          radial-gradient(58% 44% at 50% -4%, color-mix(in oklch, var(--glow-b) calc(var(--glow-strength) * 100%), transparent), transparent 72%),
          radial-gradient(40% 36% at 88% 8%, color-mix(in oklch, var(--glow-b) calc(var(--glow-strength) * 60%), transparent), transparent 70%);
        animation: glow-fade-b 16s ease-in-out infinite;
      }
      /* JS-opt-in motion: scroll-reveal adds the reveal-ready class, so a
         data-reveal section is hidden only when JS is present, and visible
         otherwise. */
      /* Skip rendering off-screen sections until they near the viewport. The
         intrinsic-size keeps the scrollbar stable, and the auto keyword
         remembers each real size after first render. Pure CSS, no JS, PE-safe. */
      [data-reveal] { content-visibility: auto; contain-intrinsic-size: auto 600px; }
      .reveal-ready [data-reveal] { opacity: 0; transform: translateY(18px); transition: opacity 600ms ease, transform 600ms ease; }
      .reveal-ready [data-reveal].is-revealed { opacity: 1; transform: none; }
      @media (prefers-reduced-motion: reduce) {
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

    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-accent-fg focus:shadow-[var(--shadow)]">Skip to content</a>

    <div class="glow-layer" aria-hidden="true"></div>

    <div class="relative z-[3] text-center font-medium text-[13px] leading-[1.4] py-[9px] px-4 border-b border-border bg-accent-tint">
      <span class="font-mono font-bold text-[10px] leading-none tracking-[0.12em] uppercase text-accent-hover bg-bg-elev rounded-full px-2 py-[3px] mr-2 align-middle">New</span>
      <a href=${UI_URL} target="_blank" rel="noopener noreferrer" class="text-accent-hover font-semibold no-underline hover:underline">Introducing the AI-first component library <span aria-hidden="true">&rarr;</span>${NEW_TAB}</a>
    </div>

    <header class="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_oklch,var(--color-bg)_78%,transparent)] border-b border-border">
      <div class="max-w-[1080px] mx-auto px-6 py-[13px] flex items-center gap-4">
        <a class="mr-auto inline-flex items-center gap-[9px] no-underline text-fg font-display font-extrabold text-[17px] leading-none tracking-[-0.02em]" href="/">
          <span class="w-[22px] h-[22px] rounded-[7px] bg-gradient-to-br from-accent-live to-[color-mix(in_oklch,var(--accent-live)_55%,var(--fg))] shadow-[0_2px_10px_var(--accent-tint)]"></span>
          webjs
        </a>

        <nav class="hidden md:flex items-center gap-0.5" aria-label="Primary">
          ${NAV.map(n => html`<a class=${navLink} href=${n.href} target=${n.ext ? '_blank' : '_self'} rel=${n.ext ? 'noopener noreferrer' : ''}>${n.label}${n.ext ? NEW_TAB : ''}</a>`)}
        </nav>

        <div class="flex items-center gap-3">
          <theme-toggle></theme-toggle>
          <details class="mobile-menu relative md:hidden">
            <summary class="cursor-pointer w-[38px] h-[38px] inline-flex items-center justify-center rounded-[9px] text-fg-muted hover:bg-bg-subtle hover:text-fg" aria-label="Toggle navigation">
              <svg class="open-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
              <svg class="close-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </summary>
            <nav class="absolute right-0 top-[calc(100%+10px)] min-w-[210px] flex flex-col gap-0.5 bg-bg-elev border border-border rounded-[14px] shadow-[var(--shadow)] p-2 z-50" aria-label="Mobile">
              ${NAV.map(n => html`<a class=${panelLink} href=${n.href} target=${n.ext ? '_blank' : '_self'} rel=${n.ext ? 'noopener noreferrer' : ''}>${n.label}${n.ext ? NEW_TAB : ''}</a>`)}
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
