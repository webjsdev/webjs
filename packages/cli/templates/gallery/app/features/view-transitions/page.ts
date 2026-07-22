// View Transitions: opt in with a <meta name="view-transition" content="same-origin">
// (declared here via metadata.other, so it scopes to this page, not the whole
// app). When present, the client router wraps its DOM swap in the native View
// Transitions API, so a soft navigation cross-fades instead of snapping. Where
// startViewTransition is unavailable the swap runs synchronously with no flash
// and no throw, so it degrades cleanly. The <input> below is marked
// data-webjs-permanent with an id, so the router carries the SAME live node
// across the swap: type into it, navigate, and your text survives the transition.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = {
  title: 'View transitions (soft-nav cross-fade) | features',
  other: { 'view-transition': 'same-origin' },
};

export default function ViewTransitionsExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">View transitions</h1>
    <div class="rounded-2xl bg-primary/10 border border-primary/30 p-6 mb-6">
      <p class="text-foreground m-0">Page one. Navigate to page two: with the
        <code class="font-mono">&lt;meta name="view-transition"&gt;</code> opt-in,
        the swap cross-fades.</p>
    </div>
    <label class="block mb-6">
      <span class="text-muted-foreground text-sm">Type here, then navigate. This input is
        <code class="font-mono">data-webjs-permanent</code>, so its value survives the swap:</span>
      <input id="vt-note" data-webjs-permanent type="text" placeholder="type something…"
        class="mt-2 block w-full max-w-sm rounded-xl border border-border bg-card px-4 py-2 text-foreground" />
    </label>
    <div class="flex gap-3 items-center">
      <a href="/features/view-transitions/second" class="inline-flex items-center px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm no-underline transition-all hover:bg-primary/90 active:scale-[0.97]">Go to page two</a>
      <a href="/" class="text-muted-foreground no-underline font-medium text-sm hover:text-foreground transition-colors">Home</a>
    </div>
    <p class="text-muted-foreground text-sm mt-6">
      Opt in app-wide instead by putting the meta on the root layout. Keep the
      transition simple: toggling root attributes mid-nav can cause a one-frame
      repaint flash on iOS WebKit.
    </p>
  `;
}
