import { html, type LayoutProps } from '@webjsdev/core';
import { signedIn } from '#modules/session.server.ts';
import { signOut } from '#modules/auth.server.ts';
import '#components/counter.ts';

/**
 * The header depends on a cookie, and it sits OUTSIDE the children range, so a
 * boundary swap cannot reach it. The inline script is the reload detector: it
 * only assigns when absent, so it changes only when the global scope does.
 */
export default function RootLayout({ children }: LayoutProps) {
  const inside = signedIn();
  return html`
    <script>window.__docToken = window.__docToken || String(Math.random());</script>
    <header>
      <span id="auth-state">${inside ? 'Signed in' : 'Signed out'}</span>
      ${inside
        ? html`<form action=${signOut}><button id="signout-btn" type="submit">Sign out</button></form>`
        : html`<a id="signin-link" href="/signin">Sign in</a>`}
      <state-counter></state-counter>
    </header>
    <main>${children}</main>
  `;
}
