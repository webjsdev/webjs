// webjs-scaffold-placeholder. Feature gallery route. Keep and adapt it, or prune it (delete this app/features/server-actions route AND modules/server-actions), then delete this marker line. webjs check fails while the marker remains.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '#modules/server-actions/components/greeter.ts';

export const metadata: Metadata = { title: 'Server actions (.server vs use server) | examples' };

export default function ServerActionsExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Server actions</h1>
    <p class="text-fg-muted mb-4">A 'use server' action is RPC-callable from the client; a plain .server.ts is a server-only utility you never import into a component.</p>
    <server-greeter></server-greeter>
  `;
}
