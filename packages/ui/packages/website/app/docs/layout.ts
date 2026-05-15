import { html, css } from '@webjskit/core';
import { loadRegistryIndex } from '../_lib/registry.server.ts';

// Subtle, hover-revealed scrollbar for the sidenav.
//
// Default behavior: scrollbar track + thumb are transparent — the column
// looks bar-less while idle. On hover (mouse over the aside) the thumb
// fades in. Mirrors macOS overlay-scrollbar feel cross-browser:
//   - Firefox: scrollbar-color, scrollbar-width
//   - Chromium / Safari: ::-webkit-scrollbar pseudo-elements
const SIDENAV_STYLES = css`
  .docs-sidenav {
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
    transition: scrollbar-color 200ms ease;
  }
  .docs-sidenav:hover,
  .docs-sidenav:focus-within {
    scrollbar-color: color-mix(in oklch, var(--fg) 25%, transparent) transparent;
  }
  .docs-sidenav::-webkit-scrollbar {
    width: 8px;
  }
  .docs-sidenav::-webkit-scrollbar-track {
    background: transparent;
  }
  .docs-sidenav::-webkit-scrollbar-thumb {
    background-color: transparent;
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: padding-box;
    transition: background-color 200ms ease;
  }
  .docs-sidenav:hover::-webkit-scrollbar-thumb,
  .docs-sidenav:focus-within::-webkit-scrollbar-thumb {
    background-color: color-mix(in oklch, var(--fg) 25%, transparent);
  }
  .docs-sidenav::-webkit-scrollbar-thumb:hover {
    background-color: color-mix(in oklch, var(--fg) 45%, transparent);
  }
`;

/**
 * Shadcn-style docs shell: sidebar (component list, getting started) on the
 * left, content on the right. The sidebar is generated from the registry
 * index at request time so adding a new component to the registry shows up
 * here automatically.
 */
export default async function DocsLayout({ children }: { children: unknown }) {
  const all = await loadRegistryIndex();
  const components = all.filter((i) => i.type === 'registry:ui');

  // Shared link styling: padded, rounded, with a clearly visible hover
  // surface. `-mx-2` lets the rounded hover background extend slightly
  // past the column's text alignment for a shadcn-style pill that hugs
  // the sidebar's left edge instead of floating inside it.
  //
  // Why not `hover:bg-accent`: in ui-website's @theme block, `bg-accent`
  // is deliberately remapped to `--accent-shadcn` so the component
  // PREVIEWS render shadcn's neutral hover state. That same remap makes
  // chrome `bg-accent` resolve to oklch(0.97 0 0) — near-white on a
  // near-white page bg, basically invisible on hover.
  //
  // Why `bg-bg-subtle` instead of a translucent `bg-fg/10`: a defined
  // theme token reads as a solid, padded surface against the page bg in
  // both light + dark, and the rounded-md corners stay crisp. The 10%
  // foreground tint we used before was so subtle in light mode that the
  // padded+rounded shape didn't register visually — the hover looked
  // like a thin color smudge sized to the text, not a button.
  const linkClass =
    'block py-2 px-3 -mx-2 rounded-md text-fg-muted hover:bg-bg-subtle hover:text-fg transition-colors';

  return html`
    <style>${SIDENAV_STYLES.text}</style>
    <div class="grid lg:grid-cols-[220px_1fr] gap-8 -mt-10">
      <!--
        Sidenav height note: when the user is at the top of the page,
        the aside's natural position sits ~100px below the viewport
        top (announce banner + header push it down). With
        h-[calc(100vh-2rem)] (the previous value), the aside's BOTTOM
        edge fell ~100px below the viewport bottom, so the last items
        in the internal scroll were never reachable without a
        page-level scroll first. Subtracting ~8rem (128px) instead
        of 2rem makes the aside fit the visible viewport from the
        start. Once the user scrolls past the header, sticky top-4
        keeps the aside pinned 16px below viewport top with plenty
        of headroom — slightly less vertical real estate in the
        sticky state, but acceptable trade-off for never needing a
        page scroll to reach the last item.

        (Do not use U+0060 GRAVE ACCENT in this comment — it's inside
        the docs layout's html tagged template. See
        [[feedback-html-template-no-backticks]].)
      -->
      <aside class="docs-sidenav hidden lg:block sticky top-4 self-start h-[calc(100vh-8rem)] overflow-x-hidden overflow-y-auto py-6 text-sm">
        <div class="font-semibold mb-2 text-fg">Getting Started</div>
        <nav class="flex flex-col gap-0.5 mb-6">
          <a href="/docs" class=${linkClass}>Introduction</a>
          <a href="/" class=${linkClass}>All components</a>
        </nav>
        <div class="font-semibold mb-2 text-fg">Components <span class="font-normal text-xs text-fg-subtle">(${components.length})</span></div>
        <nav class="flex flex-col gap-0.5">
          ${components.map(
            (c) => html`<a href="/docs/components/${c.name}" class=${linkClass}>${c.name}</a>`,
          )}
        </nav>
      </aside>
      <div class="min-w-0 py-10">${children}</div>
    </div>
    <!--
      Persist sidenav scroll position across client-router navigations.
      webjs's router does a full body swap when layouts don't share a
      custom-element shell — so the .docs-sidenav element gets
      re-mounted at scrollTop: 0 each time a sidebar link is clicked,
      defeating the point of an independently-scrollable sidebar. Save
      scrollTop to sessionStorage before the navigation happens (we
      hook the link click which fires BEFORE the router intercepts),
      then restore on initial page load AND after every
      webjs:navigate event.
    -->
    <script>
      (function () {
        var KEY = 'docs-sidenav-scroll';
        function sidenav() { return document.querySelector('.docs-sidenav'); }
        function restore() {
          var s = sidenav(); if (!s) return;
          var v = sessionStorage.getItem(KEY);
          if (v != null) s.scrollTop = Number(v) || 0;
        }
        // Save on any sidenav link click (capture phase to run before
        // the router intercepts and starts navigating away).
        document.addEventListener('click', function (e) {
          var s = sidenav(); if (!s) return;
          if (!s.contains(e.target)) return;
          if (!e.target.closest || !e.target.closest('a')) return;
          sessionStorage.setItem(KEY, String(s.scrollTop));
        }, true);
        // Restore on first paint + after every router-driven swap.
        restore();
        document.addEventListener('webjs:navigate', function () {
          // The router has already rendered the new body — restore
          // synchronously, then again on next frame as a safety net
          // for layouts where the aside renders just after this event.
          restore();
          requestAnimationFrame(restore);
        });
      })();
    </script>
  `;
}
