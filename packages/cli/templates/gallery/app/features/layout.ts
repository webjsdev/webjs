import { html } from '@webjsdev/core';

// Shared layout for every gallery feature demo under /features/*. It adds a slim
// "back to the gallery" link above each demo so a card is never a dead end.
// Nested layouts (like the auth dashboard's sub-nav) render inside ${children}.
// A non-root layout, so it never writes the document shell (the framework does).
export default function FeaturesLayout({ children }: { children: unknown }) {
  return html`
    <a href="/" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline mb-6">&larr; Gallery</a>
    ${children}
  `;
}
