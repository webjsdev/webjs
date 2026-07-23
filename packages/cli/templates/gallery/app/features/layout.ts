import { html } from '@webjsdev/core';
import { backLink } from '#lib/utils/ui.ts';
import '#modules/gallery/components/gallery-nav.ts';

// A subtle, hover-revealed scrollbar for the sidebar (macOS overlay feel): the
// track + thumb are transparent while idle (no bar), and fade in on hover /
// keyboard focus, then fade out again. A layout may interpolate CSS into a
// <style> (it never hydrates, unlike a component), so this is legitimate here.
const SIDENAV_CSS = `
  .gallery-sidenav { scrollbar-width: thin; scrollbar-color: transparent transparent; transition: scrollbar-color .2s ease; }
  .gallery-sidenav:hover, .gallery-sidenav:focus-within { scrollbar-color: color-mix(in oklch, var(--foreground) 22%, transparent) transparent; }
  .gallery-sidenav::-webkit-scrollbar { width: 8px; }
  .gallery-sidenav::-webkit-scrollbar-track { background: transparent; }
  .gallery-sidenav::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; transition: background-color .2s ease; }
  .gallery-sidenav:hover::-webkit-scrollbar-thumb, .gallery-sidenav:focus-within::-webkit-scrollbar-thumb { background-color: color-mix(in oklch, var(--foreground) 22%, transparent); }
  .gallery-sidenav::-webkit-scrollbar-thumb:hover { background-color: color-mix(in oklch, var(--foreground) 40%, transparent); }
`;

// Section rhythm: ONE uniform gap between every top-level block of a demo
// (heading, lede, paragraph, component, list, anything), so spacing stays
// consistent with NO per-element margins. It zeroes each direct child's own
// block margins, then puts an equal gap before every child after the first. This
// is the single place that controls demo spacing. A group that must stay tight (a
// caption directly above its code) is wrapped in ONE child <div>, which keeps its
// own inner spacing (the reset only reaches DIRECT children of .demo-stack).
const STACK_CSS = `
  .demo-stack { --section-gap: 1.5rem; }
  /* Space only RENDERED sections; skip streaming <script>/<style>/<template>
     nodes (a forced-visible script would otherwise gain a phantom gap). block so
     a shadow-DOM host (inline by default) honours the gap; ~ (not +) so an
     interleaved streaming script cannot break the adjacency. */
  .demo-stack > :not(script):not(style):not(template) { display: block; margin-block: 0; }
  .demo-stack > :not(script):not(style):not(template) ~ :not(script):not(style):not(template) { margin-block-start: var(--section-gap); }
  /* <webjs-suspense> is display:contents while streaming (no box, so it would
     drop its section gap). Force a block box so the gap applies; streaming only
     moves its children, so a CSS-level display change does not affect it. */
  .demo-stack > webjs-suspense { display: block !important; }
`;

// Shared layout for every gallery feature demo under /features/*. A docs-style
// two-column shell: a grouped sidebar (the <gallery-nav> component, which tracks
// the active demo across soft navigation) plus the demo content. On mobile the
// sidebar is hidden, so a slim back link keeps a demo from being a dead end.
// Nested layouts (like the auth dashboard's sub-nav) render inside ${children}.
// A non-root layout, so it never writes the document shell (the framework does).
export default function FeaturesLayout({ children, url }: { children: unknown; url: URL | string }) {
  const path = typeof url === 'string' ? new URL(url, 'http://x').pathname : url.pathname;
  return html`
    <style>${SIDENAV_CSS}${STACK_CSS}</style>
    <div class="lg:hidden mb-6">${backLink('/', html`&larr; Gallery`)}</div>
    <div class="grid lg:grid-cols-[190px_1fr] gap-8 lg:gap-12">
      <!-- The sidebar caps at the viewport minus the root chrome (the h-14 navbar
           = 3.5rem plus the root <main>'s py-8 = 4rem, so 7.5rem) and scrolls
           internally, so a short demo never forces a page scrollbar. -->
      <aside class="hidden lg:flex lg:flex-col sticky top-6 self-start max-h-[calc(100dvh-7.5rem)] text-sm">
        <!-- Pinned header: stays put while the demo list below scrolls. -->
        <a href="/" class="shrink-0 block px-3 py-1.5 mb-2 rounded-lg no-underline text-muted-foreground hover:text-foreground transition-colors">&larr; Gallery</a>
        <div class="gallery-sidenav min-h-0 overflow-y-auto overflow-x-hidden -mr-2 pr-2">
          <gallery-nav current=${path}></gallery-nav>
        </div>
      </aside>
      <div class="min-w-0 demo-stack">${children}</div>
    </div>
  `;
}
