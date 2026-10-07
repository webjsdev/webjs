import { html, type LayoutProps } from '@webjsdev/core';
import '../components/bump-button.ts';

/** The stylesheet is hoisted into <head>; the token detects a real reload. */
export default function RootLayout({ children }: LayoutProps) {
  return html`
    <script>window.__docToken = window.__docToken || String(Math.random());</script>
    <link rel="stylesheet" href="/public/app.css">
    <bump-button></bump-button>
    <main>${children}</main>
  `;
}
