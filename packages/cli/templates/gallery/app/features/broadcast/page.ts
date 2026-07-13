// Broadcast: fan a message out to EVERY client connected to a WebSocket path,
// not just the sender. The framework auto-registers each connection to its path,
// so broadcast(path, data) from '@webjsdev/server' reaches all of them. This is
// the difference from the plain websockets demo (which echoes to one socket).
// Open this page in two browser tabs and send: both see every message.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '#modules/broadcast/components/broadcast-feed.ts';

export const metadata: Metadata = { title: 'Broadcast (fan-out to all clients) | features' };

export default function BroadcastExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Broadcast</h1>
    <p class="text-muted-foreground mb-4">
      Every message is fanned out to all connected clients via
      <code class="font-mono">broadcast()</code>. Open this page in a second tab
      and watch messages appear in both. Single-instance by default; wire Redis
      to scale across processes.
    </p>
    <broadcast-feed></broadcast-feed>
  `;
}
