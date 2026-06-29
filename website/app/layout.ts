import { html, cspNonce } from '@webjsdev/core';
import '#components/theme-toggle.ts';
import { DOCS_URL, UI_URL, EXAMPLE_BLOG_URL, GH_URL, NEW_TAB } from '#lib/links.ts';

/**
 * Root layout for the redesigned marketing site.
 *
 * Styling is Tailwind-first: chrome and structure use utility classes,
 * with the design tokens declared once in the foundation <style> below
 * and exposed to Tailwind via @theme in public/input.css. Only the
 * genuinely un-utility-expressible pieces stay as CSS: the prefers-reduced-motion
 * clamp, the fixed static glow layer, the hover-only scrollbar (`.scroll-thin`),
 * and the <details> icon swap. Everything else is Tailwind.
 *
 * Shared link config (DOCS_URL / UI_URL / EXAMPLE_BLOG_URL / GH_URL / NEW_TAB) lives in
 * lib/links.ts, imported here and by app/page.ts.
 */

const TITLE = 'webjs: build on the platform, not against it';
const DESCRIPTION = 'A full-stack web framework built on web components, real SSR, and progressive enhancement, with zero build step. File-based routing, server actions, and streaming SSR on web standards. Runs on Node 24+ or Bun.';

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
    // The marketing site is identical for every visitor (no per-user / session
    // reads), so it is safe to cache at the CDN. Set on the root layout so it
    // applies to every page (a per-user page could override with no-store).
    // `s-maxage` is the edge cache; `max-age=0` keeps the browser revalidating;
    // `stale-while-revalidate` serves instantly while refreshing.
    cacheControl: 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
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

const navLink = 'text-fg-muted no-underline font-medium text-sm px-3 py-2 transition-colors duration-[140ms] hover:text-fg';
const panelLink = 'text-fg-muted no-underline font-medium text-sm px-3 py-[10px] rounded-[9px] hover:text-fg hover:bg-bg-subtle';

export default function RootLayout({ children }: { children: unknown }) {
  const nonce = cspNonce();
  return html`
    <link rel="icon" href="/public/favicon.svg" type="image/svg+xml" sizes="any">
    <link rel="icon" href="/public/favicon.png" type="image/png" sizes="32x32">
    <link rel="apple-touch-icon" href="/public/favicon.png">

    <!-- Self-hosted fonts (declared via @font-face in input.css), preloaded so
         they fetch in parallel with the stylesheet instead of being discovered
         only after the CSS parses. The display face (Inter Tight, hero
         headline) and the body face (Inter) are the LCP text faces. JetBrains
         Mono is preloaded too: the hero install command is above-the-fold
         monospace text and the primary CTA, and a trace of the live site showed
         the un-preloaded mono file as the tail of the critical request chain
         (document, then tailwind.css, then the font, discovered late via its
         @font-face). Preloading it drops that hop so the command paints its
         final face without the late swap. Each family is one variable file
         covering every weight, so three small woff2 files over h2 is a cheap
         preload budget. -->
    <link rel="preload" href="/public/fonts/inter-tight.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/public/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/public/fonts/jetbrains-mono.woff2" as="font" type="font/woff2" crossorigin>

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
      // #610: the announcement banner + header are position:fixed together (not
      // sticky, which flickers on iOS WebKit during a client-router nav).
      // --header-h reserves the pinned bar's height; measured here so it tracks
      // the real height, with a :root default for no-JS / first paint.
      (function(){
        function measure(){
          try {
            var bar = document.querySelector('.site-top');
            if (!bar) return;
            var apply = function(){ document.documentElement.style.setProperty('--header-h', bar.offsetHeight + 'px'); };
            apply();
            if (window.ResizeObserver) new ResizeObserver(apply).observe(bar);
          } catch (_) {}
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', measure);
        else measure();
      })();
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
      /* A single static gradient glow layer. It used to breathe (two layers
         cross-faded on a 16s loop), removed so nothing animates on the page. */
      :root {
        color-scheme: light dark;
        --fg:            oklch(0.15 0.01 240);
        --fg-muted:      oklch(0.45 0.01 240);
        --fg-subtle:     oklch(0.55 0.01 240);
        --bg:            oklch(1 0 0);
        --bg-elev:       oklch(1 0 0);
        --bg-subtle:     oklch(0.98 0.002 240);
        --bg-sunken:     oklch(0.95 0.002 240);
        --border:        rgba(0, 0, 0, 0.06);
        --border-strong: rgba(0, 0, 0, 0.12);
        --accent:        oklch(0.15 0.01 240);
        --accent-hover:  oklch(0.25 0.01 240);
        --accent-fg:     oklch(1 0 0);
        --heart:         oklch(0.64 0.22 6);
        --accent-live:   oklch(0.15 0.01 240);
        --glow-a:        oklch(0.85 0.01 240);
        --accent-tint:   rgba(0, 0, 0, 0.05);
        --glow-strength: 0.12;
        --grid-color:    rgba(0, 0, 0, 0.035);
        --font-display: 'Inter Tight', 'Inter', system-ui, -apple-system, sans-serif;
        --font-sans:    'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        --font-serif:   ui-serif, 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, Cambria, serif;
        --font-mono:    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
        --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
        --shadow:    0 8px 30px rgba(0, 0, 0, 0.04), 0 2px 6px rgba(0, 0, 0, 0.03);
        --shadow-glow: 0 0 0 1px var(--accent-tint), 0 14px 50px color-mix(in oklch, var(--accent-live) 10%, transparent);
        --t: 240ms;

        /* Light Editor Tokens */
        --editor-bg:            oklch(1 0 0);
        --editor-sidebar-bg:    oklch(0.98 0.002 240);
        --editor-tab-bg:        oklch(0.98 0.002 240);
        --editor-active-tab-bg: oklch(1 0 0);
        --editor-status-bg:     oklch(0.98 0.002 240);
        --editor-border:        rgba(0, 0, 0, 0.08);
        --editor-fg:            oklch(0.20 0.01 240);
        --editor-gutter-fg:     oklch(0.55 0.01 240);
        --editor-gutter-border: rgba(0, 0, 0, 0.05);

        /* Light Code Highlight Tokens */
        --code-tag:  oklch(0.50 0.15 250);
        --code-attr: oklch(0.50 0.12 180);
        --code-str:  oklch(0.50 0.14 140);
        --code-text: oklch(0.20 0.01 240);
        --code-punc: oklch(0.50 0.01 240);
        --code-kw:   oklch(0.60 0.18 320);
        --code-fn:   oklch(0.50 0.15 250);
        --code-type: oklch(0.60 0.12 190);
        --code-num:  oklch(0.65 0.15 80);
        --code-ok:   oklch(0.66 0.16 150);

        /* Card Hover styles */
        --card-hover-border: oklch(0.45 0.01 240);
        --card-hover-shadow: 0 20px 40px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02);
        --grid-opacity: 0.4;
      }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme='light']) {
          --heart: oklch(0.74 0.18 6);
          --fg: oklch(0.96 0.002 240); --fg-muted: oklch(0.65 0.002 240); --fg-subtle: oklch(0.50 0.002 240);
          --bg: oklch(0.08 0 0); --bg-elev: oklch(0.12 0.002 240); --bg-subtle: oklch(0.15 0.002 240); --bg-sunken: oklch(0.06 0 0);
          --border: rgba(255, 255, 255, 0.08); --border-strong: rgba(255, 255, 255, 0.15);
          --accent: oklch(0.96 0.002 240); --accent-hover: oklch(0.85 0.002 240); --accent-fg: oklch(0.08 0 0);
          --accent-live: oklch(0.96 0.002 240);
          --glow-a: oklch(0.96 0.002 240);
          --accent-tint: rgba(255, 255, 255, 0.08);
          --glow-strength: 0.28;
          --grid-color: rgba(255, 255, 255, 0.035);
          --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.5);
          --shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4);

          /* Dark Editor Tokens */
          --editor-bg:            oklch(0.08 0 0);
          --editor-sidebar-bg:    oklch(0.06 0 0);
          --editor-tab-bg:        oklch(0.06 0 0);
          --editor-active-tab-bg: oklch(0.08 0 0);
          --editor-status-bg:     oklch(0.06 0 0);
          --editor-border:        rgba(255, 255, 255, 0.08);
          --editor-fg:            oklch(0.96 0.002 240);
          --editor-gutter-fg:     oklch(0.50 0.002 240);
          --editor-gutter-border: rgba(255, 255, 255, 0.05);

          /* Dark Code Highlight Tokens */
          --code-tag:  oklch(0.70 0.13 250);
          --code-attr: oklch(0.75 0.10 190);
          --code-str:  oklch(0.80 0.12 140);
          --code-text: oklch(0.96 0.002 240);
          --code-punc: oklch(0.65 0.002 240);
          --code-kw:   oklch(0.80 0.15 320);
          --code-fn:   oklch(0.70 0.13 250);
          --code-type: oklch(0.75 0.10 190);
          --code-num:  oklch(0.82 0.11 80);
          --code-ok:   oklch(0.66 0.16 150);

          /* Card Hover styles */
          --card-hover-border: oklch(0.70 0.01 240);
          --card-hover-shadow: 0 0 50px rgba(255, 255, 255, 0.035), 0 15px 40px rgba(0, 0, 0, 0.8);
          
          /* Grid Opacity */
          --grid-opacity: 0.25;
        }
      }
      :root[data-theme='dark'] {
        color-scheme: dark;
        --heart: oklch(0.74 0.18 6);
        --fg: oklch(0.96 0.002 240); --fg-muted: oklch(0.65 0.002 240); --fg-subtle: oklch(0.50 0.002 240);
        --bg: oklch(0.08 0 0); --bg-elev: oklch(0.12 0.002 240); --bg-subtle: oklch(0.15 0.002 240); --bg-sunken: oklch(0.06 0 0);
        --border: rgba(255, 255, 255, 0.08); --border-strong: rgba(255, 255, 255, 0.15);
        --accent: oklch(0.96 0.002 240); --accent-hover: oklch(0.85 0.002 240); --accent-fg: oklch(0.08 0 0);
        --accent-live: oklch(0.96 0.002 240);
        --glow-a: oklch(0.96 0.002 240);
        --accent-tint: rgba(255, 255, 255, 0.08);
        --glow-strength: 0.28;
        --grid-color: rgba(255, 255, 255, 0.035);
        --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.5);
        --shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4);

        /* Dark Editor Tokens */
        --editor-bg:            oklch(0.08 0 0);
        --editor-sidebar-bg:    oklch(0.06 0 0);
        --editor-tab-bg:        oklch(0.06 0 0);
        --editor-active-tab-bg: oklch(0.08 0 0);
        --editor-status-bg:     oklch(0.06 0 0);
        --editor-border:        rgba(255, 255, 255, 0.08);
        --editor-fg:            oklch(0.96 0.002 240);
        --editor-gutter-fg:     oklch(0.50 0.002 240);
        --editor-gutter-border: rgba(255, 255, 255, 0.05);

        /* Dark Code Highlight Tokens */
        --code-tag:  oklch(0.70 0.13 250);
        --code-attr: oklch(0.75 0.10 190);
        --code-str:  oklch(0.80 0.12 140);
        --code-text: oklch(0.96 0.002 240);
        --code-punc: oklch(0.65 0.002 240);
        --code-kw:   oklch(0.80 0.15 320);
        --code-fn:   oklch(0.70 0.13 250);
        --code-type: oklch(0.75 0.10 190);
        --code-num:  oklch(0.82 0.11 80);
        --code-ok:   oklch(0.66 0.16 150);

        /* Card Hover styles */
        --card-hover-border: oklch(0.70 0.01 240);
        --card-hover-shadow: 0 0 50px rgba(255, 255, 255, 0.035), 0 15px 40px rgba(0, 0, 0, 0.8);
        
        /* Grid Opacity */
        --grid-opacity: 0.25;
      }
      :root[data-theme='light'] {
        color-scheme: light;
        --fg:            oklch(0.15 0.01 240);
        --fg-muted:      oklch(0.45 0.01 240);
        --fg-subtle:     oklch(0.55 0.01 240);
        --bg:            oklch(1 0 0);
        --bg-elev:       oklch(1 0 0);
        --bg-subtle:     oklch(0.98 0.002 240);
        --bg-sunken:     oklch(0.95 0.002 240);
        --border:        rgba(0, 0, 0, 0.06);
        --border-strong: rgba(0, 0, 0, 0.12);
        --accent:        oklch(0.15 0.01 240);
        --accent-hover:  oklch(0.25 0.01 240);
        --accent-fg:     oklch(1 0 0);
        --heart:         oklch(0.64 0.22 6);
        --accent-live:   oklch(0.15 0.01 240);
        --glow-a:        oklch(0.85 0.01 240);
        --accent-tint:   rgba(0, 0, 0, 0.05);
        --glow-strength: 0.12;
        --grid-color:    rgba(0, 0, 0, 0.035);
        --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
        --shadow:    0 8px 30px rgba(0, 0, 0, 0.04), 0 2px 6px rgba(0, 0, 0, 0.03);

        /* Light Editor Tokens */
        --editor-bg:            oklch(1 0 0);
        --editor-sidebar-bg:    oklch(0.98 0.002 240);
        --editor-tab-bg:        oklch(0.98 0.002 240);
        --editor-active-tab-bg: oklch(1 0 0);
        --editor-status-bg:     oklch(0.98 0.002 240);
        --editor-border:        rgba(0, 0, 0, 0.08);
        --editor-fg:            oklch(0.20 0.01 240);
        --editor-gutter-fg:     oklch(0.55 0.01 240);
        --editor-gutter-border: rgba(0, 0, 0, 0.05);

        /* Light Code Highlight Tokens */
        --code-tag:  oklch(0.50 0.15 250);
        --code-attr: oklch(0.50 0.12 180);
        --code-str:  oklch(0.50 0.14 140);
        --code-text: oklch(0.20 0.01 240);
        --code-punc: oklch(0.50 0.01 240);
        --code-kw:   oklch(0.60 0.18 320);
        --code-fn:   oklch(0.50 0.15 250);
        --code-type: oklch(0.60 0.12 190);
        --code-num:  oklch(0.65 0.15 80);
        --code-ok:   oklch(0.66 0.16 150);

        /* Card Hover styles */
        --card-hover-border: oklch(0.45 0.01 240);
        --card-hover-shadow: 0 20px 40px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02);
        --grid-opacity: 0.4;
      }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
      }
      html, body { margin: 0; }
      :root { --header-h: 88px; } /* #610 fixed banner+header offset, kept exact by the script above */
      body {
        padding-top: var(--header-h);
        background: var(--bg); color: var(--fg);
        font: 400 16px/1.65 var(--font-sans);
        -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; overflow-x: hidden;
        transition: background var(--t) cubic-bezier(0.3,0,0.3,1), color var(--t) cubic-bezier(0.3,0,0.3,1);
      }
      ::selection { background: var(--accent-tint); color: var(--fg); }
      .heart {
        display: inline-block; width: 1.15em; height: 1.15em;
        vertical-align: -0.18em; color: var(--heart);
      }
      .glow-layer { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
      .glow-layer::before {
        display: none;
      }
      .glow-layer::after {
        content: ''; position: absolute; inset: 0;
        background-image: 
          linear-gradient(var(--grid-color) 1px, transparent 1px),
          linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
        background-size: 64px 64px;
        mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%);
        -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%);
        opacity: var(--grid-opacity);
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
      .site-top-banner {
        background-color: color-mix(in oklch, var(--accent-live) 14%, var(--bg));
      }
    </style>

    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-accent-fg focus:shadow-[var(--shadow)]">Skip to content</a>

    <div class="glow-layer" aria-hidden="true"></div>

    <div class="site-top fixed inset-x-0 top-0 z-20">
    <div class="relative z-[3] text-center font-medium text-[13px] leading-[1.4] py-[9px] px-4 border-b border-border site-top-banner">
      <span class="font-mono font-bold text-[10px] leading-none tracking-[0.12em] uppercase text-accent-hover bg-bg-elev rounded-full px-2 py-[3px] mr-2 align-middle">New</span>
      <a href=${UI_URL} target="_blank" rel="noopener noreferrer" class="text-accent-hover font-semibold no-underline hover:underline">Introducing the webjs component library <span aria-hidden="true">&rarr;</span>${NEW_TAB}</a>
    </div>

    <header class="backdrop-blur-md bg-[color-mix(in_oklch,var(--color-bg)_78%,transparent)] border-b border-border">
      <div class="max-w-[1240px] mx-auto px-6 py-[11px] flex items-center justify-between gap-4">
        <a class="inline-flex items-center gap-[9px] no-underline text-fg font-display font-extrabold text-[17px] leading-none tracking-[-0.02em] shrink-0" href="/">
          <span class="w-[22px] h-[22px] rounded-[6px] bg-fg shadow-[var(--shadow-sm)]"></span>
          webjs
        </a>

        <nav class="hidden md:flex items-center gap-0.5 justify-center flex-1 mx-4" aria-label="Primary">
          ${NAV.map(n => html`<a class=${navLink} href=${n.href} target=${n.ext ? '_blank' : '_self'} rel=${n.ext ? 'noopener noreferrer' : ''}>${n.label}${n.ext ? NEW_TAB : ''}</a>`)}
        </nav>
        <div class="flex items-center gap-3 shrink-0">
          <theme-toggle></theme-toggle>

          <a href=${GH_URL} target="_blank" rel="noopener noreferrer" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-fg-muted hover:text-fg hover:bg-bg-subtle transition-all no-underline">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
            <span class="font-mono text-[11px] leading-none">1.8k</span>
          </a>

          <a href=${DOCS_URL + '/docs/getting-started'} target="_blank" rel="noopener noreferrer" class="hidden sm:inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold text-bg bg-fg hover:bg-fg-muted hover:shadow-[0_0_15px_rgba(255,255,255,0.15)] no-underline transition-all active:scale-95">
            Get Started
          </a>

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
    </div>

    <div class="relative z-[1]">
      ${children}
    </div>
  `;
}
