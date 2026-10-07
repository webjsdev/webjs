// A route.ts exports WS(ws, req) for the endpoint (echo/route.ts, a sibling
// folder so it does not collide with this page) and a component talks to it
// with connectWS(). A live socket has no no-JS form, so the component renders
// a "needs JavaScript" state at SSR and enhances on hydration.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { pageHeading, lede } from '#lib/utils/ui.ts';
import '#modules/websockets/components/ws-echo.ts';

export const metadata: Metadata = { title: 'WebSockets (connectWS + WS) | features' };

export default function WebSocketsExample() {
  return html`
    ${pageHeading('WebSockets')}
    ${lede(html`
      A <code class="font-mono">WS(ws, req)</code> export in
      <code class="font-mono">route.ts</code> is the server endpoint;
      <code class="font-mono">connectWS()</code> (auto-reconnect, JSON
      encode/decode, queued sends) is the client. This echoes each message back.
    `)}
    <ws-echo></ws-echo>
  `;
}
