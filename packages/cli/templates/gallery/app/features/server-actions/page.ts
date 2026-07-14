import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '#modules/server-actions/components/greeter.ts';

export const metadata: Metadata = { title: 'Server actions (.server vs use server) | features' };

export default function ServerActionsExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Server actions</h1>
    <p class="text-muted-foreground mb-4">A 'use server' action is RPC-callable from the client; a plain .server.ts is a server-only utility you never import into a component.</p>
    <p class="text-muted-foreground mb-4">
      This action also declares <code class="font-mono">export const middleware</code>: a
      chain that runs around it on every boundary. The auth middleware sets the
      caller on the request context (read back with <code class="font-mono">actionContext()</code>)
      or 401s before the action runs. The action threads
      <code class="font-mono">actionSignal()</code>, the request AbortSignal, through
      its work so a client disconnect or a superseded render stops it early.
    </p>
    <server-greeter></server-greeter>
  `;
}
