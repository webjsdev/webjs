import { html, type LayoutProps } from '@webjsdev/core';

// Line numbers in this fixture are asserted by test/e2e/dev-source-locations.test.mjs.
export default function RootLayout({ children }: LayoutProps) {
  return html`
    <div id="shell">
      ${children}
    </div>
  `;
}
