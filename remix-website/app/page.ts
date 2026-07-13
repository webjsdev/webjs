import { html } from '@webjsdev/core';
import '#components/particle-bg.ts';
import '#components/loading-screen.ts';
import '#components/section-nav.ts';
import '#components/label-overlay.ts';
import '#components/scroll-logo.ts';
import { highlight } from '#lib/highlight.ts';

/*
 * The Remix 3 landing page, rebuilt on web components. The page is server
 * rendered (it never hydrates); all interactivity lives in the imported
 * components (<particle-bg> WebGL engine, <loading-screen> self-dismiss,
 * <section-nav> scroll spy). Content and copy are ported from the Remix
 * site's landing-content module.
 */

const GH_URL = 'https://github.com/remix-run/remix';

// The clone is homepage-only, so the routes not rebuilt here (blog, jam) point
// at their real pages rather than 404ing on a local path.
const NAV_ITEMS = [
  { key: 'G', label: 'github', href: GH_URL },
  { key: 'D', label: 'docs', href: 'https://api.remix.run/' },
  { key: 'B', label: 'blog', href: 'https://remix.run/blog' },
  { key: 'J', label: 'jam', href: 'https://remix.run/jam/2026' },
  { key: 'S', label: 'store', href: 'https://shop.remix.run/' },
];

const CODE_SNIPPET = `import { type Handle, on } from 'remix/ui'
import { Glyph } from 'remix/ui/glyph'
import * as btn from 'remix/ui/button'


function CopyToClipboard(handle: Handle<{ url: string }>) {
  let state: "idle" | "copied" | "error" = "idle";

  return () => {
    let label =
      state === "idle"
        ? "Copy to clipboard"
        : state === "copied"
          ? "Copied"
          : "Error";

    return (
      <button
        aria-label={label}
        aria-live="polite"
        mix={[
          btn.secondaryStyle,
          on("click", async (_, signal) => {
            try {
              await navigator.clipboard.writeText(handle.props.url);
              if (signal.aborted) return;
            } catch (error) {
              state = "error";
              handle.update();
              return;
            }

            state = "copied";
            handle.update();
            setTimeout(() => {
              if (signal.aborted) return;
              state = "idle";
              handle.update();
            }, 2000);
          }),
        ]}
      >
        {state === "copied" ? (
          <Glyph name="check" />
        ) : (
          <Glyph name="clipboard" />
        )}
      </button>
    );
  };
}`;

const ARROW = html`<svg class="rmx-cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;

const SOCIAL = [
  { label: 'GitHub', href: GH_URL, path: 'M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.58l-.01-2.03c-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.34-1.72-1.34-1.72-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.22 1.84 1.22 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.58-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.23-3.17-.12-.3-.53-1.51.12-3.15 0 0 1-.32 3.3 1.21a11.5 11.5 0 0 1 6 0c2.3-1.53 3.3-1.21 3.3-1.21.65 1.64.24 2.85.12 3.15.77.83 1.23 1.88 1.23 3.17 0 4.53-2.81 5.53-5.49 5.82.43.37.81 1.1.81 2.22l-.01 3.29c0 .33.22.7.83.58A12.01 12.01 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z' },
  { label: 'X', href: 'https://x.com/remix_run', path: 'M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.29L17.61 20.65Z' },
  { label: 'YouTube', href: 'https://www.youtube.com/c/Remix-Run/streams', path: 'M23.5 6.2a3 3 0 0 0-2.11-2.13C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.39.52A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.13c1.89.52 9.39.52 9.39.52s7.5 0 9.39-.52a3 3 0 0 0 2.11-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z' },
  { label: 'Discord', href: 'https://discord.gg/xwx7mMzVkA', path: 'M20.32 4.37A19.8 19.8 0 0 0 15.42 3l-.24.45a18.3 18.3 0 0 1 4.36 1.41c-2.16-1-4.5-1.44-6.54-1.44s-4.38.44-6.54 1.44a18.3 18.3 0 0 1 4.36-1.41L10.58 3a19.8 19.8 0 0 0-4.9 1.37C2.14 9.6 1.4 14.66 1.72 19.63a19.9 19.9 0 0 0 6.03 3.06l.48-.66a13.2 13.2 0 0 1-2.02-.96l.5-.38c3.9 1.8 8.16 1.8 12 0l.5.38c-.64.38-1.32.7-2.02.96l.48.66a19.9 19.9 0 0 0 6.03-3.06c.4-5.76-.72-10.78-3.9-15.26ZM8.5 16.16c-1.18 0-2.15-1.08-2.15-2.4S7.3 11.35 8.5 11.35s2.17 1.09 2.15 2.41c0 1.32-.96 2.4-2.15 2.4Zm7 0c-1.18 0-2.15-1.08-2.15-2.4s.96-2.41 2.15-2.41 2.17 1.09 2.15 2.41c0 1.32-.96 2.4-2.15 2.4Z' },
];

type Section = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  panelClass: string;
  rowOffset?: boolean;
  code?: string;
  cta?: { label: string; href: string };
  // A second card rendered beside the primary panel (the ending has two).
  secondary?: { kicker: string; title: string; body: string };
  // The "batteries included" package badges, on the full-stack section.
  packages?: boolean;
};

// The five stacked package badges (auth, routing, data, session, component)
// masked in the cycling brand color on the right of the full-stack section.
// top/height are fractions of the badge container; data sits left of session.
const PACKAGES = [
  { name: 'auth', top: '0%', h: '24.2%', right: '24px', ratio: '904 / 245' },
  { name: 'routing', top: '26.5%', h: '17.9%', right: '24px', ratio: '1440 / 288' },
  { name: 'data', top: '50%', h: '16%', right: '250px', ratio: '577 / 290' },
  { name: 'session', top: '50%', h: '16%', right: '24px', ratio: '797 / 288' },
  { name: 'component', top: '75%', h: '25%', right: '24px', ratio: '1438 / 414' },
];

const SECTIONS: Section[] = [
  {
    id: 'full-stack',
    kicker: 'Cohesive frontend and backend',
    title: 'Closing the gap between the initial spark and shipping',
    body: "Remix is the world's first truly full-stack JavaScript framework. It includes a server, router, data layer, UI components, testing, and much more. Everything you need to go from idea to launch in a single dependency.",
    panelClass: 'rmx-col-left-4',
    packages: true,
  },
  {
    id: 'ai-ready',
    kicker: 'Ready to build right out of the box',
    title: 'Built for humans and models',
    body: "Remix ships with skills that help your AI agent learn the API and follow best practices. Whether you let the agent write all the code, or you tweak it by hand, Remix just works. It's one unified stack that speaks Remix end to end, not a patchwork of tools. When you want to change something, explain it in plain language. The framework stays out of your way.",
    panelClass: 'rmx-col-left-4',
  },
  {
    id: 'powerful-components',
    kicker: 'The next generation of UI',
    title: 'High-performance components in plain, beautiful JavaScript',
    body: 'Remix components build on web primitives like EventTarget and avoid the runtime semantics of React hooks, giving you back normal JavaScript control flow and execution. This works seamlessly with the web, including web components and third-party libraries. Remix also provides native mixins for the DOM that make it easier than ever to compose and apply complex behavior on native platform elements.',
    panelClass: 'rmx-col-left-5-tight',
    rowOffset: true,
    code: CODE_SNIPPET,
  },
  {
    id: 'use-cases',
    kicker: 'One framework for any kind of project',
    title: 'A store overnight.\nA business in a weekend. The app you always wanted to ship.',
    body: 'Whatever you want to build, Remix can meet the project where it is. Start something new, grow it into a business, or bring Remix into an app that already exists. One technology, used in whatever way the project needs.',
    panelClass: 'rmx-col-right-full',
  },
  {
    id: 'start-building',
    kicker: 'Describe the destination',
    title: 'Building with Remix can take you there',
    body: 'Remix 3 is currently available as a beta release.',
    panelClass: 'rmx-col-left-6',
    cta: { label: 'Watch the repo', href: GH_URL },
    secondary: {
      kicker: 'Subscribe to our newsletter',
      title: 'Stay in the loop',
      body: 'Once a month, we write about everything in the world of Remix. Sign up to be notified about progress on Remix 3. No spam. Unsubscribe anytime.',
    },
  },
];

function renderSection(s: Section) {
  return html`
    <section id=${s.id} class="rmx-section">
      <div class="rmx-row ${s.rowOffset ? 'rmx-row--offset' : ''}">
        <div class="rmx-panel ${s.panelClass}">
          <p class="rmx-kicker">${s.kicker}</p>
          <h2 class="rmx-title">${s.title}</h2>
          <p class="rmx-body">${s.body}</p>
          ${s.cta ? html`<a class="rmx-cta" href=${s.cta.href} target="_blank" rel="noopener noreferrer">${s.cta.label} ${ARROW}</a>` : ''}
        </div>
        ${s.secondary ? html`
          <div class="rmx-panel rmx-col-right-news">
            <p class="rmx-kicker">${s.secondary.kicker}</p>
            <h2 class="rmx-title">${s.secondary.title}</h2>
            <p class="rmx-body">${s.secondary.body}</p>
            <form class="rmx-subscribe" method="post" action="/_actions/newsletter">
              <label class="sr-only" for="newsletter">Email address</label>
              <input id="newsletter" name="email" type="email" placeholder="name@example.com" autocomplete="email" />
              <button type="submit">Subscribe</button>
            </form>
          </div>
        ` : ''}
        ${s.packages ? html`
          <div class="rmx-packages" aria-hidden="true">
            ${PACKAGES.map(p => html`<span class="rmx-package" style="top:${p.top};height:${p.h};right:${p.right};aspect-ratio:${p.ratio};mask-image:url(/public/landing/remix-package-${p.name}.svg);-webkit-mask-image:url(/public/landing/remix-package-${p.name}.svg)"></span>`)}
          </div>
        ` : ''}
        ${s.code ? html`
          <div class="rmx-code-panel rmx-col-code">
            <pre class="rmx-code-pre" tabindex="0" aria-label="Code sample"><code>${highlight(s.code)}</code></pre>
          </div>
        ` : ''}
      </div>
    </section>
  `;
}

export default function LandingPage() {
  return html`
    <particle-bg class="rmx-particle-canvas" aria-hidden="true"></particle-bg>

    <div class="rmx-content">
      <scroll-logo></scroll-logo>

      <header class="rmx-nav">
        <span class="rmx-nav-hint">scroll or press &darr; and &uarr;</span>
        <nav class="rmx-nav-list" aria-label="Primary">
          ${NAV_ITEMS.map(n => html`<a class="rmx-nav-item" href=${n.href}>[${n.key}] ${n.label}</a>`)}
        </nav>
      </header>

      <main id="main-content" tabindex="-1">
        <section id="the-framework" class="rmx-hero">
          <div class="rmx-hero-group">
            <h1 class="rmx-hero-title">A web framework for building anything</h1>
            <p class="rmx-hero-body">
              Remix gives you the power and tools to build anything you can dream
              of. To get started, just <span class="rmx-code">npx remix@next new</span>
              and you're off to the races.
            </p>
          </div>
        </section>

        ${SECTIONS.map(renderSection)}
      </main>

      <footer class="rmx-footer">
        <div class="rmx-footer-content">
          <div class="rmx-brand-row">
            <span class="rmx-footer-wordmark" role="img" aria-label="Remix" style="font-family:'Inter',sans-serif;font-weight:800;font-size:16px;letter-spacing:-0.03em;color:#fff">Remix</span>
            <div class="rmx-social">
              ${SOCIAL.map(l => html`<a href=${l.href} aria-label=${l.label} target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d=${l.path}></path></svg></a>`)}
            </div>
          </div>
          <div class="rmx-legal">
            <p>Docs and examples <a href="https://opensource.org/license/mit" target="_blank" rel="noopener noreferrer">licensed under MIT</a></p>
            <p>Remix-3 clone experiment. Not affiliated with Remix or Shopify.</p>
          </div>
        </div>
      </footer>

      <label-overlay></label-overlay>

      <section-nav data-count=${String(SECTIONS.length + 1)}></section-nav>
    </div>

    <loading-screen></loading-screen>
  `;
}
