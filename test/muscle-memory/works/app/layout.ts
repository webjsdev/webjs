// Next idiom: a root layout receiving `children`.
import { html } from '@webjsdev/core';
import type { LayoutProps } from '@webjsdev/core';

export default function RootLayout({ children }: LayoutProps) {
  return html`<div class="shell">${children}</div>`;
}
