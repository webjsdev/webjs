import { html } from '@webjsdev/core';
import { backLink } from '#lib/utils/ui.ts';

// Shared layout for every gallery example app under /examples/*. It adds the same
// slim "back to the gallery" link the feature demos get, so an example is never a
// dead end. A non-root layout, so it never writes the document shell.
export default function ExamplesLayout({ children }: { children: unknown }) {
  return html`
    ${backLink('/', html`&larr; Gallery`)}
    ${children}
  `;
}
