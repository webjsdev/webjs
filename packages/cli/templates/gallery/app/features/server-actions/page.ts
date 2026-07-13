import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '#modules/server-actions/components/greeter.ts';

export const metadata: Metadata = { title: 'Server actions (.server vs use server) | features' };

export default function ServerActionsExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Server actions</h1>
    <p class="text-muted-foreground mb-4">A 'use server' action is RPC-callable from the client; a plain .server.ts is a server-only utility you never import into a component.</p>
    <server-greeter></server-greeter>
  `;
}
