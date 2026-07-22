import { html } from '@webjsdev/core';

// Shared layout for every gallery example app under /examples/*. It adds the same
// slim "back to the gallery" link the feature demos get, so an example is never a
// dead end. A non-root layout, so it never writes the document shell.
export default function ExamplesLayout({ children }: { children: unknown }) {
  return html`
    <a href="/" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline mb-6">&larr; Gallery</a>
    ${children}
  `;
}
