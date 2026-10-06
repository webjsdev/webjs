import { html, type LayoutProps } from '@webjsdev/core';
import '#components/trouble.ts';

export default function RootLayout({ children }: LayoutProps) {
  return html`
    <main>
      <trouble-el></trouble-el>
      ${children}
    </main>
  `;
}
