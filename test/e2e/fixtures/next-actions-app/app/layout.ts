import { html, type LayoutProps } from '@webjsdev/core';

/** The inline script is the reload detector: it assigns only when absent. */
export default function RootLayout({ children }: LayoutProps) {
  return html`
    <script>window.__docToken = window.__docToken || String(Math.random());</script>
    <main>${children}</main>
  `;
}
