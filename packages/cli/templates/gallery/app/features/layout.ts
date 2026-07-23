import { html } from '@webjsdev/core';
import { backLink } from '#lib/utils/ui.ts';
import '#modules/gallery/components/gallery-nav.ts';

// Shared layout for every gallery feature demo under /features/*. A docs-style
// two-column shell: a grouped sidebar (the <gallery-nav> component, which tracks
// the active demo across soft navigation) plus the demo content. On mobile the
// sidebar is hidden, so a slim back link keeps a demo from being a dead end.
// Nested layouts (like the auth dashboard's sub-nav) render inside ${children}.
// A non-root layout, so it never writes the document shell (the framework does).
export default function FeaturesLayout({ children, url }: { children: unknown; url: URL | string }) {
  const path = typeof url === 'string' ? new URL(url, 'http://x').pathname : url.pathname;
  return html`
    <div class="lg:hidden mb-6">${backLink('/', html`&larr; Gallery`)}</div>
    <div class="grid lg:grid-cols-[190px_1fr] gap-8 lg:gap-12">
      <aside class="hidden lg:block sticky top-6 self-start max-h-[calc(100dvh-4rem)] overflow-y-auto overflow-x-hidden py-1 text-sm">
        <gallery-nav current=${path}></gallery-nav>
      </aside>
      <div class="min-w-0">${children}</div>
    </div>
  `;
}
