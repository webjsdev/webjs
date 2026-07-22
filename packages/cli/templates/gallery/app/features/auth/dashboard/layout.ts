import { html } from '@webjsdev/core';

// Nested layout for the protected dashboard subtree. Logout is a plain
// <form method="POST"> posting to the createAuth signout route: it clears the
// session cookie and 302s home, and works with JS off (progressive-enhancement
// default). signOut is server-only (modules/auth/auth.server.ts), so we POST to
// its route rather than import it into a browser-shipping page. After signout the
// dashboard middleware bounces any later visit to login.
export default function DashboardLayout({ children }: { children: unknown }) {
  return html`
    <nav class="flex items-center gap-4 mb-6 pb-4 border-b border-border">
      <a href="/" class="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">&larr; Gallery</a>
      <span class="w-px h-4 bg-border" aria-hidden="true"></span>
      <a href="/features/auth/dashboard" class="text-sm font-medium text-foreground hover:underline">Dashboard</a>
      <a href="/features/auth/dashboard/settings" class="text-sm font-medium text-foreground hover:underline">Settings</a>
      <form method="POST" action="/api/auth/signout" class="ml-auto">
        <button type="submit" class="px-3 py-1.5 rounded-lg border border-border text-sm text-foreground bg-transparent cursor-pointer transition-colors hover:bg-accent">Log out</button>
      </form>
    </nav>
    ${children}
  `;
}
